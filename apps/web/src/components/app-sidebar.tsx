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
import { MessageSquare, Plus, Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import type { Location } from "@/lib/api";
import { useEffect } from "react";
import {
  useConversations,
  apiCreateChat,
  apiDeleteChat,
} from "@/hooks/use-api";
import { useQueryClient } from "@tanstack/react-query";
import type { ChatMessage } from "@/lib/chat-helpers";

const MODULES: readonly { id: string; label: string; href: string; icon: string; badge?: number }[] = [
  { id: "home", label: "Home", href: "/", icon: "H" },
  { id: "inbox", label: "Inbox", href: "/inbox", icon: "I", badge: 3 },
  { id: "orders", label: "Orders", href: "/orders", icon: "O" },
  { id: "invoices", label: "Invoices", href: "/invoices", icon: "$" },
  { id: "inventory", label: "Inventory", href: "/inventory", icon: "V" },
  { id: "prep", label: "Prep", href: "/prep", icon: "P" },
  { id: "food-cost", label: "Food Cost", href: "/food-cost", icon: "F" },
  { id: "menu", label: "Menu", href: "/menu", icon: "M" },
  { id: "reporting", label: "Reporting", href: "/reporting", icon: "R" },
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

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || "http://localhost:8000";

function formatRelativeTime(isoDate: string | null): string {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function ChatHistory() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: conversations = [] } = useConversations();
  const activeContextId = useWorkspaceStore((s) => s.activeContextId);
  const clearMessages = useWorkspaceStore((s) => s.clearMessages);
  const setActiveContextId = useWorkspaceStore((s) => s.setActiveContextId);
  const loadConversation = useWorkspaceStore((s) => s.loadConversation);
  const messages = useWorkspaceStore((s) => s.messages);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Sync conversations into the store for other components
  const setConversations = useWorkspaceStore((s) => s.setConversations);
  useEffect(() => {
    setConversations(conversations);
  }, [conversations, setConversations]);

  const handleNewChat = useCallback(async () => {
    clearMessages();
    try {
      const newChat = await apiCreateChat();
      setActiveContextId(newChat.id);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch {
      // Fallback: clear context so next message creates one server-side
      setActiveContextId(null);
    }
    router.push("/");
  }, [clearMessages, setActiveContextId, queryClient, router]);

  const handleSelectConversation = useCallback(
    async (contextId: string) => {
      if (contextId === activeContextId) return;
      setLoadingId(contextId);
      try {
        const res = await fetch(
          `${ENGINE_URL}/api/chats/${contextId}/messages`
        );
        if (!res.ok) throw new Error("Failed to load messages");
        const msgs: { role: "user" | "assistant"; content: string }[] =
          await res.json();
        const chatMessages: ChatMessage[] = msgs.map((m, i) => ({
          id: `${contextId}-${i}`,
          role: m.role,
          content: m.content,
          timestamp: Date.now() - (msgs.length - i) * 1000,
        }));
        loadConversation(contextId, chatMessages);
      } catch {
        // If loading fails, just switch context
        setActiveContextId(contextId);
      } finally {
        setLoadingId(null);
      }
      router.push("/");
    },
    [activeContextId, loadConversation, setActiveContextId, router]
  );

  const handleDeleteConversation = useCallback(
    async (e: React.MouseEvent, contextId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (confirmDeleteId === contextId) {
        try {
          await apiDeleteChat(contextId);
        } catch {
          // Proceed with local cleanup anyway
        }
        if (activeContextId === contextId) {
          clearMessages();
          setActiveContextId(null);
        }
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        setConfirmDeleteId(null);
      } else {
        setConfirmDeleteId(contextId);
        setTimeout(() => setConfirmDeleteId(null), 3000);
      }
    },
    [
      confirmDeleteId,
      activeContextId,
      clearMessages,
      setActiveContextId,
      queryClient,
    ]
  );

  // Also show the current local conversation if it hasn't been saved yet
  const hasLocalUnsavedChat =
    messages.length > 0 &&
    !activeContextId &&
    conversations.length === 0;

  return (
    <>
      <SidebarSeparator />
      <SidebarGroup>
        <SidebarGroupLabel>Conversations</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleNewChat}
                className="text-muted-foreground"
              >
                <Plus className="size-4" />
                <span>New Chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {conversations.map((conv) => (
              <SidebarMenuItem key={conv.id}>
                <div className="flex items-center group">
                  <SidebarMenuButton
                    isActive={conv.id === activeContextId}
                    onClick={() => handleSelectConversation(conv.id)}
                    className="flex-1"
                  >
                    {loadingId === conv.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <MessageSquare className="size-4" />
                    )}
                    <span className="truncate flex-1">
                      {conv.name || "New conversation"}
                    </span>
                    {conv.running && (
                      <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
                    )}
                    <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-1">
                      {formatRelativeTime(conv.last_message)}
                    </span>
                  </SidebarMenuButton>
                  <button
                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                    className="flex items-center px-1 rounded opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
                    title={
                      confirmDeleteId === conv.id
                        ? "Click again to delete"
                        : "Delete conversation"
                    }
                  >
                    {confirmDeleteId === conv.id ? (
                      <span className="text-[9px] text-destructive">
                        delete
                      </span>
                    ) : (
                      <Trash2 className="size-3 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </SidebarMenuItem>
            ))}

            {/* Show local unsaved chat as a fallback entry */}
            {hasLocalUnsavedChat && (
              <SidebarMenuItem>
                <SidebarMenuButton isActive className="flex-1">
                  <MessageSquare className="size-4" />
                  <span className="truncate">
                    {messages.find((m) => m.role === "user")?.content.slice(0, 30) || "New conversation"}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
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
