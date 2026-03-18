"use client";

import type { StatusPayload } from "@/lib/chat-helpers";

interface ChatStatusPillProps {
  status: StatusPayload | null;
}

export function ChatStatusPill({ status }: ChatStatusPillProps) {
  if (!status || status.state === "waiting") return null;

  const stateStyles = {
    thinking: "border-primary/20 bg-primary/5 text-primary",
    waiting: "border-border bg-muted text-muted-foreground",
    error: "border-destructive/20 bg-destructive/5 text-destructive",
  };

  return (
    <div className="flex justify-start">
      <div
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${stateStyles[status.state]}`}
      >
        {status.state === "thinking" && (
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-40" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
        )}
        {status.state === "error" && (
          <span className="size-2 rounded-full bg-destructive" />
        )}
        <span className="font-medium">{status.role}</span>
        <span className="text-muted-foreground">{status.text}</span>
      </div>
    </div>
  );
}
