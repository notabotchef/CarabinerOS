"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getStateSyncSocket } from "@/lib/socket-client";
import type { A0StatePush, A0Snapshot } from "@/lib/types";
import type { Socket } from "socket.io-client";

interface UseSocketReturn {
  connected: boolean;
  snapshot: A0Snapshot | null;
  subscribe: (contextId: string | null) => void;
}

export function useSocket(): UseSocketReturn {
  const [connected, setConnected] = useState(false);
  const [snapshot, setSnapshot] = useState<A0Snapshot | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const logFromRef = useRef(0);

  useEffect(() => {
    const socket = getStateSyncSocket();
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("state_push", (envelope: A0StatePush) => {
      const snap = envelope.snapshot;
      setSnapshot(snap);
      if (snap.logs.length > 0) {
        logFromRef.current = snap.logs[snap.logs.length - 1].no + 1;
      }
    });

    socket.connect();

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("state_push");
      socket.disconnect();
    };
  }, []);

  const subscribe = useCallback((contextId: string | null) => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    logFromRef.current = 0;

    socket.emit("state_request", {
      context: contextId,
      log_from: 0,
      notifications_from: 0,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ts: new Date().toISOString(),
      correlationId: crypto.randomUUID(),
      data: {},
    });
  }, []);

  return { connected, snapshot, subscribe };
}
