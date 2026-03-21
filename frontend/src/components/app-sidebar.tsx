"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { MODULES } from "@/lib/workspace-config";
import { useSocketContext } from "@/components/socket-provider";
import { useShell } from "@/components/shell";
import { cn } from "@/lib/utils";
import type { A0Context } from "@/lib/types";

interface AppSidebarProps {
  hidden: boolean;
}

function ChatItem({ chat, isActive, onDeleted }: { chat: A0Context; isActive: boolean; onDeleted: (success: boolean) => void }) {
  const [deleteStage, setDeleteStage] = useState<0 | 1 | 2>(0);
  // 0 = normal, 1 = "Delete?" confirmation shown, 2 = deleting

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (deleteStage === 0) {
      setDeleteStage(1);
      // Auto-reset after 3 seconds if not confirmed
      setTimeout(() => setDeleteStage((s) => (s === 1 ? 0 : s)), 3000);
      return;
    }

    if (deleteStage === 1) {
      setDeleteStage(2);
      try {
        // Agent Zero's chat remove endpoint
        const { getCsrfToken } = await import("@/lib/csrf");
        const csrf = await getCsrfToken();
        const res = await fetch("/chat_remove", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
          credentials: "include",
          body: JSON.stringify({ context: chat.id }),
        });
        if (!res.ok) throw new Error(`chat_remove failed: ${res.status}`);
        // Always notify parent — it handles navigation + context switch
        onDeleted(true);
      } catch {
        // Reset UI state so the item reappears
        setDeleteStage(0);
        onDeleted(false);
      }
    }
  };

  const handleMouseLeave = () => {
    if (deleteStage === 1) setDeleteStage(0);
  };

  if (deleteStage === 2) {
    return (
      <motion.div
        initial={{ opacity: 1, height: "auto" }}
        animate={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="overflow-hidden"
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors group relative",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
      )}
      onMouseLeave={handleMouseLeave}
    >
      <Link
        href={`/chat/${chat.id}`}
        className="flex items-center gap-2.5 flex-1 min-w-0"
      >
        <MessageSquare className="size-3.5 shrink-0 opacity-50" />
        <AnimatePresence mode="wait">
          {deleteStage === 1 ? (
            <motion.span
              key="delete"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
              className="text-[13px] text-red-400 font-medium"
            >
              Delete this chat?
            </motion.span>
          ) : (
            <motion.span
              key="name"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
              className="truncate text-[13px]"
            >
              {chat.name || chat.last_message?.slice(0, 40) || "Untitled"}
            </motion.span>
          )}
        </AnimatePresence>
      </Link>

      {/* Delete button — ghost, appears on hover */}
      <button
        onClick={handleDeleteClick}
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-md transition-all",
          deleteStage === 1
            ? "opacity-100 text-red-400 hover:bg-red-500/10"
            : "opacity-0 group-hover:opacity-50 hover:!opacity-100 text-sidebar-foreground/50 hover:text-red-400"
        )}
        title={deleteStage === 1 ? "Confirm delete" : "Delete chat"}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

export function AppSidebar({ hidden }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { snapshot, subscribe } = useSocketContext();
  const { requestNewChat } = useShell();

  const chats: A0Context[] = snapshot?.contexts ?? [];

  const handleNewChat = () => {
    requestNewChat();
    if (pathname !== "/") {
      router.push("/");
    }
  };

  return (
    <>
      <nav
        className={cn(
          "flex flex-col shrink-0 border-r border-sidebar-border bg-sidebar/90 glass-subtle h-dvh transition-all duration-200 overflow-hidden relative z-50",
          hidden ? "w-0 border-r-0" : "w-60"
        )}
      >
      {/* Module links */}
      <div className="flex flex-col gap-1 p-2 pt-3">
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
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150",
                isActive
                  ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 border-l-2 border-transparent"
              )}
              title={mod.label}
            >
              <div className={cn(
                "flex size-6 items-center justify-center rounded-md transition-colors",
                isActive ? "bg-primary/15" : "bg-muted/50"
              )}>
                <mod.icon className={cn("size-3.5 shrink-0", isActive ? "text-primary" : "")} />
              </div>
              <span className="truncate">{mod.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Conversations section */}
      <div className="flex-1 flex flex-col min-h-0 border-t border-sidebar-border mt-1">
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            Conversations
          </span>
          <button
            onClick={handleNewChat}
            className="flex size-6 items-center justify-center rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
            title="New Chat"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {chats.length === 0 ? (
            <p className="px-3 py-4 text-xs text-sidebar-foreground/30 text-center">
              No conversations yet
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">
              <AnimatePresence>
                {chats.map((chat) => {
                  const isActive = pathname === `/chat/${chat.id}` ||
                    (snapshot?.context === chat.id && pathname === "/");
                  return (
                    <motion.div
                      key={chat.id}
                      layout
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChatItem chat={chat} isActive={isActive} onDeleted={(success) => {
                        if (!success) return;
                        // Calculate next chat from the list (excluding the deleted one)
                        const idx = chats.findIndex(c => c.id === chat.id);
                        const remaining = chats.filter(c => c.id !== chat.id);
                        const next = remaining[Math.min(idx, remaining.length - 1)];
                        if (next) {
                          // Subscribe to the next chat's context so A0 sends updated state
                          subscribe(next.id);
                          router.push(`/chat/${next.id}`);
                        } else {
                          // No chats left — unsubscribe and go home
                          subscribe(null);
                          router.push("/");
                        }
                      }} />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </nav>
    </>
  );
}
