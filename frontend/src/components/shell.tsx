"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";

interface ShellContextValue {
  openSidebar: () => void;
  closeSidebar: () => void;
  sidebarHidden: boolean;
  newChatPending: boolean;
  requestNewChat: () => void;
  consumeNewChat: () => void;
}

const ShellContext = createContext<ShellContextValue>({
  openSidebar: () => {},
  closeSidebar: () => {},
  sidebarHidden: true,
  newChatPending: false,
  requestNewChat: () => {},
  consumeNewChat: () => {},
});

export function useShell() {
  return useContext(ShellContext);
}

export function Shell({ children }: { children: ReactNode }) {
  const [sidebarHidden, setSidebarHidden] = useState(true);
  const [newChatPending, setNewChatPending] = useState(false);

  const openSidebar = useCallback(() => setSidebarHidden(false), []);
  const closeSidebar = useCallback(() => setSidebarHidden(true), []);
  const requestNewChat = useCallback(() => setNewChatPending(true), []);
  const consumeNewChat = useCallback(() => setNewChatPending(false), []);

  return (
    <ShellContext.Provider value={{ openSidebar, closeSidebar, sidebarHidden, newChatPending, requestNewChat, consumeNewChat }}>
      <AppSidebar hidden={sidebarHidden} />
      <main className="flex-1 flex flex-col min-h-dvh overflow-hidden relative">
        {children}
      </main>
    </ShellContext.Provider>
  );
}
