"use client";

import { motion } from "framer-motion";
import {
  ShoppingCart, Warehouse, ChefHat, DollarSign,
  UtensilsCrossed, BookOpen, Receipt, Megaphone, BarChart3,
  Info, Check,
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
}

const TYPE_STYLES: Record<CardType, { dot: string; tag: string; border: string }> = {
  urgent: {
    dot: "bg-amber-400",
    tag: "text-amber-400 bg-amber-400/10",
    border: "border-amber-500/25 warm-glow",
  },
  action: {
    dot: "bg-blue-400",
    tag: "text-blue-400 bg-blue-400/10",
    border: "border-blue-400/20",
  },
  update: {
    dot: "bg-emerald-400",
    tag: "text-emerald-400 bg-emerald-400/10",
    border: "border-border",
  },
  info: {
    dot: "bg-violet-400",
    tag: "text-violet-400 bg-violet-400/10",
    border: "border-border",
  },
};

function relativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = Math.max(0, now - timestamp);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDeadline(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function ActionCard({ card, onExpand }: ActionCardProps) {
  const style = TYPE_STYLES[card.type];
  const isUrgent = card.type === "urgent";
  const isCommitted = card.status === "committed";
  const ModuleIcon = MODULE_ICONS[card.module] ?? Info;

  return (
    <motion.div
      layout
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onExpand(card.id)}
      className={`relative rounded-xl border bg-card/80 glass-subtle p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${style.border}`}
    >
      {/* Urgent top bar */}
      {isUrgent && (
        <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl bg-gradient-to-r from-amber-500/60 to-amber-400/30" />
      )}

      {/* Header: dot + type/module + time */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <motion.span
            animate={isUrgent ? { scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] } : {}}
            transition={isUrgent ? { duration: 2, repeat: Infinity } : {}}
            className={`size-1.5 rounded-full shrink-0 ${style.dot}`}
          />
          <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider ${style.tag} px-1.5 py-0.5 rounded`}>
            <ModuleIcon className="size-3.5 opacity-60" />
            {card.type} · {card.module}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground/50">
          {relativeTime(card.timestamp)}
        </span>
      </div>

      {/* Summary */}
      <p className={`text-[13px] font-medium leading-relaxed text-foreground/80 mb-2 ${isCommitted ? "line-through opacity-60" : ""}`}>
        {card.summary}
      </p>

      {/* Deadline badge */}
      {card.deadline && card.priority >= 1 && (
        <div className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 rounded-md px-2 py-1 text-[10px] font-semibold">
          <span>⏰</span>
          <span>{formatDeadline(card.deadline)} cutoff</span>
        </div>
      )}

      {/* Committed check */}
      {isCommitted && (
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <Check className="size-4 text-emerald-400" />
        </div>
      )}
    </motion.div>
  );
}
