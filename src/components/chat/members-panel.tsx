"use client";

import { Ban, PhoneOff, ShieldOff } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import type { Member } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MembersPanel({
  members,
  selfId,
  inCallIds,
  blockedIds,
  isHost,
  onBlock,
  onUnblock,
  onKick,
  className,
}: {
  members: Member[];
  selfId: string;
  inCallIds: string[];
  blockedIds: string[];
  isHost?: boolean;
  onBlock: (userId: string) => void;
  onUnblock: (userId: string) => void;
  onKick?: (userId: string) => void;
  className?: string;
}) {
  return (
    <aside className={cn("flex flex-col bg-[#111b21] text-[#e9edef]", className)}>
      <div className="border-b border-[#222d34] px-4 py-3">
        <p className="text-sm font-semibold">Participantes</p>
        <p className="text-xs text-[#8696a0]">
          {members.length} persona{members.length === 1 ? "" : "s"}. Puedes bloquear a alguien o, si
          eres anfitrión, expulsarlo de la llamada.
        </p>
      </div>
      <ul className="flex-1 space-y-1 overflow-auto p-2">
        {members.map((member) => {
          const calling = inCallIds.includes(member.id);
          const blocked = blockedIds.includes(member.id);
          const mine = member.id === selfId;
          return (
            <li key={member.id} className="rounded-lg px-2 py-2">
              <div className="flex items-center gap-3">
                <UserAvatar name={member.name} color={member.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member.name}
                    {mine ? " (tú)" : ""}
                    {blocked ? " · bloqueado" : ""}
                  </p>
                  <p className="text-xs text-[#8696a0]">{calling ? "en la llamada" : "en el chat"}</p>
                </div>
                <span className={cn("size-2 rounded-full", calling ? "bg-[#00a884]" : "bg-[#3b4a54]")} />
              </div>
              {!mine ? (
                <div className="mt-2 flex flex-wrap gap-1 pl-12">
                  {blocked ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 rounded-full bg-[#202c33] text-xs text-[#e9edef] hover:bg-[#2a3942]"
                      onClick={() => onUnblock(member.id)}
                    >
                      <ShieldOff className="size-3.5" />
                      Desbloquear
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 rounded-full bg-[#202c33] text-xs text-rose-200 hover:bg-[#2a3942]"
                      onClick={() => onBlock(member.id)}
                    >
                      <Ban className="size-3.5" />
                      Bloquear
                    </Button>
                  )}
                  {isHost && calling && onKick ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 rounded-full bg-[#202c33] text-xs text-amber-200 hover:bg-[#2a3942]"
                      onClick={() => onKick(member.id)}
                    >
                      <PhoneOff className="size-3.5" />
                      Expulsar
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
