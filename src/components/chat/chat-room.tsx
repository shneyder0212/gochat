"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  LoaderCircle,
  MoreVertical,
  Phone,
  PhoneIncoming,
  ShieldAlert,
  Video,
} from "lucide-react";
import { RegisterFlow } from "@/components/auth/register-flow";
import { CallOverlay } from "@/components/chat/call-overlay";
import { Composer } from "@/components/chat/composer";
import { MembersPanel } from "@/components/chat/members-panel";
import { MessageBubble } from "@/components/chat/message-bubble";
import { UserAvatar } from "@/components/user-avatar";
import { WhatsAppShell } from "@/components/whatsapp/shell";
import { Button } from "@/components/ui/button";
import { useCall } from "@/hooks/useCall";
import { MAX_FILE_SIZE } from "@/lib/constants";
import { ensureRoomSecret, openMessage, persistRoomSecret, sealMessage, type SealedInner } from "@/lib/e2e";
import { inspectFile } from "@/lib/file-guard";
import { fileKind } from "@/lib/format";
import {
  applySeniorClass,
  blockUser,
  getBlockedIds,
  subscribePrivacy,
  unblockUser,
} from "@/lib/privacy";
import {
  getOrCreateUserId,
  getProfile,
  getSavedChats,
  rememberChat,
  subscribeProfile,
} from "@/lib/profile";
import { inspectText, type ScamVerdict } from "@/lib/scam-shield";
import { getSocket } from "@/lib/socket";
import type { CallState, ChatMessage, JoinAck, MediaKind, Member } from "@/lib/types";

function payloadToBytes(payload: ChatMessage["payload"]): Uint8Array | null {
  if (!payload) return null;
  if (payload instanceof Uint8Array) return payload;
  return new Uint8Array(payload);
}

function hydrateMessage(raw: ChatMessage): ChatMessage {
  const message = { ...raw };
  const bytes = payloadToBytes(raw.payload);
  if (bytes && !message.objectUrl && raw.type !== "sealed") {
    const blob = new Blob([new Uint8Array(bytes)], { type: raw.mimeType || "application/octet-stream" });
    message.objectUrl = URL.createObjectURL(blob);
  }
  return message;
}

async function unseal(raw: ChatMessage, secret: string): Promise<ChatMessage> {
  if (raw.type !== "sealed" || !raw.payload || !secret) {
    return { ...hydrateMessage(raw), locked: raw.type === "sealed" };
  }
  try {
    const bytes = payloadToBytes(raw.payload) ?? new Uint8Array();
    const inner = await openMessage(secret, bytes);
    if (inner.file && inner.fileName) {
      const inspected = inspectFile(
        inner.file,
        inner.fileName,
        inner.mimeType || "",
        inner.type === "text" ? undefined : inner.type,
      );
      if (!inspected.ok) {
        return {
          ...raw,
          type: "system",
          text: `Archivo bloqueado por seguridad: ${inspected.reason}`,
          locked: false,
        };
      }
    }
    const objectUrl = inner.file
      ? URL.createObjectURL(
          new Blob([new Uint8Array(inner.file)], { type: inner.mimeType || "application/octet-stream" }),
        )
      : undefined;
    return {
      ...raw,
      type: inner.type,
      text: inner.text,
      fileName: inner.fileName,
      mimeType: inner.mimeType,
      fileSize: inner.file?.byteLength,
      objectUrl,
      locked: false,
    };
  } catch {
    return { ...raw, locked: true };
  }
}

function previewOf(message: ChatMessage) {
  if (message.locked) return "Mensaje cifrado";
  if (message.type === "text" || message.type === "system") return message.text || "";
  if (message.type === "image") return "Foto";
  if (message.type === "video") return "Video";
  if (message.type === "voice") return "Nota de voz";
  return message.fileName || "Archivo";
}

