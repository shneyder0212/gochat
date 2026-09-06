"use client";

import { useEffect } from "react";

function syncAppViewport() {
  const root = document.documentElement;
  const vv = window.visualViewport;
  const height = Math.round(vv?.height ?? window.innerHeight);
  const top = Math.round(vv?.offsetTop ?? 0);
  root.style.setProperty("--app-h", `${height}px`);
  root.style.setProperty("--app-top", `${top}px`);
}

export function useAppViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    const onBlur = () => window.setTimeout(syncAppViewport, 80);
    vv?.addEventListener("resize", syncAppViewport);
    vv?.addEventListener("scroll", syncAppViewport);
    window.addEventListener("resize", syncAppViewport);
    window.addEventListener("orientationchange", syncAppViewport);
    window.addEventListener("focusin", syncAppViewport);
    window.addEventListener("focusout", onBlur);
    syncAppViewport();
    return () => {
      vv?.removeEventListener("resize", syncAppViewport);
      vv?.removeEventListener("scroll", syncAppViewport);
      window.removeEventListener("resize", syncAppViewport);
      window.removeEventListener("orientationchange", syncAppViewport);
      window.removeEventListener("focusin", syncAppViewport);
      window.removeEventListener("focusout", onBlur);
    };
  }, []);
}
