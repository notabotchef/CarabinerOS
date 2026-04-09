"use client";

import { useState, useCallback, useEffect, useRef, useMemo, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  /** Unique identifier for this module (e.g. "orders", "inventory", "prep") */
  moduleId: string;
  /** Function that returns the bracket context string from current module state */
  buildContext: () => string;
  /** A0 chat context ID from the DB record — subscribes to show that conversation */
  chatContextId?: string | null;
  /** Placeholder text */
  placeholder?: string;
  /** Quick-action chip labels */
  chips?: string[];
  /** Called after a message is sent — use to refresh parent data */
  onMessageSent?: () => void;
}

/* ------------------------------------------------------------------ */
/*  ModuleChat component                                               */
/*                                                                     */
/*  Attaches to the CURRENT main chat context from SocketProvider.     */
/*  Messages are sent to the active conversation with module context   */
/*  prepended (e.g. [module=orders, order_id=UUID]).                   */
/*  Only creates a new chat if the user types AND no active chat       */
/*  exists.                                                            */
/* ------------------------------------------------------------------ */

export function ModuleChat({
  moduleId,
  buildContext,
  chatContextId,
  placeholder = "Type a message...",
  chips = [],
  onMessageSent,
}: ModuleChatProps) {
  const { snapshot, subscribe } = useSocketContext();
  const { sendMessage, messages, loading, createNewChat } = useChat(snapshot);

  const [value, setValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const subscribedRef = useRef<string | null>(null);

  // Subscribe to the record's chat context — shows the conversation that
  // created/modified this specific record. Re-subscribes when record changes.
  useEffect(() => {
    if (chatContextId && chatContextId !== subscribedRef.current) {
      subscribedRef.current = chatContextId;
      subscribe(chatContextId);
    }
  }, [chatContextId, subscribe]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Refresh parent data when A0 finishes responding (loading: true → false)
  const wasLoadingRef = useRef(false);
  useEffect(() => {
    if (wasLoadingRef.current && !loading && onMessageSent) {
      onMessageSent();
    }
    wasLoadingRef.current = loading;
  }, [loading, onMessageSent]);

  const doSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // If no active context, create one
      const hasContext = !!snapshot?.context || !!chatContextId;
      if (!hasContext) {
        const newCtxId = await createNewChat();
        if (newCtxId) {
          subscribe(newCtxId);
        }
      }

      // Prepend module context and send to the current conversation
      const context = buildContext();
      const enriched = context ? `${context} ${trimmed}` : trimmed;
      const returnedCtx = await sendMessage(enriched);

      // If backend returned a new context (first message), subscribe to it
      if (returnedCtx && returnedCtx !== snapshot?.context) {
        subscribe(returnedCtx);
      }

      setValue("");
    },
    // React Compiler infers `chatContextId` from the `hasContext` check on
    // line 95. Keep the dep list aligned with inference so the compiler can
    // preserve its own memoization (otherwise it bails out entirely).
    [createNewChat, buildContext, sendMessage, snapshot, subscribe, chatContextId],
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

  // Filter out A0 welcome/bleed messages — drop greetings and anything before first user msg
  const filteredMessages = useMemo(() => {
    const firstUserIdx = messages.findIndex((m) => m.role === "user");
    if (firstUserIdx === -1) return [];
    return messages.slice(firstUserIdx).filter((m) => {
      if (m.role !== "assistant") return true;
      const lower = m.content.toLowerCase();
      if (lower.includes("welcome to carabiner")) return false;
      if (lower.includes("how can i help")) return false;
      return true;
    });
  }, [messages]);

  // Expo whisper — show what A0 is actively doing (tool calls, agent steps)
  const expoStatus = useMemo(() => {
    if (!snapshot?.log_progress_active) return null;
    const progress = snapshot.log_progress;
    if (!progress) return null;
    return String(progress)
      .replace(/^Calling LLM.*$/i, "Thinking...")
      .replace(/^Executing tool:\s*/i, "")
      .replace(/^carabiner_db\./i, "")
      .replace(/_/g, " ");
    // React Compiler infers the whole `snapshot` object as the source
    // dependency (it cannot statically prove the two optional-chain reads are
    // the only ones). Use the broader dep so the compiler's own memoization
    // sticks — the cost of recomputing when snapshot changes is trivial.
  }, [snapshot]);

  return (
    <div className="flex flex-col border-t border-border">
      {/* Messages area — shows messages from the current main chat */}
      {filteredMessages.length > 0 && (
        <div className="relative">
          <div
            ref={scrollRef}
            className="max-h-[280px] overflow-y-auto px-4 py-3 flex flex-col gap-2"
          >
          {filteredMessages.map((msg) => (
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

          {/* Expo whisper — shows what A0 is doing */}
          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-muted-foreground px-1"
              >
                <Loader2 className="size-3 animate-spin" />
                <span className="text-xs font-mono truncate max-w-[200px]">
                  {expoStatus ?? "Working..."}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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
