"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { getIceServers } from "@/lib/ice";
import type { MediaKind, Member, SignalData } from "@/lib/types";

export type RemotePeer = {
  id: string;
  name: string;
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
};

type UseCallOptions = {
  socket: Socket | null;
  selfId: string;
  members: Member[];
};

export function useCall({ socket, selfId, members }: UseCallOptions) {
  const [inCall, setInCall] = useState(false);
  const [kind, setKind] = useState<MediaKind>("video");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<RemotePeer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const pcsRef = useRef(new Map<string, RTCPeerConnection>());
  const makingOfferRef = useRef(new Map<string, boolean>());
  const ignoreOfferRef = useRef(new Map<string, boolean>());
  const pendingIceRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const localStreamRef = useRef<MediaStream | null>(null);
  const inCallRef = useRef(false);
  const selfIdRef = useRef(selfId);
  const membersRef = useRef(members);
  const socketRef = useRef(socket);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    selfIdRef.current = selfId;
    membersRef.current = members;
    socketRef.current = socket;
  }, [selfId, members, socket]);

  const nameOf = useCallback((id: string) => {
    return membersRef.current.find((m) => m.id === id)?.name ?? "Participante";
  }, []);

  const upsertPeer = useCallback(
    (id: string, patch: Partial<RemotePeer>) => {
      setPeers((prev) => {
        const existing = prev.find((p) => p.id === id);
        if (!existing) {
          return [
            ...prev,
            {
              id,
              name: nameOf(id),
              stream: null,
              connectionState: "new",
              ...patch,
            },
          ];
        }
        return prev.map((p) => (p.id === id ? { ...p, ...patch } : p));
      });
    },
    [nameOf],
  );

  const flushIce = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queued = pendingIceRef.current.get(peerId);
    if (!queued?.length || !pc.remoteDescription) return;
    pendingIceRef.current.set(peerId, []);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.warn("ICE queued failed", err);
      }
    }
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string) => {
      const existing = pcsRef.current.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      pcsRef.current.set(peerId, pc);
      makingOfferRef.current.set(peerId, false);
      ignoreOfferRef.current.set(peerId, false);

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        socketRef.current?.emit("call:signal", {
          to: peerId,
          data: { type: "ice", candidate: event.candidate.toJSON() } satisfies SignalData,
        });
      };

      pc.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        event.track.onunmute = () => {
          upsertPeer(peerId, { stream, name: nameOf(peerId) });
        };
        upsertPeer(peerId, { stream, name: nameOf(peerId) });
      };

      pc.onconnectionstatechange = () => {
        upsertPeer(peerId, { connectionState: pc.connectionState });
        if (pc.connectionState === "failed") {
          try {
            pc.restartIce();
          } catch {
            /* ignore */
          }
        }
      };

      pc.onnegotiationneeded = async () => {
        try {
          makingOfferRef.current.set(peerId, true);
          await pc.setLocalDescription();
          socketRef.current?.emit("call:signal", {
            to: peerId,
            data: {
              type: "sdp",
              description: {
                type: pc.localDescription!.type,
                sdp: pc.localDescription!.sdp,
              },
            } satisfies SignalData,
          });
        } catch (err) {
          console.error("negotiationneeded", err);
        } finally {
          makingOfferRef.current.set(peerId, false);
        }
      };

      const stream = localStreamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) {
          pc.addTrack(track, stream);
        }
      }

      upsertPeer(peerId, { name: nameOf(peerId), connectionState: pc.connectionState });
      return pc;
    },
    [nameOf, upsertPeer],
  );

  const handleSignal = useCallback(
    async (from: string, data: SignalData) => {
      if (!inCallRef.current) return;
      const pc = createPeerConnection(from);
      const polite = selfIdRef.current < from;

      if (data.type === "sdp") {
        const description = data.description;
        const offerCollision =
          description.type === "offer" &&
          (Boolean(makingOfferRef.current.get(from)) || pc.signalingState !== "stable");
        const ignore = !polite && offerCollision;
        ignoreOfferRef.current.set(from, ignore);
        if (ignore) return;

        await pc.setRemoteDescription(description);
        await flushIce(from, pc);
        if (description.type === "offer") {
          await pc.setLocalDescription();
          socketRef.current?.emit("call:signal", {
            to: from,
            data: {
              type: "sdp",
              description: {
                type: pc.localDescription!.type,
                sdp: pc.localDescription!.sdp,
              },
            } satisfies SignalData,
          });
        }
      } else if (data.type === "ice") {
        try {
          if (!pc.remoteDescription) {
            const queued = pendingIceRef.current.get(from) ?? [];
            queued.push(data.candidate);
            pendingIceRef.current.set(from, queued);
            return;
          }
          await pc.addIceCandidate(data.candidate);
        } catch (err) {
          if (!ignoreOfferRef.current.get(from)) {
            console.warn("addIceCandidate", err);
          }
        }
      }
    },
    [createPeerConnection, flushIce],
  );

  const stopLocal = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
  }, []);

  const closePeers = useCallback(() => {
    for (const pc of pcsRef.current.values()) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onnegotiationneeded = null;
      pc.close();
    }
    pcsRef.current.clear();
    makingOfferRef.current.clear();
    ignoreOfferRef.current.clear();
    pendingIceRef.current.clear();
    setPeers([]);
  }, []);

  const hangUp = useCallback(
    (notify = true) => {
      if (notify && inCallRef.current) {
        socketRef.current?.emit("call:leave");
      }
      inCallRef.current = false;
      startedAtRef.current = null;
      setInCall(false);
      setElapsed(0);
      setMuted(false);
      setCameraOff(false);
      stopLocal();
      closePeers();
    },
    [closePeers, stopLocal],
  );

  const acquireMedia = useCallback(async (callKind: MediaKind) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video:
          callKind === "video"
            ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
            : false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setError(null);
      return stream;
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Necesitamos permiso de micrófono y cámara para las llamadas. Actívalo en el navegador e inténtalo de nuevo."
          : "No se pudo acceder al micrófono o la cámara. Revisa que no estén en uso por otra app.";
      setError(message);
      throw err;
    }
  }, []);

  const joinCall = useCallback(
    async (callKind: MediaKind) => {
      if (!socketRef.current || inCallRef.current) return;
      closePeers();
      setKind(callKind);
      setCameraOff(callKind !== "video");
      await acquireMedia(callKind);
      inCallRef.current = true;
      startedAtRef.current = Date.now();
      setInCall(true);
      socketRef.current.emit("call:join", { kind: callKind });
    },
    [acquireMedia, closePeers],
  );

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
  }, [muted]);

  const toggleCamera = useCallback(() => {
    if (kind !== "video") return;
    const next = !cameraOff;
    setCameraOff(next);
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !next;
    });
  }, [cameraOff, kind]);

  const kickParticipant = useCallback((userId: string) => {
    socketRef.current?.emit("call:kick", { userId });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    if (!inCall) return;
    const timer = window.setInterval(() => {
      if (startedAtRef.current) {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [inCall]);

  useEffect(() => {
    if (!socket) return;

    const onJoined = (payload: { kind: MediaKind; peers: string[] }) => {
      setKind(payload.kind);
      for (const peerId of payload.peers) {
        createPeerConnection(peerId);
      }
    };

    const onPeerJoined = (payload: { userId: string }) => {
      if (!inCallRef.current) return;
      if (payload.userId === selfIdRef.current) return;
      createPeerConnection(payload.userId);
    };

    const onPeerLeft = (payload: { userId: string }) => {
      const pc = pcsRef.current.get(payload.userId);
      if (pc) {
        pc.close();
        pcsRef.current.delete(payload.userId);
      }
      setPeers((prev) => prev.filter((p) => p.id !== payload.userId));
    };

    const onSignal = (payload: { from: string; data: SignalData }) => {
      void handleSignal(payload.from, payload.data);
    };

    const onError = (payload: { message: string }) => {
      setError(payload.message);
      hangUp(false);
    };

    const onKicked = (payload: { message: string }) => {
      setError(payload.message);
      hangUp(false);
    };

    socket.on("call:joined", onJoined);
    socket.on("call:peer-joined", onPeerJoined);
    socket.on("call:peer-left", onPeerLeft);
    socket.on("call:signal", onSignal);
    socket.on("call:error", onError);
    socket.on("call:kicked", onKicked);

    return () => {
      socket.off("call:joined", onJoined);
      socket.off("call:peer-joined", onPeerJoined);
      socket.off("call:peer-left", onPeerLeft);
      socket.off("call:signal", onSignal);
      socket.off("call:error", onError);
      socket.off("call:kicked", onKicked);
    };
  }, [socket, createPeerConnection, handleSignal, hangUp]);

  useEffect(() => {
    return () => {
      hangUp(true);
    };
    // Unmount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    inCall,
    kind,
    muted,
    cameraOff,
    localStream,
    peers,
    error,
    elapsed,
    joinCall,
    hangUp,
    kickParticipant,
    toggleMute,
    toggleCamera,
    clearError,
    setError,
  };
}
