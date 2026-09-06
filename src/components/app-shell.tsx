"use client";

import { useAppViewport } from "@/hooks/useAppViewport";

export function AppShell({ children }: { children: React.ReactNode }) {
  useAppViewport();
  return <div className="app-root">{children}</div>;
}
