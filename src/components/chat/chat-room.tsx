"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Composer } from "./composer";
import { CallOverlay } from "./call-overlay";
import { useCall } from "@/hooks/useCall";
import { socket } from "@/lib/socket";
import { Phone, Video, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChatRoom() {
  const params = useParams();
  const roomId = params.roomId as string;
  const [messages, setMessages] = useState<any[]>([]);
  
  // Hook de llamadas para gestionar voz y video
  const { callState, startCall, endCall, acceptCall } = useCall();

  useEffect(() => {
    // Escuchar mensajes entrantes del socket
    socket.emit("join-room", roomId);
    
    socket.on("message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off("message");
    };
  }, [roomId]);

  // Manejar el envío de diferentes tipos de contenido (texto, multimedia, notas)
  const handleSendMessage = (content: string, type: string = "text") => {
    const messageData = {
      roomId,
      content,
      type, // 'text', 'image', 'video', 'document', 'audio'
      timestamp: new Date().toISOString(),
    };

    // Emitir el mensaje a través del socket
    socket.emit("send-message", messageData);
  };

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Cabecera de la sala con botones de Llamada y Videollamada */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <div className="font-semibold">Sala: {roomId}</div>
        </div>
        <div className="flex items-center gap-2">
          {/* Botón de llamada normal (audio) */}
          <Button variant="ghost" size="icon" onClick={() => startCall(roomId, "audio")}>
            <Phone className="w-5 h-5 text-muted-foreground hover:text-primary" />
          </Button>
          {/* Botón de videollamada */}
          <Button variant="ghost" size="icon" onClick={() => startCall(roomId, "video")}>
            <Video className="w-5 h-5 text-muted-foreground hover:text-primary" />
          </Button>
          <Button variant="ghost" size="icon">
            <MoreVertical className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Área de mensajes de la sala */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className="flex flex-col">
            <span className="text-sm bg-muted p-3 rounded-lg max-w-[70%]">
              {msg.type === "text" && msg.content}
              {msg.type === "image" && <img src={msg.content} alt="Adjunto" className="rounded-md max-w-xs" />}
              {/* Aquí puedes renderizar documentos, videos o reproductores de audio según msg.type */}
            </span>
          </div>
        ))}
      </div>

      {/* Componente de entrada de texto, emojis y adjuntos */}
      <Composer onSendMessage={handleSendMessage} />

      {/* Interfaz superpuesta para llamadas o videollamadas activas */}
      {callState.isActive && (
        <CallOverlay 
          callState={callState} 
          onEndCall={endCall} 
          onAcceptCall={acceptCall} 
        />
      )}
    </div>
  );
}
