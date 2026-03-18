"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/stores/workspace-store";

export function ChatDock() {
  const { isChatOpen, chatPrompt, setChatOpen, setChatPrompt } =
    useWorkspaceStore();

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

      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-sm text-muted-foreground text-center">
          Chat responses will appear here.
          <br />
          <span className="text-xs">Streaming comes in Phase 4.</span>
        </p>
      </div>

      <div className="border-t p-4 space-y-2">
        <textarea
          className="w-full rounded-md border bg-muted/50 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          rows={3}
          value={chatPrompt ?? ""}
          onChange={(e) => setChatPrompt(e.target.value)}
          placeholder="Ask CarabinerOS anything..."
        />
        <Button className="w-full" size="sm" disabled>
          Send
        </Button>
      </div>
    </div>
  );
}
