"use client";

import type { StatusPayload } from "@/lib/chat-helpers";

interface ChatStatusPillProps {
  status: StatusPayload | null;
}

export function ChatStatusPill({ status }: ChatStatusPillProps) {
  if (!status || status.state === "waiting") return null;

  return (
    <div className="flex justify-center py-2 animate-in fade-in duration-200">
      <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5">
        <span
          className={`size-1.5 rounded-full ${
            status.state === "error" ? "bg-destructive" : "bg-amber-500"
          } animate-pulse`}
        />
        <span className="text-xs text-muted-foreground">
          {status.role} &middot; {status.text}
        </span>
      </div>
    </div>
  );
}
