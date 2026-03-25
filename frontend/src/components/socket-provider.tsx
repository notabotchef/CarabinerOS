"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSocket } from "@/hooks/use-socket";
import type { A0Snapshot, A0Notification, ChefStatus } from "@/lib/types";

interface SocketContextValue {
  connected: boolean;
  snapshot: A0Snapshot | null;
  chefStatus: ChefStatus | null;
  notifications: A0Notification[];
  subscribe: (contextId: string | null) => void;
}

const SocketContext = createContext<SocketContextValue>({
  connected: false,
  snapshot: null,
  chefStatus: null,
  notifications: [],
  subscribe: () => {},
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const socket = useSocket();
  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  return useContext(SocketContext);
}
