const BLOCKS_KEY = "gochat:blocked";
const SENIOR_KEY = "gochat:senior";
const PRIVACY_EVENT = "gochat:privacy";

function emit() {
  window.dispatchEvent(new Event(PRIVACY_EVENT));
}

export function subscribePrivacy(onChange: () => void) {
  window.addEventListener(PRIVACY_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PRIVACY_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function getBlockedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(BLOCKS_KEY) || "[]") as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isBlocked(userId: string) {
  return getBlockedIds().includes(userId);
}

export function blockUser(userId: string) {
  const next = Array.from(new Set([...getBlockedIds(), userId]));
  localStorage.setItem(BLOCKS_KEY, JSON.stringify(next));
  emit();
}

export function unblockUser(userId: string) {
  localStorage.setItem(BLOCKS_KEY, JSON.stringify(getBlockedIds().filter((id) => id !== userId)));
  emit();
}

export function isSeniorMode() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SENIOR_KEY) === "1";
}

export function setSeniorMode(on: boolean) {
  localStorage.setItem(SENIOR_KEY, on ? "1" : "0");
  document.documentElement.classList.toggle("senior", on);
  emit();
}

export function applySeniorClass() {
  if (typeof window === "undefined") return;
  document.documentElement.classList.toggle("senior", isSeniorMode());
}
