"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { ChatMessageBubble } from "./chat-message";
import { ChatComposer } from "./chat-composer";
import { ChatStatusPill } from "./chat-status-pill";
import { getSocket } from "@/lib/socket";

const MODULE_PILLS = [
  { id: "orders", label: "Orders", href: "/orders" },
  { id: "inventory", label: "Inventory", href: "/inventory" },
  { id: "prep", label: "Prep", href: "/prep" },
  { id: "food-cost", label: "Food Cost", href: "/food-cost" },
  { id: "menu", label: "Menu", href: "/menu" },
  { id: "marketing", label: "Marketing", href: "/marketing" },
];

interface ChatViewProps {
  compact?: boolean; // true when rendered inside ChatDock (380px)
}

export function ChatView({ compact }: ChatViewProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, isStreaming, streamingStatus, addMessage } =
    useWorkspaceStore();

  const hasMessages = messages.length > 0;

  // Auto-scroll on new messages or streaming chunks
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, streamingStatus]);

  function handleSend(message: string) {
    const socket = getSocket();
    if (!socket.connected) {
      return;
    }

    addMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      timestamp: Date.now(),
    });

    useWorkspaceStore.getState().setStreaming(true);

    socket.emit("chat_message", {
      context_id: "default",
      message,
    });
  }

  return (
    <div className={`flex flex-col min-h-0 flex-1 ${compact ? "" : "max-w-3xl mx-auto w-full"}`}>
      {/* Message area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        aria-live="polite"
      >
        {!hasMessages ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-end h-full gap-4 px-4 pb-4">
            <div className="flex size-10 items-center justify-center rounded-xl border bg-card text-base font-bold">
              C
            </div>
            <div className="text-center">
              <h1 className={`font-semibold ${compact ? "text-base" : "text-lg"}`}>
                Good morning
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                How can I help with operations today?
              </p>
            </div>
          </div>
        ) : (
          /* Messages */
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
        )}
      </div>

      {/* Module pills (empty state only) */}
      {!hasMessages && !compact && (
        <div className="flex flex-wrap justify-center gap-2 px-4 pb-2 animate-in fade-in duration-300">
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

      {/* Composer */}
      <div className={compact ? "p-3 border-t" : "py-4"}>
        <ChatComposer
          onSend={handleSend}
          disabled={isStreaming}
          hasMessages={hasMessages}
        />
      </div>
    </div>
  );
}