export function ChatRoom({ roomId }: { roomId: string }) {
  const router = useRouter();
  const profile = useSyncExternalStore(subscribeProfile, getProfile, () => null);
  const [connected, setConnected] = useState(false);
  const [self, setSelf] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [callState, setCallState] = useState<CallState | null>(null);
  const [typingIds, setTypingIds] = useState<string[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [scam, setScam] = useState<ScamVerdict | null>(null);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const urlsRef = useRef<string[]>([]);
  const secretRef = useRef("");
  const rootRef = useRef<HTMLDivElement>(null);
  const blockedRef = useRef<string[]>([]);

  const blockedIds = useSyncExternalStore(subscribePrivacy, getBlockedIds, () => [] as string[]);

  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const socket = isClient ? getSocket() : null;
  const readyName = profile?.name.trim() ?? "";

  const call = useCall({ socket, selfId: self?.id ?? "", members });
  const { error: callError, clearError: clearCallError } = call;

  const inCallIds = callState?.participantIds ?? [];
  const kicked = Boolean(self && callState?.kickedIds?.includes(self.id));
  const canJoinCall = Boolean(
    callState && self && !inCallIds.includes(self.id) && !call.inCall && !kicked,
  );
  const isHost = Boolean(self && callState?.initiatedBy === self.id && call.inCall);

  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (m) => m.senderId === self?.id || m.type === "system" || !blockedIds.includes(m.senderId),
      ),
    [messages, blockedIds, self?.id],
  );

  const typingLabel = useMemo(() => {
    const names = members
      .filter((m) => typingIds.includes(m.id) && m.id !== self?.id && !blockedIds.includes(m.id))
      .map((m) => m.name);
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} está escribiendo…`;
    return `${names.slice(0, 2).join(" y ")} están escribiendo…`;
  }, [members, typingIds, self?.id, blockedIds]);

  useEffect(() => {
    blockedRef.current = blockedIds;
  }, [blockedIds]);

  useEffect(() => {
    applySeniorClass();
    const saved = getSavedChats().find((chat) => chat.id === roomId)?.secret;
    if (saved) persistRoomSecret(roomId, saved);
    secretRef.current = ensureRoomSecret(roomId);
  }, [roomId]);

  useEffect(() => {
    socket?.emit("privacy:blocks", { ids: blockedIds });
  }, [socket, blockedIds]);

  useEffect(() => {
    if (!readyName || !socket) return;

    const join = () => {
      socket.emit("join", {
        roomId,
        name: readyName,
        userId: profile?.userId || getOrCreateUserId(),
      });
    };

    const onConnect = () => {
      setConnected(true);
      join();
    };
    const onDisconnect = () => setConnected(false);

    const savePreview = (opened: ChatMessage[]) => {
      const last = opened.at(-1);
      rememberChat({
        id: roomId,
        title: `Grupo ${roomId}`,
        lastPreview: last ? previewOf(last) : "Grupo cifrado de GoChat",
        lastAt: last?.timestamp ?? Date.now(),
        secret: secretRef.current,
      });
    };

    const onJoined = (ack: JoinAck) => {
      setSelf(ack.self);
      setMembers(ack.members);
      setCallState(ack.call);
      const secret = secretRef.current;
      void (async () => {
        const opened = await Promise.all(ack.messages.map((msg) => unseal(msg, secret)));
        setMessages((prev) => {
          prev.forEach((m) => m.objectUrl && URL.revokeObjectURL(m.objectUrl));
          urlsRef.current = opened.map((m) => m.objectUrl).filter(Boolean) as string[];
          return opened;
        });
        savePreview(opened);
      })();
    };

    const onMembers = (list: Member[]) => setMembers(list);

    const onMessage = (msg: ChatMessage) => {
      void unseal(msg, secretRef.current).then((hydrated) => {
        if (
          hydrated.senderId !== "system" &&
          blockedRef.current.includes(hydrated.senderId)
        ) {
          return;
        }
        if (hydrated.objectUrl) urlsRef.current.push(hydrated.objectUrl);
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          const next = [...prev, hydrated];
          savePreview(next);
          return next;
        });
      });
    };

    const onTyping = (payload: { userId: string; typing: boolean }) => {
      setTypingIds((prev) => {
        if (payload.typing) return prev.includes(payload.userId) ? prev : [...prev, payload.userId];
        return prev.filter((id) => id !== payload.userId);
      });
    };

    const onCallState = (state: CallState | null) => setCallState(state);
    const onJoinError = (payload: { message: string }) => setBanner(payload.message);
    const onChatError = (payload: { message: string }) => setBanner(payload.message);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("joined", onJoined);
    socket.on("members", onMembers);
    socket.on("message", onMessage);
    socket.on("typing", onTyping);
    socket.on("call:state", onCallState);
    socket.on("join:error", onJoinError);
    socket.on("chat:error", onChatError);

    const start = () => {
      if (socket.connected) onConnect();
      else socket.connect();
    };
    queueMicrotask(start);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("joined", onJoined);
      socket.off("members", onMembers);
      socket.off("message", onMessage);
      socket.off("typing", onTyping);
      socket.off("call:state", onCallState);
      socket.off("join:error", onJoinError);
      socket.off("chat:error", onChatError);
    };
  }, [socket, readyName, roomId, profile?.userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages.length, typingLabel]);

  useEffect(() => {
    return () => {
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (!banner && !callError) return;
    const t = window.setTimeout(() => {
      setBanner(null);
      clearCallError();
    }, 5000);
    return () => window.clearTimeout(t);
  }, [banner, callError, clearCallError]);

  async function emitSealed(inner: SealedInner) {
    if (!socket) return;
    const secret = secretRef.current;
    if (!secret) {
      setBanner("Falta la clave del grupo. Comparte el enlace completo (con #s=) para cifrar.");
      return;
    }
    const payload = await sealMessage(secret, inner);
    socket.emit("message", {
      id: crypto.randomUUID(),
      type: "sealed",
      payload,
    });
  }

  async function trySendText(text: string) {
    const verdict = inspectText(text);
    if (verdict) {
      setPendingText(text);
      setScam(verdict);
      return;
    }
    await emitSealed({ type: "text", text });
  }

  async function sendFile(file: File, kind: "image" | "video" | "voice" | "file") {
    if (file.size > MAX_FILE_SIZE) {
      setBanner("El archivo supera el límite de 8 MB.");
      return;
    }
    const buffer = await file.arrayBuffer();
    const inspected = inspectFile(buffer, file.name, file.type, kind);
    if (!inspected.ok) {
      setBanner(inspected.reason);
      return;
    }
    await emitSealed({
      type: inspected.kind,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      file: new Uint8Array(buffer),
    });
  }

  async function copyLink() {
    try {
      const secret = secretRef.current || ensureRoomSecret(roomId);
      const url = new URL(window.location.href);
      url.hash = `s=${secret}`;
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setBanner("No se pudo copiar el enlace. Cópialo de la barra del navegador (incluye #s=).");
    }
  }

  async function startCall(kind: MediaKind) {
    try {
      await call.joinCall(kind);
    } catch {
      /* error already set */
    }
  }

  if (!isClient) {
    return <div className="h-full flex-1 bg-[#111b21]" />;
  }

  if (!profile) {
    return <RegisterFlow onComplete={() => router.refresh()} />;
  }

  return (
    <WhatsAppShell profile={profile} activeRoomId={roomId}>
      <div
        ref={rootRef}
        className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#0b141a]"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (!file || !self) return;
          void sendFile(file, fileKind(file.type, file.name));
        }}
      >
        <header className="flex items-center gap-2 bg-[#202c33] px-2 py-2 sm:px-4">
          <Link
            href="/"
            className="rounded-full p-2 text-[#aebac1] hover:bg-white/5 md:hidden"
            aria-label="Chats"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <button type="button" className="flex min-w-0 flex-1 items-center gap-3" onClick={() => setMembersOpen(true)}>
            <UserAvatar name={`Grupo ${roomId}`} color="#00a884" />
            <span className="min-w-0 text-left">
              <span className="block truncate text-[16px] font-medium leading-5">Grupo {roomId}</span>
              <span className="block truncate text-[13px] text-[#8696a0]">
                {connected
                  ? members.map((m) => (m.id === self?.id ? "Tú" : m.name)).join(", ") || "tocar para info del grupo"
                  : "conectando…"}
              </span>
            </span>
          </button>
          <button
            type="button"
            className="rounded-full p-2 text-[#aebac1] hover:bg-white/5 disabled:opacity-40"
            disabled={!self || call.inCall}
            onClick={() => void startCall("video")}
            aria-label="Videollamada"
          >
            <Video className="size-5" />
          </button>
          <button
            type="button"
            className="rounded-full p-2 text-[#aebac1] hover:bg-white/5 disabled:opacity-40"
            disabled={!self || call.inCall}
            onClick={() => void startCall("audio")}
            aria-label="Llamada"
          >
            <Phone className="size-5" />
          </button>
          <button
            type="button"
            className="rounded-full p-2 text-[#aebac1] hover:bg-white/5"
            onClick={() => void copyLink()}
            aria-label="Copiar enlace"
          >
            {copied ? <Check className="size-5 text-[#00a884]" /> : <Copy className="size-5" />}
          </button>
          <button
            type="button"
            className="rounded-full p-2 text-[#aebac1] hover:bg-white/5"
            onClick={() => setMembersOpen(true)}
            aria-label="Más"
          >
            <MoreVertical className="size-5" />
          </button>
        </header>

        {canJoinCall ? (
          <div className="flex items-center gap-3 bg-[#182229] px-4 py-2 text-sm">
            <PhoneIncoming className="size-4 text-[#00a884]" />
            <span className="flex-1">
              {inCallIds.length > 0
                ? "La llamada sigue activa. Puedes volver a entrar."
                : `${callState?.initiatedByName} inició una ${
                    callState?.kind === "video" ? "videollamada" : "llamada"
                  }`}
            </span>
            <button
              type="button"
              className="rounded-full bg-[#00a884] px-3 py-1 text-xs font-semibold text-[#111b21]"
              onClick={() => void startCall(callState?.kind ?? "video")}
            >
              {inCallIds.length > 0 ? "Volver" : "Unirme"}
            </button>
          </div>
        ) : null}

        {kicked && !call.inCall ? (
          <div className="flex items-center gap-3 bg-[#542c2e] px-4 py-2 text-sm text-[#ffd6d6]">
            Te expulsaron de esta llamada. Podrás entrar en la siguiente si no te expulsan.
          </div>
        ) : null}

        {(banner || callError) && (
          <div className="bg-[#542c2e] px-4 py-2 text-sm text-[#ffd6d6]" role="alert">
            {banner || callError}
          </div>
        )}

        <div className="relative min-h-0 flex-1">
          <div className="wa-wallpaper pointer-events-none absolute inset-0" />

          {readyName.length >= 2 && !self ? (
            <div className="relative flex h-full flex-col items-center justify-center gap-3 text-sm text-[#8696a0]">
              <LoaderCircle className="size-6 animate-spin text-[#00a884]" />
              Entrando al grupo…
            </div>
          ) : (
            <div className="relative h-full overflow-auto">
              <div className="space-y-1 px-3 py-3 sm:px-8">
                {visibleMessages.length === 0 ? (
                  <div className="flex justify-center pt-8">
                    <p className="max-w-sm rounded-md bg-[#182229] px-3 py-2 text-center text-[13px] text-[#ffd279]">
                      Chat cifrado de extremo a extremo. Invita con el enlace completo (botón copiar). Los
                      mensajes se quedan mientras haya gente conectada.
                    </p>
                  </div>
                ) : null}
                {visibleMessages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    mine={message.senderId === self?.id}
                  />
                ))}
                {typingLabel ? (
                  <p className="px-2 pt-1 text-xs italic text-[#8696a0]">{typingLabel}</p>
                ) : null}
                <div ref={bottomRef} />
              </div>
            </div>
          )}

          {call.inCall && self ? (
            <CallOverlay
              kind={call.kind}
              localStream={call.localStream}
              peers={call.peers}
              members={members}
              selfName={self.name}
              selfColor={self.color}
              muted={call.muted}
              cameraOff={call.cameraOff}
              elapsed={call.elapsed}
              isHost={isHost}
              onToggleMute={call.toggleMute}
              onToggleCamera={call.toggleCamera}
              onHangUp={() => call.hangUp(true)}
              onKick={call.kickParticipant}
            />
          ) : null}
        </div>

        <Composer
          disabled={!self || !connected}
          onSendText={(text) => void trySendText(text)}
          onSendFile={sendFile}
          onTyping={(typing) => socket?.emit("typing", { typing })}
          onError={setBanner}
        />

        {membersOpen ? (
          <div className="absolute inset-0 z-20 flex">
            <button className="flex-1 bg-black/50" onClick={() => setMembersOpen(false)} aria-label="Cerrar" />
            <MembersPanel
              members={members}
              selfId={self?.id ?? ""}
              inCallIds={inCallIds}
              blockedIds={blockedIds}
              isHost={isHost}
              onBlock={blockUser}
              onUnblock={unblockUser}
              onKick={isHost ? call.kickParticipant : undefined}
              className="flex h-full w-80 border-l border-[#222d34] bg-[#111b21]"
            />
          </div>
        ) : null}

        {scam && pendingText ? (
          <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
            <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#202c33] p-5 shadow-xl">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-400">
                <ShieldAlert className="size-4" />
                Escudo antiestafas
              </p>
              <h2 className="mt-2 text-lg font-semibold">{scam.title}</h2>
              <p className="mt-2 text-sm text-[#8696a0]">{scam.detail}</p>
              <p className="mt-3 rounded-lg bg-black/30 p-3 text-sm text-[#e9edef]">{pendingText}</p>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  className="border-white/10 bg-transparent"
                  onClick={() => {
                    setPendingText(null);
                    setScam(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="bg-amber-500 text-black hover:bg-amber-400"
                  onClick={() => {
                    const t = pendingText;
                    setPendingText(null);
                    setScam(null);
                    if (t) void emitSealed({ type: "text", text: t });
                  }}
                >
                  Enviar igual
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </WhatsAppShell>
  );
}
