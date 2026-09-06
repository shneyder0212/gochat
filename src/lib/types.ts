export type MediaKind = "audio" | "video";

export type MessageType = "text" | "voice" | "image" | "video" | "file" | "system" | "sealed";

export type Member = {
  id: string;
  name: string;
  color: string;
};

export type CallState = {
  kind: MediaKind;
  initiatedBy: string;
  initiatedByName: string;
  participantIds: string[];
  kickedIds?: string[];
};

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  type: MessageType;
  text?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  payload?: ArrayBuffer | Uint8Array;
  objectUrl?: string;
  timestamp: number;
  locked?: boolean;
};

export type SignalData =
  | { type: "sdp"; description: RTCSessionDescriptionInit }
  | { type: "ice"; candidate: RTCIceCandidateInit };

export type JoinAck = {
  self: Member;
  members: Member[];
  messages: ChatMessage[];
  call: CallState | null;
};
