"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { MessageSquare, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Location } from "@/lib/api";
import { useEffect } from "react";

const MODULES: readonly { id: string; label: string; href: string; icon: string; badge?: number }[] = [
  { id: "home", label: "Home", href: "/", icon: "H" },
  { id: "inbox", label: "Inbox", href: "/inbox", icon: "I", badge: 3 },
  { id: "orders", label: "Orders", href: "/orders", icon: "O" },
  { id: "inventory", label: "Inventory", href: "/inventory", icon: "V" },
  { id: "prep", label: "Prep", href: "/prep", icon: "P" },
  { id: "food-cost", label: "Food Cost", href: "/food-cost", icon: "F" },
  { id: "menu", label: "Menu", href: "/menu", icon: "M" },
  { id: "marketing", label: "Marketing", href: "/marketing", icon: "K" },
  { id: "locations", label: "Locations", href: "/locations", icon: "L" },
  { id: "admin", label: "Admin", href: "/admin", icon: "A" },
];

const FALLBACK_LOCATIONS: Location[] = [
  { id: "1", slug: "river-north", name: "River North", city: "Chicago", status: "Stable", sales_delta: "+7.2%", labor_delta: "-1.3%" },
  { id: "2", slug: "west-loop", name: "West Loop", city: "Chicago", status: "Attention", sales_delta: "+2.4%", labor_delta: "+4.9%" },
  { id: "3", slug: "fulton-market", name: "Fulton Market", city: "Chicago", status: "Launch week", sales_delta: "+12.1%", labor_delta: "+2.0%" },
];

function statusColor(status: string): string {
  switch (status) {
    case "Stable":
      return "bg-emerald-500";
    case "Attention":
      return "bg-amber-500";
    case "Launch week":
      return "bg-blue-500";
    default:
      return "bg-neutral-500";
  }
}

function ChatHistory() {
  const messages = useWorkspaceStore((s) => s.messages);
  const clearMessages = useWorkspaceStore((s) => s.clearMessages);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (messages.length === 0) return null;

  const firstUserMsg = messages.find((m) => m.role === "user");
  const chatName = firstUserMsg
    ? firstUserMsg.content.length > 30
      ? firstUserMsg.content.slice(0, 30) + "..."
      : firstUserMsg.content
    : "New conversation";

  function handleTrashClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (confirmDelete) {
      clearMessages();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  }

  return (
    <>
      <SidebarSeparator />
      <SidebarGroup>
        <SidebarGroupLabel>Conversations</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center group">
                <SidebarMenuButton
                  isActive
                  render={<Link href="/" />}
                  className="flex-1"
                >
                  <MessageSquare className="size-4" />
                  <span className="truncate">{chatName}</span>
                </SidebarMenuButton>
                <button
                  onClick={handleTrashClick}
                  className="flex items-center px-1 rounded opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
                  title={confirmDelete ? "Click again to delete" : "Delete conversation"}
                >
                  {confirmDelete ? (
                    <span className="text-[9px] text-destructive">delete</span>
                  ) : (
                    <Trash2 className="size-3 text-muted-foreground" />
                  )}
                </button>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

interface AppSidebarProps {
  locations?: Location[];
  orgName?: string;
}

export function AppSidebar({ locations, orgName }: AppSidebarProps) {
  const pathname = usePathname();
  const locs = locations ?? FALLBACK_LOCATIONS;
  const { activeLocationId, setActiveLocation } = useWorkspaceStore();

  // Default to first location
  useEffect(() => {
    if (!activeLocationId && locs.length > 0) {
      setActiveLocation(locs[0].id);
    }
  }, [activeLocationId, locs, setActiveLocation]);

  const activeLocation = locs.find((l) => l.id === activeLocationId) ?? locs[0];

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
            C
          </div>
          <div>
            <p className="text-sm font-semibold">CarabinerOS</p>
            <p className="text-xs text-muted-foreground">
              {orgName ?? "Carabiner Restaurant Group"}
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Location Switcher */}
        <SidebarGroup>
          <SidebarGroupLabel>Location</SidebarGroupLabel>
          <SidebarGroupContent>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent">
                  <span className={`h-2 w-2 rounded-full ${statusColor(activeLocation?.status ?? "")}`} />
                  <span className="flex-1 font-medium">{activeLocation?.name ?? "Select location"}</span>
                  <span className="text-[10px] text-muted-foreground">{activeLocation?.sales_delta}</span>
                  <svg className="size-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[220px]">
                {locs.map((loc) => (
                  <DropdownMenuItem
                    key={loc.id}
                    onClick={() => setActiveLocation(loc.id)}
                    className="flex items-center gap-2"
                  >
                    <span className={`h-2 w-2 rounded-full ${statusColor(loc.status)}`} />
                    <span className="flex-1">{loc.name}</span>
                    <span className="text-[10px] text-muted-foreground">{loc.status}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Modules</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MODULES.map((mod) => {
                const isActive =
                  mod.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(mod.href);
                return (
                  <SidebarMenuItem key={mod.id}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={<Link href={mod.href} />}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded text-xs font-medium">
                        {mod.icon}
                      </span>
                      <span>{mod.label}</span>
                      {mod.badge ? (
                        <Badge
                          variant="secondary"
                          className="ml-auto text-xs px-1.5 py-0"
                        >
                          {mod.badge}
                        </Badge>
                      ) : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <ChatHistory />
      </SidebarContent>

      <SidebarFooter className="p-4">
        <p className="text-xs text-muted-foreground">
          CarabinerOS v2 &middot; Phase 4
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
