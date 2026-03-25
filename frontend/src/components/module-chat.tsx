"use client";

import { useState, useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSocketContext } from "@/components/socket-provider";
import { useChat } from "@/hooks/use-chat";

/* ------------------------------------------------------------------ */
/*  Helper: strip bracket context prefix from display text             */
/* ------------------------------------------------------------------ */

function stripContext(text: string): string {
  return text.replace(/^\[.*?\]\s*/, "");
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ModuleChatProps {
  /** Function that returns the bracket context string from current module state */
  buildContext: () => string;
  /** Placeholder text */
  placeholder?: string;
  /** Quick-action chip labels */
  chips?: string[];
}

/* ------------------------------------------------------------------ */
/*  ModuleChat component                                               */
/* ------------------------------------------------------------------ */

export function ModuleChat({
  buildContext,
  placeholder = "Type a message...",
  chips = [],
}: ModuleChatProps) {
  const { snapshot } = useSocketContext();
  const { sendMessage, messages, loading, createNewChat } = useChat(snapshot);

  const [value, setValue] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const doSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // On first send, create a fresh A0 context
      if (!hasStarted) {
        await createNewChat();
        setHasStarted(true);
      }

      const context = buildContext();
      const enriched = context ? `${context} ${trimmed}` : trimmed;
      await sendMessage(enriched);
      setValue("");
    },
    [hasStarted, createNewChat, buildContext, sendMessage],
  );

  const handleSubmit = useCallback(() => {
    doSend(value);
  }, [value, doSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChipClick = (chip: string) => {
    doSend(chip);
  };

  return (
    <div className="flex flex-col border-t border-border">
      {/* Messages area */}
      {messages.length > 0 && (
        <div
          ref={scrollRef}
          className="max-h-[280px] overflow-y-auto px-4 py-3 flex flex-col gap-2"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={
                  msg.role === "user"
                    ? "bg-primary/10 rounded-xl px-3 py-2 text-sm ml-8 max-w-[85%]"
                    : "bg-muted/20 rounded-xl px-3 py-2 text-sm mr-8 max-w-[85%]"
                }
              >
                {msg.role === "assistant" ? (
                  <div className="markdown-body text-sm leading-relaxed text-foreground [&_p]:m-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {stripContext(msg.content)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <span className="text-foreground">
                    {stripContext(msg.content)}
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-muted-foreground px-1"
              >
                <Loader2 className="size-3 animate-spin" />
                <span className="text-xs">Working...</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Chips */}
      {chips.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 pt-2 flex-wrap">
          {chips.map((chip) => (
            <button
              key={chip}
              onClick={() => handleChipClick(chip)}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="
              w-full rounded-2xl border border-border bg-card/80
              py-2 px-3 pr-10 text-sm text-foreground
              placeholder:text-muted-foreground/40
              outline-none transition-all duration-200
              focus:border-primary/50 focus:ring-2 focus:ring-primary/25
              focus:shadow-[0_0_20px_oklch(0.72_0.22_160_/_0.12)]
              hover:border-primary/25
            "
          />
          <motion.button
            onClick={handleSubmit}
            disabled={!value.trim()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="
              absolute right-1.5 top-1/2 -translate-y-1/2
              size-7 rounded-lg flex items-center justify-center
              bg-gradient-to-br from-primary to-primary/80 text-primary-foreground
              hover:shadow-[0_0_12px_oklch(0.72_0.22_160_/_0.3)]
              disabled:opacity-20 disabled:shadow-none
              transition-all duration-200
            "
          >
            <ArrowUp className="size-3.5" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
