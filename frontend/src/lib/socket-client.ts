import { io, Socket } from "socket.io-client";

const A0_URL = process.env.NEXT_PUBLIC_A0_URL || "http://localhost:5000";

let stateSyncSocket: Socket | null = null;

export function getStateSyncSocket(): Socket {
  if (!stateSyncSocket) {
    stateSyncSocket = io(`${A0_URL}/state_sync`, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      withCredentials: true,
    });
  }
  return stateSyncSocket;
}

export function disconnectAll() {
  if (stateSyncSocket) {
    stateSyncSocket.disconnect();
    stateSyncSocket = null;
  }
}

export { A0_URL };
