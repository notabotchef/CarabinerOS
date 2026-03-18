import { io, type Socket } from "socket.io-client";

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || "http://localhost:8000";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(ENGINE_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}
