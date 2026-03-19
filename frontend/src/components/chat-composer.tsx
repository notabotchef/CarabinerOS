"use client";

import { useState, useCallback, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

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
            w-full rounded-xl border border-neutral-200 bg-white
            px-4 py-2.5 pr-12 text-sm text-neutral-900
            placeholder:text-neutral-400
            outline-none transition-colors
            focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!value.trim() || loading}
          className="
            absolute right-1.5 top-1/2 -translate-y-1/2
            size-7 rounded-lg
            bg-neutral-900 text-white
            hover:bg-neutral-700
            disabled:opacity-30 disabled:bg-neutral-900
          "
        >
          <ArrowUp className="size-4" />
        </Button>
      </div>
    </div>
  );
}
