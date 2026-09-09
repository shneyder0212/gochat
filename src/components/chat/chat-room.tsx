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
  
  const { callState, startCall, endCall, acceptCall } = useCall();

  useEffect(() => {
    if (!roomId) return;
    socket.emit("join-room", roomId);
    
    socket.on("message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off("message");
    };
  }, [roomId]);

  const handleSendMessage = (content: string, type: string = "text") => {
    const messageData = {
      roomId,
      content,
      type,
      timestamp: new Date().toISOString(),
    };

    socket.emit("send-message", messageData);
    setMessages((prev) => [...prev, messageData]); // Optimistic update local
  };

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Cabecera de la sala */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <div className="font-semibold text-foreground">Sala: {roomId}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => startCall(roomId, "audio")}>
            <Phone className="w-5 h-5 text-muted-foreground hover:text-primary" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => startCall(roomId, "video")}>
            <Video className="w-5 h-5 text-muted-foreground hover:text-primary" />
          </Button>
          <Button variant="ghost" size="icon">
            <MoreVertical className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className="flex flex-col">
            <div className="text-sm bg-muted text-foreground p-3 rounded-lg max-w-[70%] shadow-sm">
              <span className="block text-xs text-muted-foreground mb-1 capitalize">Tipo: {msg.type}</span>
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <Composer onSendMessage={handleSendMessage} />

      {/* Overlay de Llamadas */}
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
