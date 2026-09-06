"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { formatDuration } from "@/lib/format";
import type { Member, MediaKind } from "@/lib/types";
import type { RemotePeer } from "@/hooks/useCall";
import { cn } from "@/lib/utils";

function VideoTile({
  stream,
  muted,
  name,
  color,
  cameraOff,
  mine,
  state,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  name: string;
  color: string;
  cameraOff?: boolean;
  mine?: boolean;
  state?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
  }, [stream]);

  const showVideo = Boolean(stream && !cameraOff && stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live"));

  return (
    <div className="relative min-h-40 overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-white/10">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={cn("size-full object-cover", showVideo ? "opacity-100" : "opacity-0")}
      />
      {!showVideo ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <UserAvatar name={name} color={color} size="lg" />
          <p className="text-sm font-medium">{mine ? "Tú" : name}</p>
        </div>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-xs">
        <span className="font-medium">{mine ? "Tú" : name}</span>
        {state && state !== "connected" ? (
          <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">
            {state === "connecting" || state === "checking" || state === "new"
              ? "Conectando"
              : state === "failed" || state === "disconnected"
                ? "Sin conexión"
                : state}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function CallOverlay({
  kind,
  localStream,
  peers,
  members,
  selfName,
  selfColor,
  muted,
  cameraOff,
  elapsed,
  isHost,
  onToggleMute,
  onToggleCamera,
  onHangUp,
  onKick,
}: {
  kind: MediaKind;
  localStream: MediaStream | null;
  peers: RemotePeer[];
  members: Member[];
  selfName: string;
  selfColor: string;
  muted: boolean;
  cameraOff: boolean;
  elapsed: number;
  isHost?: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onHangUp: () => void;
  onKick?: (userId: string) => void;
}) {
  const count = peers.length + 1;
  const cols =
    count === 1 ? "grid-cols-1" : count === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-zinc-950/95 p-3 sm:p-5">
      <div className="mb-3 flex items-center justify-between text-sm">
        <div>
          <p className="font-semibold">{kind === "video" ? "Videollamada grupal" : "Llamada grupal"}</p>
          <p className="text-xs text-muted-foreground">{formatDuration(elapsed)}</p>
        </div>
        <p className="text-xs text-muted-foreground">{count} en la llamada</p>
      </div>

      <div className={cn("grid min-h-0 flex-1 gap-3 overflow-auto", cols)}>
        <VideoTile
          stream={localStream}
          muted
          name={selfName}
          color={selfColor}
          cameraOff={cameraOff || kind === "audio"}
          mine
        />
        {peers.map((peer) => {
          const member = members.find((m) => m.id === peer.id);
          return (
            <div key={peer.id} className="relative">
              <VideoTile
                stream={peer.stream}
                name={member?.name ?? peer.name}
                color={member?.color ?? "#64748b"}
                cameraOff={kind === "audio"}
                state={peer.connectionState}
              />
              {isHost && onKick ? (
                <button
                  type="button"
                  className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-[11px] text-rose-200"
                  onClick={() => onKick(peer.id)}
                >
                  Expulsar
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mx-auto mt-2 grid w-full max-w-64 shrink-0 grid-flow-col auto-cols-fr items-center gap-2 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:mt-4 sm:max-w-72 sm:gap-3">
        <Button
          size="icon-lg"
          variant={muted ? "destructive" : "secondary"}
          className="size-11 justify-self-center rounded-full sm:size-12"
          onClick={onToggleMute}
        >
          {muted ? <MicOff /> : <Mic />}
          <span className="sr-only">{muted ? "Activar micrófono" : "Silenciar"}</span>
        </Button>
        {kind === "video" ? (
          <Button
            size="icon-lg"
            variant={cameraOff ? "destructive" : "secondary"}
            className="size-11 justify-self-center rounded-full sm:size-12"
            onClick={onToggleCamera}
          >
            {cameraOff ? <VideoOff /> : <Video />}
            <span className="sr-only">{cameraOff ? "Encender cámara" : "Apagar cámara"}</span>
          </Button>
        ) : null}
        <Button
          size="icon-lg"
          variant="destructive"
          className="size-11 justify-self-center rounded-full bg-rose-600 text-white hover:bg-rose-500 sm:size-12"
          onClick={onHangUp}
        >
          <PhoneOff />
          <span className="sr-only">Colgar</span>
        </Button>
      </div>
    </div>
  );
}
