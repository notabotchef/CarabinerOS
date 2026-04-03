"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatMessage, InlineStep } from "@/lib/types";
import type { Components } from "react-markdown";

// --- Data card table: renders markdown tables as standalone briefing-style cards ---
function DataCardTable(props: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="data-card -mx-4 my-3 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/8 to-primary/3 shadow-[0_0_40px_oklch(0.72_0.22_160_/_0.06)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-card-table w-full border-collapse text-[0.85em]" {...props} />
      </div>
    </div>
  );
}

const markdownComponents: Components = {
  table: DataCardTable,
};

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

// --- Dot color map by step type ---
const DOT_COLORS: Record<InlineStep["type"], string> = {
  agent: "bg-emerald-400/70",
  tool: "bg-amber-400/70",
  subagent: "bg-blue-400/70",
  response: "bg-emerald-400/70",
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m${s.toString().padStart(2, "0")}s`;
}

// --- Inline step ticket for a single message (A0-style) ---
function InlineTicket({
  steps,
  stepTitle,
  stepDuration,
}: {
  steps: InlineStep[];
  stepTitle?: string;
  stepDuration?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  const title = stepTitle || "Processing";

  return (
    <div className="w-full max-w-[85%]">
      {/* Collapsed / expanded header row */}
      <div
        className="flex items-center gap-2 px-1 py-1 cursor-pointer select-none group"
        onClick={toggle}
      >
        <span className="text-[10px] text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors">
          {expanded ? "\u25BC" : "\u25B6"}
        </span>
        <span className="text-[11px] text-muted-foreground/70 font-medium truncate flex-1 min-w-0">
          {title}
        </span>
        <span className="text-[9px] text-emerald-500/60 font-medium shrink-0">END</span>
        {stepDuration != null && (
          <span className="text-[9px] text-muted-foreground/30 shrink-0">
            {formatDuration(stepDuration)}
          </span>
        )}
      </div>

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
            <div className="mb-1 max-h-[30vh] overflow-y-auto">
              {steps.map((step, i) =>
                step.isFiller ? (
                  <div key={i} className="flex items-center gap-2 pl-4 py-0.5">
                    {/* No dot for filler — just indented italic text */}
                    <span className="w-[7px] shrink-0" />
                    <span className="text-[10px] text-muted-foreground/25 italic truncate">
                      {step.heading}
                    </span>
                  </div>
                ) : (
                  <div key={i} className="flex items-center gap-2 pl-4 py-0.5">
                    <span
                      className={`inline-block size-[7px] rounded-full shrink-0 ${DOT_COLORS[step.type]}`}
                    />
                    <span className="text-[10px] text-muted-foreground/50 truncate">
                      {step.heading}
                    </span>
                  </div>
                ),
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Strip bracket context prefix from messages sent via module chat */
function stripContext(text: string): string {
  return text.replace(/^\[.*?\]\s*/, "");
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Filter out welcome bleed — A0 greeting that arrives before user's first message
  const filtered = useMemo(() => {
    const firstUserIdx = messages.findIndex((m) => m.role === "user");
    if (firstUserIdx === -1) return messages; // no user messages yet, show everything (home greeting)
    // Drop any assistant messages before first user message that are welcome greetings
    return messages.filter((m, i) => {
      if (i >= firstUserIdx) return true; // keep everything from first user msg onward
      if (m.role !== "assistant") return true;
      const lower = m.content.toLowerCase();
      if (lower.includes("welcome to carabiner") || lower.includes("how can i help")) return false;
      return true;
    });
  }, [messages]);

  return (
    <ScrollArea className="flex-1 overflow-hidden">
      <div className="mx-auto w-full max-w-4xl px-6 sm:px-10 lg:px-16 py-6 flex flex-col gap-6">
        <AnimatePresence initial={false}>
          {filtered.map((msg) => (
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
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-gradient-to-br from-primary to-primary/85 text-primary-foreground px-4 py-2.5 text-sm leading-relaxed shadow-sm">
                  {stripContext(msg.content)}
                </div>
              ) : (
                <>
                  {/* Inline step ticket — above the assistant bubble */}
                  {msg.steps && msg.steps.length > 0 && (
                    <InlineTicket
                      steps={msg.steps}
                      stepTitle={msg.stepTitle}
                      stepDuration={msg.stepDuration}
                    />
                  )}
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-card/80 glass-subtle px-4 py-3 shadow-sm">
                    {/* Brand header */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex size-5 items-center justify-center rounded-md bg-gradient-to-br from-primary/15 to-primary/5 text-primary text-[10px] font-bold">
                        C
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                        CarabinerOS
                      </span>
                    </div>
                    {/* Markdown content */}
                    <div className="markdown-body text-sm leading-relaxed text-foreground">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{msg.content}</ReactMarkdown>
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
