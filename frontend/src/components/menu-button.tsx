"use client";

import { Menu, X } from "lucide-react";
import { useShell } from "@/components/shell";

export function MenuButton() {
  const { openSidebar, closeSidebar, sidebarHidden } = useShell();

  return (
    <button
      onClick={sidebarHidden ? openSidebar : closeSidebar}
      className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
      title={sidebarHidden ? "Open menu" : "Close menu"}
    >
      {sidebarHidden ? (
        <Menu className="size-4" strokeWidth={1.5} />
      ) : (
        <X className="size-4" strokeWidth={1.5} />
      )}
    </button>
  );
}
