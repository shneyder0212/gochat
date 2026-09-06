"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Accessibility, LogOut, MessageSquarePlus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { APP_NAME } from "@/lib/constants";
import { randomRoomSecret } from "@/lib/e2e";
import { generateRoomCode } from "@/lib/format";
import {
  isSeniorMode,
  setSeniorMode,
  subscribePrivacy,
} from "@/lib/privacy";
import {
  clearProfile,
  getProfile,
  getSavedChats,
  rememberChat,
  subscribeProfile,
  type Profile,
} from "@/lib/profile";
import { cn } from "@/lib/utils";

function useProfile() {
  return useSyncExternalStore(subscribeProfile, getProfile, () => null);
}

function useChats() {
  return useSyncExternalStore(subscribeProfile, getSavedChats, () => []);
}

export function WhatsAppShell({
  profile,
  activeRoomId,
  children,
}: {
  profile: Profile;
  activeRoomId?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const chats = useChats();
  const senior = useSyncExternalStore(subscribePrivacy, isSeniorMode, () => false);
  const [query, setQuery] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [showJoin, setShowJoin] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((chat) => chat.title.toLowerCase().includes(q) || chat.id.toLowerCase().includes(q));
  }, [chats, query]);

  function openRoom(id: string, title?: string, opts?: { create?: boolean; secret?: string }) {
    const existing = chats.find((chat) => chat.id === id);
    const secret = opts?.secret || existing?.secret || (opts?.create ? randomRoomSecret() : undefined);
    rememberChat({
      id,
      title: title ?? `Grupo ${id}`,
      lastPreview: existing?.lastPreview ?? "Chat de grupo cifrado",
      lastAt: Date.now(),
      secret,
    });
    if (secret) {
      sessionStorage.setItem(`gochat:secret:${id}`, secret);
    }
    router.push(`/r/${id}`);
  }

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-[#0b141a] text-[#e9edef]">
      <aside
        className={cn(
          "flex w-full shrink-0 flex-col border-r border-[#222d34] bg-[#111b21] md:w-[380px]",
          activeRoomId ? "hidden md:flex" : "flex",
        )}
      >
        <header className="flex items-center gap-3 bg-[#202c33] px-4 py-3">
          <UserAvatar name={profile.name} color="#00a884" src={profile.avatar} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{profile.name}</p>
            <p className="truncate text-xs text-[#8696a0]">{profile.phone || APP_NAME}</p>
          </div>
          <button
            type="button"
            className={cn(
              "rounded-full p-2 hover:bg-white/5",
              senior ? "bg-[#00a884]/20 text-[#00a884]" : "text-[#aebac1]",
            )}
            title={senior ? "Desactivar modo senior" : "Activar modo senior"}
            aria-pressed={senior}
            onClick={() => setSeniorMode(!senior)}
          >
            <Accessibility className="size-5" />
            <span className="sr-only">{senior ? "Desactivar modo senior" : "Activar modo senior"}</span>
          </button>
          <button
            type="button"
            className="rounded-full p-2 text-[#aebac1] hover:bg-white/5"
            title="Nuevo grupo"
            onClick={() => openRoom(generateRoomCode(), "Nuevo grupo", { create: true })}
          >
            <MessageSquarePlus className="size-5" />
          </button>
          <button
            type="button"
            className="rounded-full p-2 text-[#aebac1] hover:bg-white/5"
            title="Cerrar sesión"
            onClick={() => {
              clearProfile();
              router.push("/");
            }}
          >
            <LogOut className="size-5" />
          </button>
        </header>

        <div className="bg-[#111b21] px-3 py-2">
          <div className="flex items-center gap-3 rounded-lg bg-[#202c33] px-3">
            <Search className="size-4 text-[#8696a0]" />
            <Input
              type="search"
              enterKeyHint="search"
              inputMode="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={query}
              placeholder="Buscar un chat"
              className="h-11 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 px-3 pb-2">
          <Button
            size="sm"
            className="h-8 flex-1 rounded-full bg-[#00a884] text-[#111b21] hover:bg-[#06cf9c]"
            onClick={() => openRoom(generateRoomCode(), "Nuevo grupo", { create: true })}
          >
            Nuevo grupo
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 rounded-full bg-[#202c33] text-[#e9edef] hover:bg-[#2a3942]"
            onClick={() => setShowJoin((v) => !v)}
          >
            Unirme
          </Button>
        </div>

        {showJoin ? (
          <form
            className="flex gap-2 px-3 pb-2"
            onSubmit={(e) => {
              e.preventDefault();
              const id = joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
              if (id.length < 4) return;
              setJoinCode("");
              setShowJoin(false);
              openRoom(id, `Grupo ${id}`);
            }}
          >
            <Input
              value={joinCode}
              placeholder="Código del grupo"
              enterKeyHint="go"
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className="h-11 bg-[#202c33] font-mono text-base uppercase"
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            <Button type="submit" size="sm" className="h-9 bg-[#00a884] text-[#111b21] hover:bg-[#06cf9c]">
              Ir
            </Button>
          </form>
        ) : null}

        <ul className="min-h-0 flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <li className="px-6 py-10 text-center text-sm text-[#8696a0]">
              No hay chats todavía. Crea un grupo o únete con un código.
            </li>
          ) : (
            filtered.map((chat) => {
              const active = chat.id === activeRoomId;
              return (
                <li key={chat.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-[#222d34] px-3 py-3 text-left hover:bg-[#202c33]",
                      active && "bg-[#2a3942]",
                    )}
                    onClick={() => openRoom(chat.id, chat.title)}
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#00a884]/20 text-[#00a884]">
                      <Users className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">{chat.title}</span>
                        <span className="text-[11px] text-[#8696a0]">
                          {new Date(chat.lastAt).toLocaleTimeString("es", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-[#8696a0]">
                        {chat.lastPreview}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </aside>

      <section className={cn("min-w-0 flex-1 flex-col", activeRoomId ? "flex" : "hidden md:flex")}>
        {children}
      </section>
    </div>
  );
}

export function EmptyChatPane() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#222e35] px-8 text-center">
      <div className="mb-6 flex size-24 items-center justify-center rounded-full bg-[#00a884]/10">
        <Users className="size-12 text-[#00a884]" />
      </div>
      <h2 className="text-3xl font-light text-[#e9edef]">{APP_NAME} Web</h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-[#8696a0]">
      Selecciona un grupo a la izquierda o crea uno nuevo. Los mensajes van cifrados, y puedes hacer
      llamadas o videollamadas grupales. Quien sale por su cuenta puede volver a entrar.
      </p>
      <p className="mt-8 text-xs text-[#667781]">Tus chats de grupo se guardan en este dispositivo.</p>
    </div>
  );
}

export function useLiveProfile() {
  return useProfile();
}
