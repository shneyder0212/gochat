"use client";

import React, { useState } from "react";
import { useAppViewport } from "@/hooks/useAppViewport";
import { Search, UserPlus, MessageSquare, MoreVertical, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function AppShell({ children }: { children: React.ReactNode }) {
  useAppViewport();

  const [searchTerm, setSearchTerm] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);

  const handleInviteFriend = () => {
    const inviteLink = window.location.origin;
    navigator.clipboard.writeText(inviteLink);
    alert("¡Enlace de invitación copiado al portapapeles! Compártelo con tu amigo.");
    setShowInviteModal(false);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Barra lateral izquierda tipo WhatsApp */}
      <div className="w-[380px] border-r flex flex-col bg-card">
        
        {/* Cabecera de la barra lateral */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
              U
            </div>
            <span className="font-semibold text-foreground">Mi Perfil</span>
          </div>

          <div className="flex items-center gap-1 text-muted-foreground">
            {/* Botón para Invitar a un Amigo */}
            <Button 
              variant="ghost" 
              size="icon" 
              title="Invitar a un amigo"
              onClick={() => setShowInviteModal(true)}
            >
              <UserPlus className="w-5 h-5" />
            </Button>

            <Button variant="ghost" size="icon" title="Nueva comunidad">
              <Users className="w-5 h-5" />
            </Button>

            <Button variant="ghost" size="icon" title="Nuevo chat">
              <MessageSquare className="w-5 h-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowInviteModal(true)}>
                  Invitar a un amigo
                </DropdownMenuItem>
                <DropdownMenuItem>Configuración</DropdownMenuItem>
                <DropdownMenuItem>Cerrar sesión</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Barra de búsqueda por Nombre o Teléfono */}
        <div className="p-2 border-b bg-background">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Busca un chat o escribe un teléfono..."
              className="pl-9 bg-muted/50 border-none text-sm"
            />
          </div>
        </div>

        {/* Lista de Chats / Contactos */}
        <div className="flex-1 overflow-y-auto">
          {searchTerm && (
            <div className="p-3 text-xs text-muted-foreground border-b bg-muted/20">
              Buscando contacto o chat: &quot;{searchTerm}&quot;
            </div>
          )}
          <div className="p-4 text-center text-sm text-muted-foreground">
            Tus conversaciones aparecerán aquí
          </div>
        </div>
      </div>

      {/* Contenido principal a la derecha (Salas de chat) */}
      <div className="flex-1 flex flex-col bg-background">
        {children}
      </div>

      {/* Modal para Invitar Amigos */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-xl w-[400px] border">
            <h3 className="text-lg font-bold mb-2 text-foreground">Invitar a un amigo a GoChat</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Comparte el enlace de acceso con tus amigos para que puedan unirse y chatear contigo por nombre o número de teléfono.
            </p>
            <div className="flex gap-2 mb-4">
              <Input readOnly value={typeof window !== "undefined" ? window.location.origin : ""} className="text-xs" />
              <Button onClick={handleInviteFriend}>Copiar</Button>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowInviteModal(false)}>Cerrar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
