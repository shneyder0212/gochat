"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  FileText,
  ImageIcon,
  Mic,
  Paperclip,
  SendHorizontal,
  Smile,
  Square,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_FILE_SIZE, MAX_TEXT_LENGTH } from "@/lib/constants";
import { formatDuration } from "@/lib/format";
import { inspectFile } from "@/lib/file-guard";

type ComposerProps = {
  disabled?: boolean;
  onSendText: (text: string) => void;
  onSendFile: (file: File, kind: "image" | "video" | "voice" | "file") => void;
  onTyping: (typing: boolean) => void;
  onError: (message: string) => void;
};

const EMOJIS = [
  "😀", "😂", "😍", "🥰", "👍", "🙏", "🔥", "🎉", "❤️", "😊",
  "😎", "😭", "🤔", "👏", "🙌", "💯", "✨", "😅", "🤝", "💪",
  "✅", "❌", "📱", "📷", "🎤", "📎", "📄", "🔒", "⚠️", "🟢",
];

function pickAudioMime() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function Composer({ disabled, onSendText, onSendFile, onTyping, onError }: ComposerProps) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [attachOpen, setAttachOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const typingTimeout = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopTracks();
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!attachOpen && !emojiOpen) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (attachOpen && !attachRef.current?.contains(target)) {
        setAttachOpen(false);
      }
      if (emojiOpen && !(event.target as HTMLElement).closest("[data-emoji-root]")) {
        setEmojiOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [attachOpen, emojiOpen]);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function emitTyping(next: boolean) {
    onTyping(next);
    if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
    if (next) {
      typingTimeout.current = window.setTimeout(() => onTyping(false), 1500);
    }
  }

  function submitText() {
    const value = text.trim();
    if (!value) return;
    onSendText(value);
    setText("");
    emitTyping(false);
  }

  function onComposerKey(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const native = event.nativeEvent;
    if (native.isComposing || event.key === "Process" || event.keyCode === 229) return;
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    submitText();
  }

  async function handleFiles(list: FileList | null, forceKind?: "image" | "video" | "file") {
    if (!list?.[0]) return;
    const file = list[0];
    if (file.size > MAX_FILE_SIZE) {
      onError("El archivo supera el límite de 8 MB.");
      return;
    }
    const buffer = await file.arrayBuffer();
    const inspected = inspectFile(buffer, file.name, file.type, forceKind);
    if (!inspected.ok) {
      onError(inspected.reason);
      return;
    }
    onSendFile(file, inspected.kind);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickAudioMime();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stopTracks();
        void (async () => {
          if (blob.size > 0 && blob.size <= MAX_FILE_SIZE) {
            const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
            const file = new File([blob], `nota-de-voz.${ext}`, { type: blob.type });
            const inspected = inspectFile(await file.arrayBuffer(), file.name, file.type, "voice");
            if (!inspected.ok) onError(inspected.reason);
            else onSendFile(file, "voice");
          } else if (blob.size > MAX_FILE_SIZE) {
            onError("La nota de voz es demasiado larga (máximo 8 MB).");
          }
        })();
      };
      recorderRef.current = recorder;
      recorder.start(200);
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      onError("No se pudo usar el micrófono para la nota de voz.");
    }
  }

  function finishRecording(send: boolean) {
    const recorder = recorderRef.current;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setRecording(false);
    setSeconds(0);
    if (!recorder) {
      stopTracks();
      return;
    }
    if (!send) {
      recorder.onstop = () => stopTracks();
    }
    if (recorder.state !== "inactive") recorder.stop();
    recorderRef.current = null;
  }

  return (
    <form
      className="bg-[#202c33] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2 sm:px-4"
      onSubmit={(event) => {
        event.preventDefault();
        submitText();
      }}
    >
      {recording ? (
        <div className="mb-2 flex items-center gap-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          <span className="size-2 animate-pulse rounded-full bg-rose-400" />
          Grabando nota de voz {formatDuration(seconds)}
          <span className="ml-auto flex gap-1">
            <Button size="sm" type="button" variant="ghost" onClick={() => finishRecording(false)}>
              <X className="size-4" />
              Cancelar
            </Button>
            <Button size="sm" type="button" className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300" onClick={() => finishRecording(true)}>
              Enviar
            </Button>
          </span>
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <input
          ref={imageRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files, "image");
            e.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files, "image");
            e.target.value = "";
          }}
        />
        <input
          ref={videoRef}
          type="file"
          accept="video/*"
          className="hidden"
            onChange={(e) => {
            void handleFiles(e.target.files, "video");
            e.target.value = "";
          }}
        />
        <input
          ref={fileRef}
          type="file"
          className="hidden"
            onChange={(e) => {
            void handleFiles(e.target.files, "file");
            e.target.value = "";
          }}
        />

        <div className="relative" ref={attachRef}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 shrink-0 rounded-full text-[#8696a0] hover:bg-white/5 hover:text-[#e9edef]"
            disabled={disabled || recording}
            aria-expanded={attachOpen}
            aria-haspopup="menu"
            onClick={() => setAttachOpen((open) => !open)}
          >
            <Paperclip className="size-5" />
            <span className="sr-only">Adjuntar</span>
          </Button>
          {attachOpen ? (
            <div
              role="menu"
              className="absolute bottom-full left-0 z-30 mb-2 w-44 rounded-lg border border-white/10 bg-zinc-900 p-1 shadow-xl"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-white/10"
                onClick={() => {
                  cameraRef.current?.click();
                  setAttachOpen(false);
                }}
              >
                <Camera className="size-4" /> Cámara
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-white/10"
                onClick={() => {
                  imageRef.current?.click();
                  setAttachOpen(false);
                }}
              >
                <ImageIcon className="size-4" /> Foto
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-white/10"
                onClick={() => {
                  videoRef.current?.click();
                  setAttachOpen(false);
                }}
              >
                <Video className="size-4" /> Video
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-white/10"
                onClick={() => {
                  fileRef.current?.click();
                  setAttachOpen(false);
                }}
              >
                <FileText className="size-4" /> Documento
              </button>
            </div>
          ) : null}
        </div>

        <div className="relative" data-emoji-root>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 shrink-0 rounded-full text-[#8696a0] hover:bg-white/5 hover:text-[#e9edef]"
            disabled={disabled || recording}
            onClick={() => setEmojiOpen((open) => !open)}
          >
            <Smile className="size-5" />
            <span className="sr-only">Emojis</span>
          </Button>
          {emojiOpen ? (
            <div className="absolute bottom-full left-0 z-30 mb-2 grid w-64 grid-cols-6 gap-1 rounded-xl bg-[#1f2c33] p-2 shadow-xl">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="rounded-md p-1 text-xl hover:bg-white/10"
                  onClick={() => {
                    setText((value) => (value + emoji).slice(0, MAX_TEXT_LENGTH));
                    setEmojiOpen(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <Textarea
          value={text}
          disabled={disabled || recording}
          maxLength={MAX_TEXT_LENGTH}
          placeholder="Escribe un mensaje"
          rows={1}
          name="message"
          lang="es"
          inputMode="text"
          enterKeyHint="send"
          autoCapitalize="sentences"
          autoCorrect="on"
          autoComplete="on"
          spellCheck
          className="max-h-32 min-h-11 flex-1 resize-none rounded-[21px] border-0 bg-[#2a3942] px-4 py-2.5 text-[16px] leading-5 text-[#e9edef] shadow-none placeholder:text-[#8696a0] focus-visible:ring-0 md:text-[16px]"
          onChange={(e) => {
            setText(e.target.value);
            emitTyping(e.target.value.trim().length > 0);
          }}
          onKeyDown={onComposerKey}
        />

        {text.trim() ? (
          <Button
            type="submit"
            size="icon"
            className="size-11 shrink-0 rounded-full bg-[#00a884] text-[#111b21] hover:bg-[#06cf9c]"
            disabled={disabled}
          >
            <SendHorizontal className="size-5" />
            <span className="sr-only">Enviar</span>
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            variant={recording ? "destructive" : "default"}
            className={
              recording
                ? "size-10 shrink-0 rounded-full"
                : "size-11 shrink-0 rounded-full bg-[#00a884] text-[#111b21] hover:bg-[#06cf9c]"
            }
            disabled={disabled}
            onClick={() => (recording ? finishRecording(true) : void startRecording())}
          >
            {recording ? <Square className="size-4" /> : <Mic className="size-5" />}
            <span className="sr-only">{recording ? "Detener" : "Nota de voz"}</span>
          </Button>
        )}
      </div>
    </form>
  );
}
