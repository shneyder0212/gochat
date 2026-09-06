const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function randomRoomSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToB64url(bytes);
}

export function readRoomSecret(roomId: string) {
  if (typeof window === "undefined") return "";
  const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("s");
  if (fromHash && fromHash.length >= 16) {
    sessionStorage.setItem(`gochat:secret:${roomId}`, fromHash);
    return fromHash;
  }
  return sessionStorage.getItem(`gochat:secret:${roomId}`) ?? "";
}

export function persistRoomSecret(roomId: string, secret: string) {
  sessionStorage.setItem(`gochat:secret:${roomId}`, secret);
  const url = new URL(window.location.href);
  url.hash = `s=${secret}`;
  history.replaceState(null, "", url.toString());
}

export function ensureRoomSecret(roomId: string) {
  const existing = readRoomSecret(roomId);
  if (existing) {
    persistRoomSecret(roomId, existing);
    return existing;
  }
  const secret = randomRoomSecret();
  persistRoomSecret(roomId, secret);
  return secret;
}

function bytesToB64url(bytes: Uint8Array) {
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "==".slice((value.length * 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function aesKey(secret: string) {
  const raw = b64urlToBytes(secret);
  const hash = await crypto.subtle.digest("SHA-256", raw);
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export type SealedInner = {
  type: "text" | "voice" | "image" | "video" | "file";
  text?: string;
  fileName?: string;
  mimeType?: string;
  file?: Uint8Array;
};

function concat(a: Uint8Array, b: Uint8Array) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

export async function sealMessage(secret: string, inner: SealedInner): Promise<ArrayBuffer> {
  const key = await aesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const meta = encoder.encode(
    JSON.stringify({
      type: inner.type,
      text: inner.text,
      fileName: inner.fileName,
      mimeType: inner.mimeType,
      fileLen: inner.file?.byteLength ?? 0,
    }),
  );
  const metaLen = new Uint8Array(4);
  new DataView(metaLen.buffer).setUint32(0, meta.length, false);
  const plain = concat(concat(metaLen, meta), inner.file ?? new Uint8Array());
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  return concat(iv, new Uint8Array(cipher)).buffer;
}

export async function openMessage(secret: string, payload: ArrayBuffer | Uint8Array): Promise<SealedInner> {
  const key = await aesKey(secret);
  const buf = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const iv = buf.slice(0, 12);
  const cipher = buf.slice(12);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher));
  const metaLen = new DataView(plain.buffer, plain.byteOffset, 4).getUint32(0, false);
  const meta = JSON.parse(decoder.decode(plain.slice(4, 4 + metaLen))) as {
    type: SealedInner["type"];
    text?: string;
    fileName?: string;
    mimeType?: string;
    fileLen?: number;
  };
  const file = meta.fileLen ? plain.slice(4 + metaLen) : undefined;
  return {
    type: meta.type,
    text: meta.text,
    fileName: meta.fileName,
    mimeType: meta.mimeType,
    file,
  };
}
