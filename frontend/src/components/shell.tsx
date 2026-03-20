"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { PanelLeftOpen } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";

interface ShellContextValue {
  openSidebar: () => void;
  sidebarHidden: boolean;
  newChatPending: boolean;
  requestNewChat: () => void;
  consumeNewChat: () => void;
}

const ShellContext = createContext<ShellContextValue>({
  openSidebar: () => {},
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
    <ShellContext.Provider value={{ openSidebar, sidebarHidden, newChatPending, requestNewChat, consumeNewChat }}>
      <AppSidebar hidden={sidebarHidden} onClose={closeSidebar} />
      <main className="flex-1 flex flex-col min-h-dvh overflow-hidden relative">
        {/* Floating menu button — always visible when sidebar is closed */}
        {sidebarHidden && (
          <button
            onClick={openSidebar}
            className="fixed top-[14px] left-3 z-40 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            title="Open menu"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        )}
        {children}
      </main>
    </ShellContext.Provider>
  );
}
