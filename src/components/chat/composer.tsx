"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Smile, Paperclip, Mic, Image, Send, FileText } from "lucide-react";

export function Composer({ onSendMessage }: { onSendMessage: (content: string, type: string) => void }) {
  const [message, setMessage] = useState("");
  const [showAttachments, setShowAttachments] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);

  const handleSend = () => {
    if (!message.trim()) return;
    onSendMessage(message, "text");
    setMessage("");
  };

  return (
    <div className="relative flex items-center gap-2 p-3 bg-background border-t">
      {/* Botón de Emojis */}
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => setShowEmojis(!showEmojis)}
      >
        <Smile className="w-5 h-5 text-muted-foreground" />
      </Button>

      {/* Botón de Adjuntos (Documentos, Fotos, Videos) */}
      <div className="relative">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setShowAttachments(!showAttachments)}
        >
          <Paperclip className="w-5 h-5 text-muted-foreground" />
        </Button>

        {showAttachments && (
          <div className="absolute bottom-12 left-0 bg-popover border shadow-lg rounded-lg p-2 flex flex-col gap-2 z-50">
            <Button variant="ghost" size="sm" className="justify-start gap-2" onClick={() => { onSendMessage("Simulación de Foto/Video", "image"); setShowAttachments(false); }}>
              <Image className="w-4 h-4 text-blue-500" /> Fotos y Videos
            </Button>
            <Button variant="ghost" size="sm" className="justify-start gap-2" onClick={() => { onSendMessage("Simulación de Documento", "document"); setShowAttachments(false); }}>
              <FileText className="w-4 h-4 text-green-500" /> Documentos
            </Button>
          </div>
        )}
      </div>

      {/* Input de texto */}
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Escribe un mensaje..."
        className="flex-1"
        onKeyDown={(e) => e.key === "Enter" && handleSend()}
      />

      {/* Botón de enviar o Nota de voz */}
      {message.trim() ? (
        <Button size="icon" onClick={handleSend}>
          <Send className="w-4 h-4" />
        </Button>
      ) : (
        <Button variant="ghost" size="icon" onClick={() => onSendMessage("Nota de voz simulada", "audio")}>
          <Mic className="w-5 h-5 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}
