"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatMessage } from "@/lib/types";

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <ScrollArea className="flex-1 overflow-hidden">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            {/* Label */}
            <span className="mb-1 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
              {msg.role === "user" ? "You" : "CarabinerOS\u{1F990}"}
            </span>

            {/* Message bubble */}
            {msg.role === "user" ? (
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-neutral-100 px-4 py-2.5 text-sm leading-relaxed text-neutral-800">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[85%] text-[15px] leading-relaxed text-neutral-800 prose prose-neutral prose-sm prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
