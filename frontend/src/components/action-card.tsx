"use client";

import { motion } from "framer-motion";
import { X, Send, Check } from "lucide-react";
import type { ActionCard as ActionCardType, ActionCardType as CardType } from "@/lib/types";

interface ActionCardProps {
  card: ActionCardType;
  onExpand: (id: string) => void;
  onCommit?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

/** Color map for module pill badges. */
export const TYPE_STYLES: Record<CardType, {
  border: string;
  accent: string;
  tag: string;
  dot: string;
  bg: string;
  pill: string;
}> = {
  urgent: {
    border: "border-l-amber-500",
    accent: "text-amber-400",
    tag: "text-amber-300 bg-amber-500/10",
    dot: "bg-amber-400",
    bg: "bg-amber-500/5",
    pill: "bg-amber-500/20 text-amber-300",
  },
  action: {
    border: "border-l-blue-500",
    accent: "text-blue-400",
    tag: "text-blue-300 bg-blue-500/10",
    dot: "bg-blue-400",
    bg: "bg-blue-500/5",
    pill: "bg-blue-500/20 text-blue-300",
  },
  update: {
    border: "border-l-emerald-500",
    accent: "text-emerald-400",
    tag: "text-emerald-300 bg-emerald-500/15",
    dot: "bg-emerald-400",
    bg: "bg-transparent",
    pill: "bg-emerald-500/20 text-emerald-300",
  },
  info: {
    border: "border-l-violet-500",
    accent: "text-violet-400",
    tag: "text-violet-300 bg-violet-500/15",
    dot: "bg-violet-400",
    bg: "bg-transparent",
    pill: "bg-violet-500/20 text-violet-300",
  },
};

/** Maps type+module to a contextual action button label, like a kitchen callout. */
export function getActionLabel(type: CardType, module: string): string {
  const key = `${type}+${module}`;
  const map: Record<string, string> = {
    "urgent+orders": "Confirm",
    "urgent+inventory": "86 It",
    "action+inventory": "Order Now",
    "action+menu": "Add to Menu",
    "update+prep": "Mark Done",
    "update+invoices": "Approve",
  };
  if (map[key]) return map[key];
  if (type === "info") return "Got It";
  if (type === "urgent") return "Handle";
  if (type === "action") return "Act";
  return "Review";
}

function relativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = Math.max(0, now - timestamp);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function formatDeadline(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function ActionCard({ card, onExpand, onCommit, onDismiss }: ActionCardProps) {
  const style = TYPE_STYLES[card.type];
  const isCommitted = card.status === "committed";
  const actionLabel = getActionLabel(card.type, card.module);

  return (
    <motion.div
      layout
      layoutId={`card-${card.id}`}
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onExpand(card.id)}
      className={[
        "relative rounded-xl bg-card cursor-pointer",
        "shadow-sm hover:shadow-md transition-shadow duration-300",
        "flex flex-col aspect-[4/5]",
        isCommitted ? "opacity-60" : "",
      ].join(" ")}
    >
      {/* Content area */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Module pill badge */}
        <span className={[
          "inline-block self-start px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-sm mb-2",
          style.pill,
        ].join(" ")}>
          {card.module}
        </span>

        {/* Title */}
        <p className={[
          "text-xs font-bold leading-tight mb-1",
          isCommitted ? "line-through opacity-50" : "",
        ].join(" ")}>
          {card.summary}
        </p>

        {/* Description */}
        {card.detail && (
          <p className="text-[10px] text-muted-foreground leading-relaxed opacity-80 line-clamp-3">
            {card.detail}
          </p>
        )}
      </div>

      {/* Footer */}
      <div
        className="bg-muted/30 p-3 rounded-b-xl border-t border-border/40 mt-auto flex items-center justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Action label */}
        {!isCommitted ? (
          <p className="text-[11px] font-black text-primary">{actionLabel}?</p>
        ) : (
          <div className="flex items-center gap-1 text-emerald-400/60">
            <Check className="size-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Done</span>
          </div>
        )}

        {/* Icon buttons */}
        {!isCommitted && (
          <div className="flex gap-1.5">
            {onDismiss && (
              <button
                onClick={() => onDismiss(card.id)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Dismiss"
              >
                <X className="size-4" />
              </button>
            )}
            {onCommit && (
              <button
                onClick={() => onCommit(card.id)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-primary hover:bg-primary/10 transition-colors"
                title="Send"
              >
                <Send className="size-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
