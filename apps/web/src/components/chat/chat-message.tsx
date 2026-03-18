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
      <div className="flex justify-end animate-in slide-in-from-bottom-2 fade-in duration-200">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm px-4 py-2.5 bg-primary text-primary-foreground">
          <p className="text-sm leading-relaxed">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-in slide-in-from-bottom-2 fade-in duration-200">
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm border bg-card px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary text-[10px] font-bold">
            C
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            CarabinerOS
          </span>
        </div>
        <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed [&_ul]:my-1 [&_li]:my-0 [&_p]:my-1 [&_strong]:text-foreground [&_code]:text-primary [&_code]:bg-primary/10 [&_code]:px-1 [&_code]:rounded">
          <Markdown>{content}</Markdown>
        </div>
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-primary/60 ml-0.5 animate-blink rounded-sm" />
        )}
      </div>
    </div>
  );
}
