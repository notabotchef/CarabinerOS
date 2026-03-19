"use client";

import { useState, useCallback, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { ArrowUp } from "lucide-react";

interface ChatComposerProps {
  onSend: (text: string) => void;
  loading?: boolean;
  placeholder?: string;
}

export function ChatComposer({
  onSend,
  loading = false,
  placeholder = "Ask CarabinerOS anything\u2026",
}: ChatComposerProps) {
  const [value, setValue] = useState("");

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setValue("");
  }, [value, loading, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <div className="relative flex-1">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={loading}
          className="
            w-full rounded-2xl border border-border bg-card
            px-4 py-2.5 pr-12 text-sm text-foreground
            placeholder:text-muted-foreground/50
            outline-none transition-all
            focus:border-primary/40 focus:ring-2 focus:ring-primary/20
            focus:shadow-[0_0_12px_rgba(var(--primary),0.08)]
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        />
        <motion.button
          onClick={handleSubmit}
          disabled={!value.trim() || loading}
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
  );
}
