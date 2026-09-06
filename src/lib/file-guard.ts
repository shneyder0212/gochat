const DANGEROUS_EXT = new Set([
  "exe", "bat", "cmd", "com", "scr", "pif", "msi", "dll", "js", "mjs", "cjs",
  "vbs", "vbe", "wsf", "wsh", "ps1", "jar", "apk", "ipa", "html", "htm", "svg",
  "xhtml", "hta", "iso", "img", "dmg", "sh", "bash", "zsh", "php", "asp", "aspx",
]);

const MAGIC = {
  pdf: [0x25, 0x50, 0x44, 0x46],
  png: [0x89, 0x50, 0x4e, 0x47],
  jpg: [0xff, 0xd8, 0xff],
  gif: [0x47, 0x49, 0x46, 0x38],
  webp: [0x52, 0x49, 0x46, 0x46],
  zip: [0x50, 0x4b, 0x03, 0x04],
  mz: [0x4d, 0x5a],
  elf: [0x7f, 0x45, 0x4c, 0x46],
} as const;

export type GuardKind = "image" | "video" | "voice" | "file";

export type GuardResult =
  | { ok: true; kind: GuardKind }
  | { ok: false; reason: string };

function bytesStartWith(buf: Uint8Array, sig: readonly number[]) {
  if (buf.length < sig.length) return false;
  return sig.every((b, i) => buf[i] === b);
}

function extOf(name: string) {
  const parts = name.toLowerCase().split(".");
  if (parts.length < 2) return "";
  return parts[parts.length - 1].replace(/[^a-z0-9]/g, "");
}

function hasDoubleDangerousExtension(name: string) {
  const parts = name.toLowerCase().split(".").filter(Boolean);
  if (parts.length < 3) return false;
  return parts.slice(0, -1).some((part) => DANGEROUS_EXT.has(part) || part === "pdf");
}

function asciiSlice(buf: Uint8Array, max = 512_000) {
  const end = Math.min(buf.length, max);
  let out = "";
  for (let i = 0; i < end; i++) {
    const c = buf[i];
    out += c >= 32 && c < 127 ? String.fromCharCode(c) : " ";
  }
  return out;
}

export function inspectFile(
  data: ArrayBuffer | Uint8Array,
  fileName: string,
  mimeType: string,
  claimed?: GuardKind,
): GuardResult {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const name = fileName || "archivo";
  const ext = extOf(name);
  const mime = (mimeType || "").toLowerCase();

  if (hasDoubleDangerousExtension(name)) {
    return { ok: false, reason: "Nombre de archivo camuflado (doble extensión). Bloqueado." };
  }
  if (DANGEROUS_EXT.has(ext)) {
    return { ok: false, reason: `No se permiten archivos .${ext}: pueden ejecutar código.` };
  }
  if (bytesStartWith(buf, MAGIC.mz) || bytesStartWith(buf, MAGIC.elf)) {
    return { ok: false, reason: "El archivo es un ejecutable. GoChat lo bloqueó." };
  }

  const looksPdf = bytesStartWith(buf, MAGIC.pdf) || ext === "pdf" || mime.includes("pdf");
  if (looksPdf) {
    if (!bytesStartWith(buf, MAGIC.pdf)) {
      return { ok: false, reason: "Dice ser PDF pero no empieza por %PDF. Posible archivo camuflado." };
    }
    if (bytesStartWith(buf, MAGIC.mz) || bytesStartWith(buf, MAGIC.zip)) {
      return { ok: false, reason: "PDF políglota (también es ZIP/EXE). Bloqueado." };
    }
    const body = asciiSlice(buf);
    if (
      /\/JavaScript|\/JS\b|\/Launch|\/EmbeddedFile|\/OpenAction|\/RichMedia/i.test(body) ||
      /<html|javascript:|data:application\/javascript/i.test(body)
    ) {
      return { ok: false, reason: "PDF con scripts o acciones automáticas. Bloqueado para evitar engaños." };
    }
    if (claimed && claimed !== "file") {
      return { ok: false, reason: "Un PDF no puede enviarse como foto o video." };
    }
    return { ok: true, kind: "file" };
  }

  if (ext === "pdf" || mime.includes("pdf")) {
    return { ok: false, reason: "Extensión PDF sin cabecera real. Bloqueado." };
  }

  const isImage =
    bytesStartWith(buf, MAGIC.png) ||
    bytesStartWith(buf, MAGIC.jpg) ||
    bytesStartWith(buf, MAGIC.gif) ||
    (bytesStartWith(buf, MAGIC.webp) && buf.length > 11);
  const isAudio = mime.startsWith("audio/") || ["webm", "ogg", "mp3", "wav", "m4a"].includes(ext);
  const isVideo = mime.startsWith("video/") || ["mp4", "webm", "mov", "m4v"].includes(ext);

  if (claimed === "image" && !isImage) {
    return { ok: false, reason: "Eso no es una imagen real. Se bloqueó por si iba camuflada." };
  }
  if (claimed === "video" && !isVideo && !mime.startsWith("video/")) {
    return { ok: false, reason: "Eso no parece un video válido." };
  }

  if (isImage) return { ok: true, kind: "image" };
  if (claimed === "voice" || isAudio) return { ok: true, kind: "voice" };
  if (claimed === "video" || isVideo) return { ok: true, kind: "video" };
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "odt"].includes(ext) || bytesStartWith(buf, MAGIC.zip)) {
    return { ok: true, kind: "file" };
  }
  if (claimed === "file") return { ok: true, kind: "file" };
  return { ok: false, reason: "Tipo de archivo no permitido." };
}
