"use client";

import { motion } from "motion/react";
import { X, ArrowUp, Check } from "lucide-react";
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
export function getActionLabel(card: { type: CardType; module: string; actions?: Array<{ label: string; type: string }> }): string {
  // A0-specified action takes priority
  if (card.actions?.length) return card.actions[0].label;
  // Fallback: type+module mapping
  const key = `${card.type}+${card.module}`;
  const map: Record<string, string> = {
    "urgent+orders": "Confirm",
    "urgent+inventory": "86 It",
    "action+inventory": "Order Now",
    "action+menu": "Add to Menu",
    "update+prep": "Mark Done",
    "update+invoices": "Approve",
  };
  if (map[key]) return map[key];
  if (card.type === "info") return "Got It";
  if (card.type === "urgent") return "Handle";
  if (card.type === "action") return "Act";
  return "Review";
}

export function ActionCard({ card, onExpand, onCommit, onDismiss }: ActionCardProps) {
  const style = TYPE_STYLES[card.type];
  const isCommitted = card.status === "committed";
  const actionLabel = getActionLabel(card);

  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onExpand(card.id)}
      className={[
        "relative rounded-xl bg-card cursor-pointer",
        "shadow-sm hover:shadow-md transition-shadow duration-200",
        "flex flex-col",
        isCommitted ? "opacity-60" : "",
      ].join(" ")}
    >
      {/* Content area */}
      <div className="p-4 flex-1 flex flex-col gap-1">
        {/* Module pill badge — hide if "general" (no real module) */}
        {card.module && card.module !== "general" && (
          <span className={[
            "inline-block self-start px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-sm mb-1",
            style.pill,
          ].join(" ")}>
            {card.module.replace("_", " ")}
          </span>
        )}

        {/* Title */}
        <p className={[
          "text-xs font-bold leading-tight",
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
        className="bg-muted/30 px-3 py-2 rounded-b-xl border-t border-border/40 flex items-center justify-between"
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
                className="size-7 flex items-center justify-center rounded-full text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Dismiss"
              >
                <X className="size-4" />
              </button>
            )}
            {onCommit && (
              <button
                onClick={() => onCommit(card.id)}
                className="size-7 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary to-primary/80 text-primary-foreground hover:shadow-[0_0_12px_oklch(0.72_0.22_160_/_0.3)] transition-all duration-200"
                title="Send"
              >
                <ArrowUp className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
