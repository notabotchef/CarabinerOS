"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { ChatMessageBubble } from "./chat-message";
import { ChatComposer } from "./chat-composer";
import { ChatStatusPill } from "./chat-status-pill";
import { getSocket } from "@/lib/socket";
import { apiCreateChat } from "@/hooks/use-api";

const MODULE_PILLS = [
  { id: "orders", label: "Orders", href: "/orders" },
  { id: "inventory", label: "Inventory", href: "/inventory" },
  { id: "prep", label: "Prep", href: "/prep" },
  { id: "food-cost", label: "Food Cost", href: "/food-cost" },
  { id: "menu", label: "Menu", href: "/menu" },
  { id: "marketing", label: "Marketing", href: "/marketing" },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

interface ChatViewProps {
  compact?: boolean;
}

export function ChatView({ compact }: ChatViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, isStreaming, streamingStatus, addMessage, activeContextId, setActiveContextId } =
    useWorkspaceStore();

  const hasMessages = messages.length > 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, streamingStatus]);

  const handleSend = useCallback(
    async (message: string) => {
      const socket = getSocket();
      if (!socket.connected) return;

      let contextId = activeContextId;

      // If no active context, create a new chat first
      if (!contextId) {
        try {
          const newChat = await apiCreateChat();
          contextId = newChat.id;
          setActiveContextId(contextId);
        } catch {
          // Fallback to a generated id
          contextId = crypto.randomUUID();
          setActiveContextId(contextId);
        }
      }

      addMessage({
        id: crypto.randomUUID(),
        role: "user",
        content: message,
        timestamp: Date.now(),
      });

      useWorkspaceStore.getState().setStreaming(true);

      socket.emit("chat_message", {
        context_id: contextId,
        message,
      });

      // Refresh conversation list shortly after sending to pick up name + timestamp
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }, 2000);
    },
    [activeContextId, setActiveContextId, addMessage, queryClient]
  );

  // Empty state: everything grouped and centered
  if (!hasMessages) {
    return (
      <div className={`flex flex-col items-center justify-center flex-1 min-h-0 gap-6 px-4 ${compact ? "" : "max-w-3xl mx-auto w-full"}`}>
        <div className="text-3xl font-bold tracking-tight text-foreground">
          cOS
        </div>
        <div className="text-center">
          <h1 className={`font-semibold ${compact ? "text-base" : "text-xl"}`}>
            {getGreeting()}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            How can I help with operations today?
          </p>
        </div>

        {!compact && (
          <div className="flex flex-wrap justify-center gap-2">
            {MODULE_PILLS.map((mod) => (
              <button
                key={mod.id}
                onClick={() => router.push(mod.href)}
                className="rounded-lg border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {mod.label}
              </button>
            ))}
          </div>
        )}

        <div className={`w-full ${compact ? "" : "max-w-2xl"}`}>
          <ChatComposer
            onSend={handleSend}
            disabled={isStreaming}
            hasMessages={false}
          />
        </div>
      </div>
    );
  }

  // Active state: messages + composer at bottom
  return (
    <div className={`flex flex-col min-h-0 flex-1 ${compact ? "" : "max-w-3xl mx-auto w-full"}`}>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        aria-live="polite"
      >
        <div className={`space-y-3 ${compact ? "p-3" : "p-6"}`}>
          {messages.map((msg, i) => (
            <ChatMessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              isStreaming={
                isStreaming &&
                i === messages.length - 1 &&
                msg.role === "assistant"
              }
            />
          ))}
          <ChatStatusPill status={streamingStatus} />
        </div>
      </div>

      <div className={compact ? "p-3 border-t" : "py-4"}>
        <ChatComposer
          onSend={handleSend}
          disabled={isStreaming}
          hasMessages={true}
        />
      </div>
    </div>
  );
}
