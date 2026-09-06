"use client";

import { CheckCheck, Download, FileText } from "lucide-react";
import { formatBytes, formatTime } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MessageBubble({
  message,
  mine,
}: {
  message: ChatMessage;
  mine: boolean;
}) {
  if (message.type === "system" || message.locked) {
    return (
      <div className="flex justify-center px-3 py-1">
        <p className="rounded-md bg-[#182229] px-3 py-1 text-center text-[12px] text-[#ffd279] shadow-sm">
          {message.locked
            ? "Mensaje cifrado. Pide el enlace completo del grupo (con la clave) para leerlo."
            : message.text}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex w-full", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "relative max-w-[85%] rounded-lg px-2 pb-1.5 pt-1 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] sm:max-w-[65%]",
          mine ? "rounded-tr-none bg-[#005c4b]" : "rounded-tl-none bg-[#202c33]",
        )}
      >
        {!mine ? (
          <p className="mb-0.5 px-1 text-[13px] font-medium" style={{ color: message.senderColor }}>
            {message.senderName}
          </p>
        ) : null}

        {message.type === "text" ? (
          <p className="whitespace-pre-wrap break-words px-1 text-[14.2px] leading-5 text-[#e9edef]">
            {message.text}
          </p>
        ) : null}

        {message.type === "image" && message.objectUrl ? (
          <a href={message.objectUrl} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.objectUrl}
              alt={message.fileName || "Imagen"}
              className="mt-0.5 max-h-72 w-full rounded-md object-cover"
            />
          </a>
        ) : null}

        {message.type === "video" && message.objectUrl ? (
          <video
            src={message.objectUrl}
            controls
            className="mt-0.5 max-h-72 w-full rounded-md bg-black"
          />
        ) : null}

        {message.type === "voice" && message.objectUrl ? (
          <audio src={message.objectUrl} controls className="mt-1 w-full max-w-xs" />
        ) : null}

        {message.type === "file" ? (
          <a
            href={message.objectUrl}
            download={message.fileName}
            className="mt-0.5 flex items-center gap-3 rounded-md bg-black/20 px-2 py-2"
          >
            <FileText className="size-5 shrink-0 text-[#00a884]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{message.fileName}</span>
              <span className="text-xs text-[#8696a0]">{formatBytes(message.fileSize ?? 0)}</span>
            </span>
            <Download className="size-4 shrink-0 text-[#8696a0]" />
          </a>
        ) : null}

        <p className="mt-0.5 flex items-center justify-end gap-1 px-1 text-[11px] text-[#8696a0]">
          {formatTime(message.timestamp)}
          {mine ? <CheckCheck className="size-3.5 text-[#53bdeb]" /> : null}
        </p>
      </div>
    </div>
  );
}
