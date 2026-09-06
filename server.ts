import { createServer } from "http";
import { randomUUID } from "crypto";
import next from "next";
import { Server } from "socket.io";
import {
  APP_NAME,
  MAX_CALLERS,
  MAX_FILE_SIZE,
  MAX_MESSAGES,
  MAX_NAME_LENGTH,
  MAX_TEXT_LENGTH,
  PORT,
} from "./src/lib/constants";
import { inspectFile } from "./src/lib/file-guard";

const port = parseInt(process.env.PORT || String(PORT), 10);
const hostname = process.env.HOSTNAME || "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";

type MediaKind = "audio" | "video";
type MessageType = "text" | "voice" | "image" | "video" | "file" | "system" | "sealed";

type Member = {
  userId: string;
  socketId: string;
  name: string;
  color: string;
};

type StoredMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  type: MessageType;
  text?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  payload?: Buffer;
  timestamp: number;
};

type Call = {
  kind: MediaKind;
  initiatedBy: string;
  initiatedByName: string;
  participants: Set<string>;
  kicked: Set<string>;
};

type Room = {
  id: string;
  members: Map<string, Member>;
  messages: StoredMessage[];
  call: Call | null;
};

const rooms = new Map<string, Room>();
const socketIndex = new Map<string, { userId: string; roomId: string }>();
const blockLists = new Map<string, Set<string>>();

const PALETTE = [
  "#34d399",
  "#22d3ee",
  "#a78bfa",
  "#fb7185",
  "#fbbf24",
  "#60a5fa",
  "#f472b6",
  "#4ade80",
  "#38bdf8",
  "#c084fc",
];

function colorFromName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function sanitizeName(raw: unknown) {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);
}

