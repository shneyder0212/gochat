import { ChatRoom } from "@/components/chat/chat-room";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const code = roomId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "SALA";
  return <ChatRoom roomId={code} />;
}
