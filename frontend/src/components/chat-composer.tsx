"use client";

import { useState, useCallback, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp } from "lucide-react";

interface ChatComposerProps {
  onSend: (text: string) => void;
  loading?: boolean;
  placeholder?: string;
  queueCount?: number;
}

export function ChatComposer({
  onSend,
  loading = false,
  placeholder = "Ask CarabinerOS anything\u2026",
  queueCount = 0,
}: ChatComposerProps) {
  const [value, setValue] = useState("");

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
  }, [value, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col gap-0">
      {/* Queue indicator */}
      <AnimatePresence>
        {queueCount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pt-2"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-40" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              <span>
                {queueCount} message{queueCount > 1 ? "s" : ""} queued — will send when ready
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2 px-4 py-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={loading ? "Type your next message\u2026" : placeholder}
            className="
              w-full rounded-2xl border border-border bg-card
              px-4 py-2.5 pr-12 text-sm text-foreground
              placeholder:text-muted-foreground/50
              outline-none transition-all
              focus:border-primary/40 focus:ring-2 focus:ring-primary/20
              focus:shadow-[0_0_12px_rgba(var(--primary),0.08)]
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
              bg-primary text-primary-foreground
              hover:opacity-90
              disabled:opacity-30
              transition-opacity
            "
          >
            <ArrowUp className="size-4" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