function sanitizeRoom(raw: unknown) {
  if (typeof raw !== "string") return "";
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

function getRoom(id: string): Room {
  let room = rooms.get(id);
  if (!room) {
    room = { id, members: new Map(), messages: [], call: null };
    rooms.set(id, room);
  }
  return room;
}

function publicMember(m: Member) {
  return { id: m.userId, name: m.name, color: m.color };
}

function publicCall(call: Call | null) {
  if (!call) return null;
  return {
    kind: call.kind,
    initiatedBy: call.initiatedBy,
    initiatedByName: call.initiatedByName,
    participantIds: [...call.participants],
    kickedIds: [...call.kicked],
  };
}

function serializeMessage(msg: StoredMessage) {
  return {
    id: msg.id,
    senderId: msg.senderId,
    senderName: msg.senderName,
    senderColor: msg.senderColor,
    type: msg.type,
    text: msg.text,
    fileName: msg.fileName,
    mimeType: msg.mimeType,
    fileSize: msg.fileSize,
    payload: msg.payload,
    timestamp: msg.timestamp,
  };
}

function pushMessage(room: Room, msg: StoredMessage) {
  room.messages.push(msg);
  while (room.messages.length > MAX_MESSAGES) {
    room.messages.shift();
  }
}

function systemMessage(room: Room, text: string) {
  const msg: StoredMessage = {
    id: randomUUID(),
    senderId: "system",
    senderName: APP_NAME,
    senderColor: "#64748b",
    type: "system",
    text,
    timestamp: Date.now(),
  };
  pushMessage(room, msg);
  return msg;
}

function memberByUser(room: Room, userId: string) {
  return room.members.get(userId);
}

function isBlockedPath(fromId: string, toId: string) {
  return Boolean(blockLists.get(toId)?.has(fromId) || blockLists.get(fromId)?.has(toId));
}

function emitToRoom(io: Server, room: Room, event: string, payload: unknown, fromId?: string) {
  for (const member of room.members.values()) {
    if (fromId && isBlockedPath(fromId, member.userId)) continue;
    io.to(member.socketId).emit(event, payload);
  }
}

function leaveCall(io: Server, room: Room, userId: string) {
  if (!room.call || !room.call.participants.has(userId)) return;
  room.call.participants.delete(userId);
  io.to(room.id).emit("call:peer-left", { userId });
  if (room.call.initiatedBy === userId && room.call.participants.size > 0) {
    const nextId = [...room.call.participants][0];
    const next = room.members.get(nextId);
    room.call.initiatedBy = nextId;
    room.call.initiatedByName = next?.name ?? room.call.initiatedByName;
  }
  if (room.call.participants.size === 0) {
    const ended = systemMessage(room, "La llamada terminó");
    emitToRoom(io, room, "message", serializeMessage(ended));
    room.call = null;
  }
  io.to(room.id).emit("call:state", publicCall(room.call));
}

function leaveRoom(io: Server, socketId: string) {
  const ctx = socketIndex.get(socketId);
  if (!ctx) return;
  socketIndex.delete(socketId);
  const room = rooms.get(ctx.roomId);
  if (!room) return;
  const member = room.members.get(ctx.userId);
  if (member && member.socketId === socketId) {
    leaveCall(io, room, ctx.userId);
    room.members.delete(ctx.userId);
    const left = systemMessage(room, `${member.name} salió de la sala`);
    emitToRoom(io, room, "message", serializeMessage(left));
    io.to(room.id).emit("members", [...room.members.values()].map(publicMember));
  }
  if (room.members.size === 0) {
    rooms.delete(room.id);
  }
}

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const floods = new Map<string, number[]>();

  function tooFast(socketId: string) {
    const now = Date.now();
    const recent = (floods.get(socketId) ?? []).filter((t) => now - t < 8000);
    recent.push(now);
    floods.set(socketId, recent);
    return recent.length > 28;
  }

  const httpServer = createServer((req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(), usb=()");
    handle(req, res);
  });

  const io = new Server(httpServer, {
    cors: { origin: true },
    maxHttpBufferSize: MAX_FILE_SIZE + 1_000_000,
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  io.on("connection", (socket) => {
    socket.on(
      "join",
      (raw: { roomId?: unknown; name?: unknown; userId?: unknown }) => {
        const roomId = sanitizeRoom(raw?.roomId);
        const name = sanitizeName(raw?.name);
        const userId =
          typeof raw?.userId === "string" && raw.userId.length <= 64
            ? raw.userId
            : randomUUID();

        if (!roomId || !name) {
          socket.emit("join:error", { message: "Nombre y código de sala son obligatorios." });
          return;
        }

        const previous = socketIndex.get(socket.id);
        if (previous) {
          socket.leave(previous.roomId);
          leaveRoom(io, socket.id);
        }

        const room = getRoom(roomId);
        const existing = room.members.get(userId);
        if (existing) {
          socketIndex.delete(existing.socketId);
          existing.socketId = socket.id;
          existing.name = name;
        } else {
          room.members.set(userId, {
            userId,
            socketId: socket.id,
            name,
            color: colorFromName(name),
          });
          const joined = systemMessage(room, `${name} se unió a la sala`);
          emitToRoom(io, room, "message", serializeMessage(joined));
        }

        socket.join(room.id);
        socketIndex.set(socket.id, { userId, roomId: room.id });

        const self = room.members.get(userId)!;
        socket.emit("joined", {
          self: publicMember(self),
          members: [...room.members.values()].map(publicMember),
          messages: room.messages.map(serializeMessage),
          call: publicCall(room.call),
        });
        io.to(room.id).emit("members", [...room.members.values()].map(publicMember));
      },
    );

    socket.on(
      "message",
      (raw: {
        id?: unknown;
        type?: unknown;
        text?: unknown;
        fileName?: unknown;
        mimeType?: unknown;
        fileSize?: unknown;
        payload?: unknown;
      }) => {
        const ctx = socketIndex.get(socket.id);
        if (!ctx) return;
        const room = rooms.get(ctx.roomId);
        const member = room ? memberByUser(room, ctx.userId) : undefined;
        if (!room || !member) return;
        if (tooFast(socket.id)) {
          socket.emit("chat:error", { message: "Estás enviando demasiado rápido. Espera un momento." });
          return;
        }

        const type = raw?.type;
        if (
          type !== "text" &&
          type !== "voice" &&
          type !== "image" &&
          type !== "video" &&
          type !== "file" &&
          type !== "sealed"
        ) {
          return;
        }

        const id =
          typeof raw?.id === "string" && raw.id.length <= 64
            ? raw.id
            : randomUUID();

        let payload: Buffer | undefined;
        if (raw?.payload != null) {
          if (Buffer.isBuffer(raw.payload)) payload = raw.payload;
          else if (raw.payload instanceof ArrayBuffer) {
            payload = Buffer.from(raw.payload);
          } else if (ArrayBuffer.isView(raw.payload)) {
            payload = Buffer.from(
              raw.payload.buffer,
              raw.payload.byteOffset,
              raw.payload.byteLength,
            );
          }
          if (payload && payload.byteLength > MAX_FILE_SIZE) {
            socket.emit("chat:error", {
              message: "El archivo supera el límite de 8 MB.",
            });
            return;
          }
        }

        const text =
          typeof raw?.text === "string"
            ? raw.text.trim().slice(0, MAX_TEXT_LENGTH)
            : undefined;

        if (type === "text" && !text && !payload) return;
        if (type !== "text" && type !== "sealed" && !payload) return;
        if (type === "sealed" && !payload) return;

        const fileName =
          typeof raw?.fileName === "string" ? raw.fileName.slice(0, 180) : undefined;
        const mimeType =
          typeof raw?.mimeType === "string" ? raw.mimeType.slice(0, 120) : undefined;

        if (type !== "sealed" && payload && (type === "file" || type === "image" || type === "video" || type === "voice")) {
          const inspected = inspectFile(payload, fileName || "archivo", mimeType || "", type);
          if (!inspected.ok) {
            socket.emit("chat:error", { message: inspected.reason });
            return;
          }
        }
        if (fileName && /\.(exe|bat|cmd|js|html|htm|scr|msi|dll|apk|ps1|vbs|svg)$/i.test(fileName)) {
          socket.emit("chat:error", { message: "Ese tipo de archivo está bloqueado." });
          return;
        }

        const msg: StoredMessage = {
          id,
          senderId: member.userId,
          senderName: member.name,
          senderColor: member.color,
          type,
          text,
          fileName,
          mimeType,
          fileSize: payload?.byteLength,
          payload,
          timestamp: Date.now(),
        };
        pushMessage(room, msg);
        emitToRoom(io, room, "message", serializeMessage(msg), member.userId);
      },
    );

    socket.on("typing", (raw: { typing?: unknown }) => {
      const ctx = socketIndex.get(socket.id);
      if (!ctx) return;
      socket.to(ctx.roomId).emit("typing", {
        userId: ctx.userId,
        typing: Boolean(raw?.typing),
      });
    });

    socket.on("call:join", (raw: { kind?: unknown }) => {
      const ctx = socketIndex.get(socket.id);
      if (!ctx) return;
      const room = rooms.get(ctx.roomId);
      const member = room ? memberByUser(room, ctx.userId) : undefined;
      if (!room || !member) return;

      if (!room.call) {
        const kind = raw?.kind === "audio" ? "audio" : "video";
        room.call = {
          kind,
          initiatedBy: member.userId,
          initiatedByName: member.name,
          participants: new Set([member.userId]),
          kicked: new Set(),
        };
        const started = systemMessage(
          room,
          `${member.name} inició una ${kind === "video" ? "videollamada" : "llamada"} grupal`,
        );
        emitToRoom(io, room, "message", serializeMessage(started));
      } else {
        if (room.call.kicked.has(member.userId)) {
          socket.emit("call:error", {
            message: "Te expulsaron de esta llamada. Podrás entrar en la siguiente si no te expulsan.",
          });
          return;
        }
        if (room.call.participants.has(member.userId)) {
          const others = [...room.call.participants].filter((id) => id !== member.userId);
          socket.emit("call:joined", { kind: room.call.kind, peers: others });
          io.to(room.id).emit("call:state", publicCall(room.call));
          return;
        }
        if (room.call.participants.size >= MAX_CALLERS) {
          socket.emit("call:error", {
            message: "La llamada ya está llena (máximo 8 personas).",
          });
          return;
        }
        room.call.participants.add(member.userId);
      }

      const others = [...room.call.participants].filter((id) => id !== member.userId);
      socket.emit("call:joined", { kind: room.call.kind, peers: others });
      socket.to(room.id).emit("call:peer-joined", {
        userId: member.userId,
        name: member.name,
      });
      io.to(room.id).emit("call:state", publicCall(room.call));
    });

    socket.on("call:leave", () => {
      const ctx = socketIndex.get(socket.id);
      if (!ctx) return;
      const room = rooms.get(ctx.roomId);
      if (!room) return;
      leaveCall(io, room, ctx.userId);
    });

    socket.on("call:signal", (raw: { to?: unknown; data?: unknown }) => {
      const ctx = socketIndex.get(socket.id);
      if (!ctx) return;
      const room = rooms.get(ctx.roomId);
      if (!room) return;
      if (typeof raw?.to !== "string") return;
      if (isBlockedPath(ctx.userId, raw.to)) return;
      const target = room.members.get(raw.to);
      if (!target) return;
      io.to(target.socketId).emit("call:signal", {
        from: ctx.userId,
        data: raw.data,
      });
    });

    socket.on("call:kick", (raw: { userId?: unknown }) => {
      const ctx = socketIndex.get(socket.id);
      if (!ctx) return;
      const room = rooms.get(ctx.roomId);
      if (!room?.call) return;
      if (room.call.initiatedBy !== ctx.userId) return;
      if (typeof raw?.userId !== "string" || raw.userId === ctx.userId) return;
      if (!room.call.participants.has(raw.userId)) return;
      room.call.kicked.add(raw.userId);
      leaveCall(io, room, raw.userId);
      const target = room.members.get(raw.userId);
      if (target) {
        io.to(target.socketId).emit("call:kicked", {
          message: "Te expulsaron de la llamada grupal.",
        });
      }
      const kicked = systemMessage(room, `Expulsaron a ${target?.name ?? "un participante"} de la llamada`);
      emitToRoom(io, room, "message", serializeMessage(kicked));
    });

    socket.on("privacy:blocks", (raw: { ids?: unknown }) => {
      const ctx = socketIndex.get(socket.id);
      if (!ctx) return;
      const ids = Array.isArray(raw?.ids)
        ? raw.ids.filter((id): id is string => typeof id === "string").slice(0, 100)
        : [];
      blockLists.set(ctx.userId, new Set(ids));
    });

    socket.on("disconnect", () => {
      floods.delete(socket.id);
      leaveRoom(io, socket.id);
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(
      `${APP_NAME} listo en http://${hostname}:${port} (${dev ? "development" : "production"})`,
    );
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
