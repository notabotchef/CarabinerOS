"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { ChatView } from "@/components/chat/chat-view";

export function ChatDock() {
  const { isChatOpen, setChatOpen, setChatPrompt } = useWorkspaceStore();

  if (!isChatOpen) return null;

  return (
    <div className="w-[380px] shrink-0 border-l flex flex-col bg-background">
      <div className="flex h-14 items-center justify-between border-b px-4">
        <span className="text-sm font-semibold">CarabinerOS</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setChatOpen(false);
            setChatPrompt(null);
          }}
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatView compact />
      </div>
    </div>
  );
}
