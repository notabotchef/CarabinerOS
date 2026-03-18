"use client";

import { useState } from "react";
import { X, MessageSquare, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { ChatView } from "@/components/chat/chat-view";

type DockMode = "chat" | "activity";

export function ChatDock() {
  const { isChatOpen, setChatOpen, setChatPrompt } = useWorkspaceStore();
  const [mode, setMode] = useState<DockMode>("chat");

  if (!isChatOpen) return null;

  return (
    <div className="w-[400px] shrink-0 border-l flex flex-col bg-background">
      {/* Header with mode tabs */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode("chat")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              mode === "chat"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="size-3.5" />
            Chat
          </button>
          <button
            onClick={() => setMode("activity")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              mode === "activity"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Activity className="size-3.5" />
            Activity
          </button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => {
            setChatOpen(false);
            setChatPrompt(null);
          }}
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {mode === "chat" && <ChatView compact />}
        {mode === "activity" && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <Activity className="size-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Activity Feed</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Agent actions and system events will appear here as you interact with CarabinerOS.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
