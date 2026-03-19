"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";

interface ShellContextValue {
  openSidebar: () => void;
}

const ShellContext = createContext<ShellContextValue>({ openSidebar: () => {} });

export function useShell() {
  return useContext(ShellContext);
}

export function Shell({ children }: { children: ReactNode }) {
  const [sidebarHidden, setSidebarHidden] = useState(true);

  const openSidebar = useCallback(() => setSidebarHidden(false), []);
  const closeSidebar = useCallback(() => setSidebarHidden(true), []);

  return (
    <ShellContext.Provider value={{ openSidebar }}>
      <AppSidebar hidden={sidebarHidden} onClose={closeSidebar} />
      <main className="flex-1 flex flex-col min-h-dvh overflow-hidden">
        {children}
      </main>
    </ShellContext.Provider>
  );
}
