"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";
import type { Socket } from "socket.io-client";

export function useSocket() {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    // Invalidate React Query cache on workspace updates from the engine
    socket.on("workspace_update", (data: { module: string }) => {
      const keyMap: Record<string, string> = {
        orders: "orders",
        inventory: "inventory",
        prep: "prep",
        "food-cost": "food-cost",
        menu: "menu",
        marketing: "marketing",
        inbox: "inbox",
      };
      const queryKey = keyMap[data.module];
      if (queryKey) {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      }
      // Always refresh HQ on any workspace change
      queryClient.invalidateQueries({ queryKey: ["hq"] });
    });

    socket.on("inbox_alert", () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["hq"] });
    });

    socket.connect();

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("workspace_update");
      socket.off("inbox_alert");
      socket.disconnect();
    };
  }, [queryClient]);

  return { socket: socketRef.current, connected };
}
