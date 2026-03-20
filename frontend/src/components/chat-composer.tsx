"use client";

import { useState, useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Paperclip } from "lucide-react";

// Prompts that exercise real Agent Zero tool capabilities
const ROTATING_PROMPTS = [
  // Orders (order_tool)
  "Draft a produce order for Coastal Produce",
  "Show me all pending orders",
  "What orders need approval today?",
  // Inventory (inventory_tool)
  "What inventory items are below par?",
  "Run an inventory check for the walk-in",
  "How much salmon do we have on hand?",
  // Prep (prep_tool)
  "Build tonight's prep list",
  "What prep tasks are blocked right now?",
  "Show me the grill station prep status",
  // Food Cost (food_cost_tool)
  "What's my food cost this week?",
  "Which dishes have the worst margin?",
  "What's driving food cost up?",
  // Menu (menu_tool)
  "Which menu items are Stars vs Dogs?",
  "Recommend menu changes based on margins",
  "Show me underperforming appetizers",
  // Recipes (recipe_tool)
  "Show me all active recipes",
  "What recipes use burrata?",
  "Cost out the Lemon Curd recipe",
  // Invoice (invoice_tool)
  "Process yesterday's invoices",
  "Show me invoices pending approval",
  "Compare this week's Sysco prices to last month",
  // Marketing (marketing_tool)
  "Generate a weekend social media post",
  "What campaigns are live right now?",
  "Brainstorm content ideas for Valentine's Day",
  // Reporting (reporting_tool)
  "Run a daily P&L report",
  "How did we do last Friday vs this Friday?",
  "What's our labor cost percentage today?",
  // Multi-agent delegation
  "Give me a full operational briefing",
  "What needs my attention before dinner service?",
  "Compare prices between Sysco and Chef's Warehouse",
];

interface ChatComposerProps {
  onSend: (text: string) => void;
  loading?: boolean;
  placeholder?: string;
  queueCount?: number;
  showSuggestions?: boolean;
}

export function ChatComposer({
  onSend,
  loading = false,
  placeholder,
  queueCount = 0,
  showSuggestions = false,
}: ChatComposerProps) {
  const [value, setValue] = useState("");
  const [promptIndex, setPromptIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rotate prompts every 4 seconds
  useEffect(() => {
    if (value || isFocused) return;
    const timer = setInterval(() => {
      setPromptIndex((i) => (i + 1) % ROTATING_PROMPTS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [value, isFocused]);

  // Randomize starting prompt
  useEffect(() => {
    setPromptIndex(Math.floor(Math.random() * ROTATING_PROMPTS.length));
  }, []);

  const currentPrompt = ROTATING_PROMPTS[promptIndex];
  const showRotating = !value && !isFocused && !loading && showSuggestions;

  const handleSubmit = useCallback(() => {
    // If input is empty and rotating prompt is visible, send the current prompt
    const text = value.trim() || (showSuggestions && !isFocused ? currentPrompt : "");
    if (!text) return;
    onSend(text);
    setValue("");
  }, [value, onSend, showSuggestions, isFocused, currentPrompt]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // For now, mention the file in chat — Agent Zero handles uploads via its own mechanism
      onSend(`[Attached: ${file.name}] ${value.trim()}`);
      setValue("");
      e.target.value = "";
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
        {/* Attachment button */}
        <button
          onClick={handleAttachClick}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent transition-colors"
          title="Attach file"
        >
          <Paperclip className="size-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.csv,.xlsx,.xls,.doc,.docx,.txt"
          onChange={handleFileChange}
        />

        {/* Input container */}
        <div className="relative flex-1">
          {/* Rotating prompt overlay — inside the input area */}
          <AnimatePresence mode="wait">
            {showRotating && (
              <motion.span
                key={promptIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 0.4, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none pr-14 truncate max-w-[calc(100%-3.5rem)]"
                onClick={() => {
                  setValue(currentPrompt);
                  inputRef.current?.focus();
                }}
                style={{ pointerEvents: "auto", cursor: "text" }}
              >
                {currentPrompt}
              </motion.span>
            )}
          </AnimatePresence>

          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={loading ? "Type your next message\u2026" : (showSuggestions ? "" : (placeholder ?? "Ask CarabinerOS anything\u2026"))}
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
            disabled={!value.trim() && !showSuggestions}
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
