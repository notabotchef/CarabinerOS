"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { deriveConversationStatus } from "@/lib/chat-helpers";
import type { Socket } from "socket.io-client";

export function useSocket() {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => {
      setConnected(false);
      // If disconnect during streaming, reset state
      const store = useWorkspaceStore.getState();
      if (store.isStreaming) {
        store.setStreaming(false);
        store.setStreamingStatus(null);
        store.appendToLastMessage("\n\n*Connection lost. Try again.*");
      }
    });

    // Workspace cache invalidation
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
      queryClient.invalidateQueries({ queryKey: ["hq"] });
    });

    socket.on("inbox_alert", () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["hq"] });
    });

    // Chat streaming
    socket.on("response_stream", (data: { chunk: string; full: string }) => {
      const store = useWorkspaceStore.getState();
      store.appendToLastMessage(data.chunk);

      // Reset streaming timeout
      if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
      streamTimeoutRef.current = setTimeout(() => {
        const s = useWorkspaceStore.getState();
        if (s.isStreaming) {
          s.setStreaming(false);
          s.setStreamingStatus(null);
          s.appendToLastMessage("\n\n*Response timed out. Try again.*");
        }
      }, 10000);
    });

    // Status updates
    socket.on("status_update", (data: { status: string; detail?: string; context_id?: string }) => {
      const store = useWorkspaceStore.getState();

      if (data.status === "waiting") {
        store.setStreaming(false);
        store.setStreamingStatus(null);
        if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
      } else {
        const status = deriveConversationStatus(data);
        store.setStreamingStatus(status);
      }
    });

    socket.connect();

    return () => {
      if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
      socket.off("connect");
      socket.off("disconnect");
      socket.off("workspace_update");
      socket.off("inbox_alert");
      socket.off("response_stream");
      socket.off("status_update");
      socket.disconnect();
    };
  }, [queryClient]);

  return { socket: socketRef.current, connected };
}
