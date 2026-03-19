"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose } from "lucide-react";
import { MODULES } from "@/lib/workspace-config";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  hidden: boolean;
  onClose: () => void;
}

export function AppSidebar({ hidden, onClose }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "flex flex-col shrink-0 border-r border-sidebar-border bg-sidebar h-dvh transition-all duration-200 overflow-hidden",
        hidden ? "w-0 border-r-0" : "w-60"
      )}
    >
      {/* Top: brand + close */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-sidebar-border">
        <span className="text-sm font-bold text-sidebar-foreground truncate">
          CarabinerOS
        </span>
        <button
          onClick={onClose}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      {/* Module links */}
      <div className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto">
        {MODULES.map((mod) => {
          const isActive =
            mod.href === "/"
              ? pathname === "/"
              : pathname.startsWith(mod.href);
          return (
            <Link
              key={mod.id}
              href={mod.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
              title={mod.label}
            >
              <mod.icon className="size-4 shrink-0" />
              <span className="truncate">{mod.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
