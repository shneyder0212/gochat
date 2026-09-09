import { io } from "socket.io-client";

// Exportación nombrada requerida por chat-room.tsx
export const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000", {
  autoConnect: true,
});
