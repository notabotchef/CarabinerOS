import { io, Socket } from "socket.io-client";
import { getCsrfToken, clearCsrfToken } from "@/lib/csrf";

let stateSyncSocket: Socket | null = null;

export function initStateSyncSocket(): Socket {
  if (stateSyncSocket) return stateSyncSocket;

  // Use same-origin so Socket.IO polling goes through Next.js rewrites
  // (which proxy /socket.io/* to Agent Zero), making the connection
  // work from any device/network — not just localhost.
  // auth callback is called on every connect attempt (including reconnect),
  // ensuring the CSRF token and session cookie are always fresh.
  // This matches Agent Zero's own webui pattern (webui/js/websocket.js).
  // Start with polling so the Engine.IO handshake uses regular HTTP
  // requests that always carry session cookies.  Safari does not send
  // SameSite=Strict cookies on WebSocket upgrade requests, which breaks
  // the CSRF flow when websocket is the initial transport.  Once the
  // polling connection is established, Socket.IO auto-upgrades to
  // websocket for better performance.
  stateSyncSocket = io("/ws", {
    autoConnect: false,
    transports: ["polling", "websocket"],
    withCredentials: true,
    auth: (cb) => {
      getCsrfToken()
        .then((token) => cb({ csrf_token: token, handlers: ["ws_webui"] }))
        .catch((err) => {
          console.error("[socket] CSRF token fetch failed for connect:", err);
          cb({ handlers: ["ws_webui"] });
        });
    },
  });

  // On connect_error, invalidate the cached CSRF token so the next
  // reconnect attempt fetches a fresh one (and re-establishes the session).
  stateSyncSocket.on("connect_error", () => {
    clearCsrfToken();
  });

  return stateSyncSocket;
}

export function getStateSyncSocket(): Socket | null {
  return stateSyncSocket;
}

export function disconnectAll() {
  if (stateSyncSocket) {
    stateSyncSocket.disconnect();
    stateSyncSocket = null;
  }
}
