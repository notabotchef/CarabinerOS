"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { SUGGESTED_PROMPTS } from "@/lib/chat-helpers";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface ChatComposerProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  hasMessages?: boolean;
  suggestedPrompts?: string[];
}

export function ChatComposer({ onSend, disabled, hasMessages, suggestedPrompts }: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [promptIndex, setPromptIndex] = useState(0);
  const [showPrompts, setShowPrompts] = useState(true);
  const [promptVisible, setPromptVisible] = useState(true);
  const chatPrompt = useWorkspaceStore((s) => s.chatPrompt);
  const setChatPrompt = useWorkspaceStore((s) => s.setChatPrompt);
  const prompts = suggestedPrompts ?? SUGGESTED_PROMPTS;

  // Consume chatPrompt from workspace store (e.g., from "Ask CarabinerOS" button)
  useEffect(() => {
    if (chatPrompt) {
      setValue(chatPrompt);
      setShowPrompts(false);
      setChatPrompt(null);
      textareaRef.current?.focus();
    }
  }, [chatPrompt, setChatPrompt]);

  // Hide prompts once there are messages
  useEffect(() => {
    if (hasMessages) setShowPrompts(false);
  }, [hasMessages]);

  // Rotate prompts
  useEffect(() => {
    if (!showPrompts) return;
    const interval = setInterval(() => {
      setPromptVisible(false);
      setTimeout(() => {
        setPromptIndex((i) => (i + 1) % prompts.length);
        setPromptVisible(true);
      }, 400);
    }, 8000);
    return () => clearInterval(interval);
  }, [showPrompts, prompts]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }
  }, [value]);

  const handleSend = useCallback(() => {
    const text = showPrompts && !value ? prompts[promptIndex] : value.trim();
    if (!text) return;
    onSend(text);
    setValue("");
    setShowPrompts(false);
  }, [value, showPrompts, promptIndex, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled) handleSend();
      return;
    }
    if (showPrompts && !value) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setPromptVisible(false);
        setTimeout(() => {
          setPromptIndex((i) => (i - 1 + prompts.length) % prompts.length);
          setPromptVisible(true);
        }, 200);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPromptVisible(false);
        setTimeout(() => {
          setPromptIndex((i) => (i + 1) % prompts.length);
          setPromptVisible(true);
        }, 200);
        return;
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    if (showPrompts && e.target.value) setShowPrompts(false);
    if (!e.target.value && !hasMessages) setShowPrompts(true);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="relative flex items-center gap-2 rounded-2xl border bg-card p-2 transition-shadow focus-within:shadow-[0_0_0_1px_hsl(var(--primary)/0.3),0_0_12px_hsl(var(--primary)/0.1)]">
        {/* Attach button */}
        <button
          type="button"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-accent self-center"
          aria-label="Attach file"
        >
          <Plus className="size-4" />
        </button>

        {/* Input area */}
        <div className="relative flex-1 min-h-[36px] flex items-center">
          {showPrompts && !value && (
            <div
              className="absolute inset-0 flex items-center pointer-events-none px-1 transition-opacity duration-400"
              style={{ opacity: promptVisible ? 0.4 : 0 }}
              aria-live="off"
            >
              <span className="text-sm text-muted-foreground">
                {prompts[promptIndex]}
              </span>
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={1}
            className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground/40 disabled:opacity-50 py-1.5 px-1"
            placeholder={showPrompts ? "" : "Ask CarabinerOS anything..."}
            aria-label="Message CarabinerOS"
            aria-describedby="composer-hint"
          />
        </div>

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:opacity-90 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 self-center"
          aria-label="Send message"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
      {showPrompts && !hasMessages && (
        <p id="composer-hint" className="text-center text-[10px] text-muted-foreground/40 mt-2">
          Press Enter to run this prompt &middot; Start typing to replace
        </p>
      )}
    </div>
  );
}
