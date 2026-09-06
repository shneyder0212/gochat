"use client";

import { useSyncExternalStore } from "react";
import { RegisterFlow } from "@/components/auth/register-flow";
import { EmptyChatPane, WhatsAppShell } from "@/components/whatsapp/shell";
import { getProfile, subscribeProfile } from "@/lib/profile";

export function HomeClient() {
  const profile = useSyncExternalStore(subscribeProfile, getProfile, () => null);
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!isClient) {
    return <div className="h-full flex-1 bg-[#111b21]" />;
  }

  if (!profile) {
    return <RegisterFlow onComplete={() => undefined} />;
  }

  return (
    <WhatsAppShell profile={profile}>
      <EmptyChatPane />
    </WhatsAppShell>
  );
}
