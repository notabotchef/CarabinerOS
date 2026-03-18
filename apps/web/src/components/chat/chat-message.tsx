"use client";

import Markdown from "react-markdown";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export function ChatMessageBubble({ role, content, isStreaming }: ChatMessageProps) {
  if (role === "user") {
    return (
      <div className="flex justify-end animate-in slide-in-from-bottom-2 fade-in duration-150">
        <div className="max-w-[80%] rounded-[14px] rounded-br-[4px] bg-red-600 px-4 py-2.5 text-white">
          <p className="text-sm">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-in slide-in-from-bottom-2 fade-in duration-150">
      <div className="max-w-[85%] rounded-[14px] rounded-bl-[4px] border bg-card px-4 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          CarabinerOS
        </p>
        <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed [&_ul]:my-1 [&_li]:my-0 [&_p]:my-1 [&_strong]:text-foreground">
          <Markdown>{content}</Markdown>
        </div>
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-foreground/60 ml-0.5 animate-blink" />
        )}
      </div>
    </div>
  );
}
