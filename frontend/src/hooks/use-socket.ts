"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { initStateSyncSocket, getStateSyncSocket } from "@/lib/socket-client";
import type { A0StatePush, A0Snapshot, ChefStatus } from "@/lib/types";
import type { Socket } from "socket.io-client";

interface UseSocketReturn {
  connected: boolean;
  snapshot: A0Snapshot | null;
  chefStatus: ChefStatus | null;
  subscribe: (contextId: string | null) => void;
}

export function useSocket(): UseSocketReturn {
  const [connected, setConnected] = useState(false);
  const [snapshot, setSnapshot] = useState<A0Snapshot | null>(null);
  const [chefStatus, setChefStatus] = useState<ChefStatus | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const logFromRef = useRef(0);

  useEffect(() => {
    const socket = initStateSyncSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      // Subscribe immediately to start receiving state_push events
      socket.emit("state_request", {
        context: null,
        log_from: 0,
        notifications_from: 0,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ts: new Date().toISOString(),
        correlationId: crypto.randomUUID(),
      });
    });
    socket.on("disconnect", () => setConnected(false));

    socket.on("state_push", (envelope: A0StatePush) => {
      // WebSocketManager wraps payloads in { handlerId, eventId, ts, data: {...} }
      const data = envelope?.data;
      const snap = data?.snapshot;
      if (!snap) return;
      setSnapshot(snap);
      if (snap.logs?.length > 0) {
        logFromRef.current = snap.logs[snap.logs.length - 1].no + 1;
      }
    });

    socket.on("chef_status", (status: ChefStatus) => {
      setChefStatus(status);
    });

    socket.connect();

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
    if (!socket?.connected) return;

    logFromRef.current = 0;

    socket.emit("state_request", {
      context: contextId,
      log_from: 0,
      notifications_from: 0,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ts: new Date().toISOString(),
      correlationId: crypto.randomUUID(),
    });
  }, []);

  return { connected, snapshot, chefStatus, subscribe };
}
