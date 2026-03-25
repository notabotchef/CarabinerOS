"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { initStateSyncSocket, getStateSyncSocket } from "@/lib/socket-client";
import { getCsrfToken } from "@/lib/csrf";
import type { A0StatePush, A0Snapshot, A0Notification, ChefStatus } from "@/lib/types";
import type { Socket } from "socket.io-client";

interface UseSocketReturn {
  connected: boolean;
  snapshot: A0Snapshot | null;
  chefStatus: ChefStatus | null;
  notifications: A0Notification[];
  subscribe: (contextId: string | null) => void;
}

export function useSocket(): UseSocketReturn {
  const [connected, setConnected] = useState(false);
  const [snapshot, setSnapshot] = useState<A0Snapshot | null>(null);
  const [chefStatus, setChefStatus] = useState<ChefStatus | null>(null);
  const [notifications, setNotifications] = useState<A0Notification[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const logFromRef = useRef(0);
  const pendingContextRef = useRef<string | null | undefined>(undefined);
  const subscribedContextRef = useRef<string | null>(null);

  useEffect(() => {
    const socket = initStateSyncSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      // If a subscribe was called before connection, use that context
      const ctx = pendingContextRef.current !== undefined ? pendingContextRef.current : null;
      pendingContextRef.current = undefined;
      socket.emit("state_request", {
        context: ctx,
        log_from: 0,
        notifications_from: 0,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ts: new Date().toISOString(),
        correlationId: crypto.randomUUID(),
      });
    });
    socket.on("disconnect", () => setConnected(false));

    socket.on("state_push", (envelope: A0StatePush) => {
      const data = envelope?.data;
      const snap = data?.snapshot;
      if (!snap) {
        console.warn("[state_push] no snapshot in envelope", Object.keys(envelope || {}));
        return;
      }

      // Filter snapshots from other contexts to prevent cross-chat bleeding.
      // Accept if: no subscribed context yet (null), or snapshot matches subscribed context.
      const subscribed = subscribedContextRef.current;
      if (subscribed && snap.context && snap.context !== subscribed) {
        // Wrong context — still update the contexts list (sidebar chat list)
        // by merging it into the current snapshot without replacing logs/context.
        setSnapshot(prev => {
          if (!prev) return prev;
          return { ...prev, contexts: snap.contexts };
        });
        return;
      }

      const respLogs = snap.logs?.filter((l: { type: string }) => l.type === "response") ?? [];
      if (respLogs.length > 0) {
        console.log(`[state_push] ${snap.logs.length} logs, ${respLogs.length} responses, progress_active=${snap.log_progress_active}`);
      }
      setSnapshot(snap);
      if (snap.notifications?.length > 0) {
        setNotifications(snap.notifications);
      }
      if (snap.logs?.length > 0) {
        logFromRef.current = snap.logs[snap.logs.length - 1].no + 1;
      }
    });

    socket.on("chef_status", (status: ChefStatus) => {
      setChefStatus(status);
    });

    // Fetch CSRF token FIRST to establish the Flask session cookie,
    // THEN connect the socket. The WebSocket upgrade request will
    // carry the session cookie so Agent Zero can validate CSRF.
    getCsrfToken()
      .then(() => socket.connect())
      .catch(() => socket.connect()); // connect anyway, auth callback will retry

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("state_push");
      socket.off("chef_status");
      socket.disconnect();
    };
  }, []);

  const subscribe = useCallback((contextId: string | null) => {
    const socket = getStateSyncSocket();
    logFromRef.current = 0;
    subscribedContextRef.current = contextId;

    if (!socket?.connected) {
      // Socket not connected yet — queue the context for when it connects
      pendingContextRef.current = contextId;
      return;
    }

    socket.emit("state_request", {
      context: contextId,
      log_from: 0,
      notifications_from: 0,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ts: new Date().toISOString(),
      correlationId: crypto.randomUUID(),
    });
  }, []);

  return { connected, snapshot, chefStatus, notifications, subscribe };
}
