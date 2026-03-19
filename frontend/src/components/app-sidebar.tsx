"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { MODULES } from "@/lib/workspace-config";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(true);
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "flex flex-col shrink-0 border-r border-sidebar-border bg-sidebar h-dvh transition-all duration-200 overflow-hidden",
        collapsed ? "w-14" : "w-60"
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-3 py-4 border-b border-sidebar-border">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
          C
        </div>
        {!collapsed && (
          <span className="text-sm font-bold text-sidebar-foreground truncate">
            CarabinerOS
          </span>
        )}
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
              title={collapsed ? mod.label : undefined}
            >
              <mod.icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{mod.label}</span>}
            </Link>
          );
        })}
      </div>

      {/* Collapse toggle */}
      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors w-full"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="size-4 shrink-0" />
              <span className="truncate">Collapse</span>
            </>
          )}
        </button>
      </div>
    </nav>
  );
}
