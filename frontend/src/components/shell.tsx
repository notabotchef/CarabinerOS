"use client";

import { createContext, useContext, useState, useCallback, type ReactNode, type MouseEvent } from "react";
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

  // Close sidebar when clicking empty space on main content.
  // Interactive elements (links, buttons, inputs) pass through without closing.
  const handleMainClick = useCallback((e: MouseEvent) => {
    if (sidebarHidden) return;
    const target = e.target as HTMLElement;
    const interactive = target.closest("a, button, input, textarea, select, [role='button'], [tabindex]");
    if (!interactive) closeSidebar();
  }, [sidebarHidden, closeSidebar]);

  return (
    <ShellContext.Provider value={{ openSidebar, closeSidebar, sidebarHidden, newChatPending, requestNewChat, consumeNewChat }}>
      <AppSidebar hidden={sidebarHidden} />
      <main className="flex-1 flex flex-col min-h-dvh overflow-hidden relative" onClick={handleMainClick}>
        {children}
      </main>
    </ShellContext.Provider>
  );
}
