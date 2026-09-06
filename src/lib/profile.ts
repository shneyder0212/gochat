import {
  CHATS_STORAGE_KEY,
  MAX_NAME_LENGTH,
  PROFILE_EVENT,
  PROFILE_STORAGE_KEY,
} from "@/lib/constants";

export type Profile = {
  userId: string;
  name: string;
  phone: string;
  countryCode: string;
  avatar?: string;
};

export type SavedChat = {
  id: string;
  title: string;
  lastPreview: string;
  lastAt: number;
  secret?: string;
};

function emitProfile() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PROFILE_EVENT));
}

let cachedProfileRaw: string | null | undefined;
let cachedProfile: Profile | null = null;
let cachedChatsRaw: string | null | undefined;
let cachedChats: SavedChat[] = [];

export function getProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (raw === cachedProfileRaw) return cachedProfile;
  cachedProfileRaw = raw;
  try {
    if (!raw) {
      cachedProfile = null;
      return null;
    }
    const parsed = JSON.parse(raw) as Profile;
    cachedProfile = parsed?.userId && parsed?.name ? parsed : null;
    return cachedProfile;
  } catch {
    cachedProfile = null;
    return null;
  }
}

export function saveProfile(profile: Profile) {
  cachedProfileRaw = undefined;
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  emitProfile();
}

export function clearProfile() {
  cachedProfileRaw = undefined;
  localStorage.removeItem(PROFILE_STORAGE_KEY);
  emitProfile();
}

export function subscribeProfile(onStoreChange: () => void) {
  window.addEventListener(PROFILE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(PROFILE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function getOrCreateUserId() {
  const existing = getProfile();
  if (existing?.userId) return existing.userId;
  return crypto.randomUUID();
}

export function getStoredName() {
  return getProfile()?.name ?? "";
}

export function storeName(name: string) {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  const current = getProfile();
  if (current) {
    saveProfile({ ...current, name: trimmed });
    return;
  }
  saveProfile({
    userId: crypto.randomUUID(),
    name: trimmed,
    phone: "",
    countryCode: "+52",
  });
}

export function getSavedChats(): SavedChat[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(CHATS_STORAGE_KEY);
  if (raw === cachedChatsRaw) return cachedChats;
  cachedChatsRaw = raw;
  try {
    if (!raw) {
      cachedChats = [];
      return cachedChats;
    }
    const parsed = JSON.parse(raw) as SavedChat[];
    cachedChats = Array.isArray(parsed) ? parsed : [];
    return cachedChats;
  } catch {
    cachedChats = [];
    return cachedChats;
  }
}

export function rememberChat(chat: SavedChat) {
  const previous = getSavedChats().find((item) => item.id === chat.id);
  const next: SavedChat = {
    ...chat,
    secret: chat.secret || previous?.secret,
  };
  const chats = getSavedChats().filter((item) => item.id !== chat.id);
  chats.unshift(next);
  cachedChatsRaw = undefined;
  localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats.slice(0, 40)));
  emitProfile();
}

export function formatPhone(countryCode: string, national: string) {
  const digits = national.replace(/\D/g, "");
  return `${countryCode} ${digits}`.trim();
}
