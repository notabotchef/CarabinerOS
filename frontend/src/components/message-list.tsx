"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatMessage, InlineStep } from "@/lib/types";

interface MessageListProps {
  messages: ChatMessage[];
}

const messageVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
};

// --- Dot color map (matches ExpoTicket) ---
const DOT_COLORS: Record<InlineStep["type"], string> = {
  agent: "bg-emerald-500/50",
  tool: "bg-orange-500/50",
  subagent: "bg-blue-400/50",
  response: "bg-emerald-500/50",
};

// --- Inline step ticket for a single message ---
function InlineTicket({ steps }: { steps: InlineStep[] }) {
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  return (
    <div className="w-full max-w-[85%]">
      {/* Toggle button */}
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1 px-1 py-0.5 text-[10px] text-emerald-500/50 hover:text-emerald-500/80 transition-colors cursor-pointer select-none"
      >
        <span>{steps.length} step{steps.length !== 1 ? "s" : ""}</span>
        <span
          className="inline-block transition-transform duration-200"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▲
        </span>
      </button>

      {/* Expandable step list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="inline-ticket"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mb-1 rounded-lg bg-muted/30 border border-border/40 max-h-[30vh] overflow-y-auto">
              <div className="px-3 py-2 space-y-0.5">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 min-h-[16px]">
                    <span
                      className={`mt-[4px] inline-block size-[5px] rounded-full shrink-0 ${
                        step.isFiller ? "bg-white/15" : DOT_COLORS[step.type]
                      }`}
                    />
                    <span
                      className={`leading-tight truncate ${
                        step.isFiller
                          ? "italic text-muted-foreground/40"
                          : "text-muted-foreground/60"
                      }`}
                      style={{ fontSize: "9px" }}
                    >
                      {step.heading}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <ScrollArea className="flex-1 overflow-hidden">
      <div className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-6">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              variants={messageVariants}
              initial="hidden"
              animate="visible"
              className={`flex flex-col ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              {msg.role === "user" ? (
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm leading-relaxed">
                  {msg.content}
                </div>
              ) : (
                <>
                  {/* Inline step ticket — above the assistant bubble */}
                  {msg.steps && msg.steps.length > 0 && (
                    <InlineTicket steps={msg.steps} />
                  )}
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3">
                    {/* Brand header */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary text-[10px] font-bold">
                        C
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        CarabinerOS
                      </span>
                    </div>
                    {/* Markdown content */}
                    <div className="markdown-body text-sm leading-relaxed text-foreground">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
