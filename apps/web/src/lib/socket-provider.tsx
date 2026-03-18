"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSocket } from "@/hooks/use-socket";

const SocketContext = createContext<{ connected: boolean }>({ connected: false });

export function SocketProvider({ children }: { children: ReactNode }) {
  const { connected } = useSocket();

  return (
    <SocketContext.Provider value={{ connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketStatus() {
  return useContext(SocketContext);
}
