"use client";

import { useState, useCallback, useEffect, useRef, useMemo, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUp, Loader2, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSocketContext } from "@/components/socket-provider";
import { useChat } from "@/hooks/use-chat";

/* ------------------------------------------------------------------ */
/*  localStorage helpers for persistent module chat contexts            */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "carabiner:module-chat-contexts";

function getStoredContexts(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getStoredContext(moduleId: string): string | null {
  return getStoredContexts()[moduleId] ?? null;
}

function setStoredContext(moduleId: string, ctxId: string): void {
  const map = getStoredContexts();
  map[moduleId] = ctxId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function clearStoredContext(moduleId: string): void {
  const map = getStoredContexts();
  delete map[moduleId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

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
  /** Placeholder text */
  placeholder?: string;
  /** Quick-action chip labels */
  chips?: string[];
  /** Called after a message is sent — use to refresh parent data */
  onMessageSent?: () => void;
}

/* ------------------------------------------------------------------ */
/*  ModuleChat component                                               */
/* ------------------------------------------------------------------ */

export function ModuleChat({
  moduleId,
  buildContext,
  placeholder = "Type a message...",
  chips = [],
  onMessageSent,
}: ModuleChatProps) {
  const { snapshot, subscribe } = useSocketContext();
  const { sendMessage, messages, loading, createNewChat, resetChat } = useChat(snapshot);

  const [value, setValue] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousContextRef = useRef<string | null>(null);
  const moduleChatContextRef = useRef<string | null>(null);
  const restoredRef = useRef(false);

  // On mount: check localStorage for a stored context for this module.
  // If found, subscribe to it immediately so message history loads.
  useEffect(() => {
    const storedCtxId = getStoredContext(moduleId);
    if (storedCtxId && !restoredRef.current) {
      restoredRef.current = true;
      // Save the current main chat context so we can restore on unmount
      previousContextRef.current = snapshot?.context ?? null;
      moduleChatContextRef.current = storedCtxId;
      subscribe(storedCtxId);
      setHasStarted(true);
    }
    // Only run on mount (moduleId is stable for the lifecycle of this component)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  // Restore the previous Socket.IO context subscription when unmounting
  // so the main chat continues to work after closing the module chat.
  useEffect(() => {
    return () => {
      if (previousContextRef.current !== undefined) {
        subscribe(previousContextRef.current);
      }
    };
  }, [subscribe]);

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

      // On first send, create a fresh A0 context, send, then subscribe
      if (!hasStarted) {
        previousContextRef.current = snapshot?.context ?? null;

        const newCtxId = await createNewChat();
        if (newCtxId) {
          moduleChatContextRef.current = newCtxId;
          setStoredContext(moduleId, newCtxId);
        }
        setHasStarted(true);

        // Send the message first (createNewChat already set contextIdRef)
        const context = buildContext();
        const enriched = context ? `${context} ${trimmed}` : trimmed;
        const returnedCtx = await sendMessage(enriched);

        // Now subscribe to receive the streaming response
        const ctxToSubscribe = returnedCtx || newCtxId;
        if (ctxToSubscribe) {
          subscribe(ctxToSubscribe);
          // Update stored context if backend returned a different one
          if (returnedCtx && returnedCtx !== newCtxId) {
            moduleChatContextRef.current = returnedCtx;
            setStoredContext(moduleId, returnedCtx);
          }
        }
        setValue("");
        return;
      }

      const context = buildContext();
      const enriched = context ? `${context} ${trimmed}` : trimmed;
      await sendMessage(enriched);
      setValue("");
    },
    [hasStarted, createNewChat, buildContext, sendMessage, snapshot, subscribe, moduleId, onMessageSent],
  );

  const handleNewConversation = useCallback(() => {
    clearStoredContext(moduleId);
    moduleChatContextRef.current = null;
    restoredRef.current = false;
    resetChat();
    setHasStarted(false);
    setValue("");
  }, [moduleId, resetChat]);

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
      // Drop welcome greetings that bleed from A0's default context
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
    // Clean up raw progress text for kitchen-friendly display
    return String(progress)
      .replace(/^Calling LLM.*$/i, "Thinking...")
      .replace(/^Executing tool:\s*/i, "")
      .replace(/^carabiner_db\./i, "")
      .replace(/_/g, " ");
  }, [snapshot?.log_progress_active, snapshot?.log_progress]);

  return (
    <div className="flex flex-col border-t border-border">
      {/* Messages area */}
      {filteredMessages.length > 0 && (
        <div className="relative">
          {/* New conversation button — top-right of messages area */}
          <button
            onClick={handleNewConversation}
            title="New conversation"
            className="absolute top-2 right-3 z-10 size-6 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/10 transition-colors"
          >
            <RotateCcw className="size-3" />
          </button>
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
