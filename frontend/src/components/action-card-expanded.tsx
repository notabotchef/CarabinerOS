"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  ActionCard,
  ActionCardType as CardType,
  CardChatMessage,
} from "@/lib/types";

interface ActionCardExpandedProps {
  card: ActionCard;
  chatThread: CardChatMessage[];
  chatLoading: boolean;
  onBack: () => void;
  onCommit: (id: string) => void;
  onDismiss: (id: string) => void;
  onSendMessage: (id: string, text: string) => void;
}

const TYPE_TAG_STYLES: Record<CardType, string> = {
  urgent: "text-amber-400 bg-amber-400/10",
  action: "text-blue-400 bg-blue-400/10",
  update: "text-emerald-400 bg-emerald-400/10",
  info: "text-violet-400 bg-violet-400/10",
};

const CHANGE_OP_STYLES: Record<string, string> = {
  "+": "text-emerald-400 bg-emerald-400/5",
  "!": "text-amber-400 bg-amber-400/5",
  "→": "text-muted-foreground bg-muted/50",
};

export function ActionCardExpanded({
  card,
  chatThread,
  chatLoading,
  onBack,
  onCommit,
  onDismiss,
  onSendMessage,
}: ActionCardExpandedProps) {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    const text = message.trim();
    if (!text) return;
    onSendMessage(card.id, text);
    setMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>Back to cards</span>
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { onDismiss(card.id); onBack(); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={() => { onCommit(card.id); onBack(); }}
            className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
            title="Commit this card"
          >
            <Check className="size-4" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <ScrollArea className="flex-1">
        <div className="p-5">
          {/* Type + Module tags */}
          <div className="flex gap-2 mb-3">
            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${TYPE_TAG_STYLES[card.type]}`}>
              {card.type}
            </span>
            <span className="text-[9px] font-semibold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded uppercase tracking-wider">
              {card.module}
            </span>
          </div>

          {/* Title */}
          <h2 className="text-base font-bold text-foreground mb-2 leading-tight">
            {card.summary}
          </h2>

          {/* Detail */}
          <p className="text-[13px] text-muted-foreground leading-relaxed mb-5">
            {card.detail}
          </p>

          {/* Stats grid */}
          {card.stats.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-5">
              {card.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="bg-muted/30 rounded-lg p-3"
                >
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                    {stat.label}
                  </div>
                  <div className="text-lg font-extrabold tabular-nums">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Changes diff */}
          {card.changes.length > 0 && (
            <div className="mb-5">
              <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                What changed
              </div>
              <div className="flex flex-col gap-1.5">
                {card.changes.map((change, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${CHANGE_OP_STYLES[change.op] ?? "bg-muted/30"}`}
                  >
                    <span className="text-xs font-bold w-3 text-center shrink-0">
                      {change.op}
                    </span>
                    <span className="text-[12px] text-foreground/70">
                      {change.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat thread */}
          {chatThread.length > 0 && (
            <div className="mb-4">
              <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Conversation
              </div>
              <div className="flex flex-col gap-2">
                {chatThread.map((msg, i) => (
                  <div
                    key={i}
                    className={`rounded-lg px-3 py-2 text-[12px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary/10 text-foreground/80 ml-6"
                        : "bg-muted/40 text-foreground/70 mr-6"
                    }`}
                  >
                    {msg.text}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-muted-foreground/50 text-xs mr-6">
                    <Loader2 className="size-3 animate-spin" />
                    <span>Working on it...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Inline chat input */}
      <div className="border-t border-border px-4 py-3 shrink-0">
        <div className="text-[10px] text-muted-foreground/50 font-medium mb-1.5">
          Make changes to this {card.module}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Add items, change quantities...`}
            className="flex-1 h-9 rounded-lg bg-muted/30 border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || chatLoading}
            className="flex size-9 items-center justify-center rounded-lg bg-primary/15 border border-primary/25 text-primary hover:bg-primary/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="text-sm">↑</span>
          </button>
        </div>
      </div>
    </div>
  );
}
