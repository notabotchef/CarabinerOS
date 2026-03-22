"use client";

import { motion } from "framer-motion";
import {
  ShoppingCart, Warehouse, ChefHat, DollarSign,
  UtensilsCrossed, BookOpen, Receipt, Megaphone, BarChart3,
  Info, Check, X,
  type LucideIcon,
} from "lucide-react";
import type { ActionCard as ActionCardType, ActionCardType as CardType } from "@/lib/types";

const MODULE_ICONS: Record<string, LucideIcon> = {
  orders: ShoppingCart,
  inventory: Warehouse,
  prep: ChefHat,
  "food-cost": DollarSign,
  food_cost: DollarSign,
  menu: UtensilsCrossed,
  recipes: BookOpen,
  invoices: Receipt,
  marketing: Megaphone,
  reporting: BarChart3,
};

interface ActionCardProps {
  card: ActionCardType;
  onExpand: (id: string) => void;
  onCommit?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

/** Kitchen-ticket inspired color map. Left border = station color. */
const TYPE_STYLES: Record<CardType, {
  border: string;
  accent: string;
  tag: string;
  dot: string;
  bg: string;
}> = {
  urgent: {
    border: "border-l-amber-500",
    accent: "text-amber-400",
    tag: "text-amber-300 bg-amber-500/15",
    dot: "bg-amber-400",
    bg: "bg-amber-500/[0.03]",
  },
  action: {
    border: "border-l-blue-500",
    accent: "text-blue-400",
    tag: "text-blue-300 bg-blue-500/15",
    dot: "bg-blue-400",
    bg: "bg-blue-500/[0.03]",
  },
  update: {
    border: "border-l-emerald-500",
    accent: "text-emerald-400",
    tag: "text-emerald-300 bg-emerald-500/15",
    dot: "bg-emerald-400",
    bg: "bg-transparent",
  },
  info: {
    border: "border-l-violet-500",
    accent: "text-violet-400",
    tag: "text-violet-300 bg-violet-500/15",
    dot: "bg-violet-400",
    bg: "bg-transparent",
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
  const isUrgent = card.type === "urgent";
  const isCommitted = card.status === "committed";
  const ModuleIcon = MODULE_ICONS[card.module] ?? Info;
  const actionLabel = getActionLabel(card.type, card.module);

  return (
    <motion.div
      layout
      layoutId={`card-${card.id}`}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onExpand(card.id)}
      className={[
        "relative rounded-lg border border-border/60 border-l-[3px] cursor-pointer",
        "transition-shadow duration-150 hover:shadow-lg hover:shadow-black/10",
        style.border,
        style.bg,
        isCommitted ? "opacity-60" : "",
      ].join(" ")}
    >
      {/* Compact ticket layout */}
      <div className="px-3 py-2.5">
        {/* Row 1: Station tag + time */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            {/* Pulsing dot for urgent */}
            <motion.span
              animate={isUrgent ? { scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] } : {}}
              transition={isUrgent ? { duration: 1.5, repeat: Infinity } : {}}
              className={`size-1.5 rounded-full shrink-0 ${style.dot}`}
            />
            <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.08em] ${style.tag} px-1.5 py-0.5 rounded font-mono`}>
              <ModuleIcon className="size-3 opacity-70" />
              {card.module}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground/40 font-mono tabular-nums">
            {relativeTime(card.timestamp)}
          </span>
        </div>

        {/* Row 2: Summary -- the ticket body */}
        <p className={`text-[13px] font-semibold leading-snug text-foreground/85 mb-2 line-clamp-2 ${isCommitted ? "line-through opacity-50" : ""}`}>
          {card.summary}
        </p>

        {/* Row 3: Deadline + action buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {card.deadline && card.priority >= 1 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400/80 bg-amber-500/10 rounded px-1.5 py-0.5 font-mono">
                {formatDeadline(card.deadline)}
              </span>
            )}
          </div>

          {/* Action cluster: dismiss / action / commit */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {onDismiss && !isCommitted && (
              <button
                onClick={() => onDismiss(card.id)}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Dismiss"
              >
                <X className="size-3.5" />
              </button>
            )}

            {!isCommitted && (
              <button
                onClick={() => onExpand(card.id)}
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${style.accent} bg-current/[0.08] hover:bg-current/[0.15] transition-colors`}
                style={{ backgroundColor: undefined }}
              >
                <span className={style.accent}>{actionLabel}</span>
              </button>
            )}

            {onCommit && !isCommitted && (
              <button
                onClick={() => onCommit(card.id)}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground/40 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                title="Commit"
              >
                <Check className="size-3.5" />
              </button>
            )}

            {isCommitted && (
              <div className="flex items-center gap-1 text-emerald-400/60">
                <Check className="size-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Done</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
