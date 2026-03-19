"use client";

import { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { ShoppingBag, DollarSign, Wrench, Coffee, type LucideIcon } from "lucide-react";

interface KpiCard {
  label: string;
  value: string;
  subtitle: string;
  subtitleColor: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  barColor: string;
  barWidth: string;
  details: { label: string; value: string }[];
}

const CARDS: KpiCard[] = [
  {
    label: "Orders",
    value: "3",
    subtitle: "1 needs approval",
    subtitleColor: "text-primary",
    icon: ShoppingBag,
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    barColor: "bg-primary",
    barWidth: "w-1/3",
    details: [
      { label: "Pending approval", value: "1" },
      { label: "In progress", value: "1" },
      { label: "Ready to send", value: "1" },
      { label: "Avg lead time", value: "2.3 days" },
    ],
  },
  {
    label: "Food Cost",
    value: "28.4%",
    subtitle: "↓ 1.2%",
    subtitleColor: "text-emerald-500",
    icon: DollarSign,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
    barColor: "bg-emerald-500",
    barWidth: "w-[72%]",
    details: [
      { label: "This week", value: "28.4%" },
      { label: "Last week", value: "31.2%" },
      { label: "Target", value: "27.0%" },
      { label: "Top item", value: "Salmon ($840)" },
    ],
  },
  {
    label: "Prep",
    value: "12/18",
    subtitle: "6 remaining",
    subtitleColor: "text-indigo-500",
    icon: Wrench,
    iconBg: "bg-indigo-500/10",
    iconColor: "text-indigo-500",
    barColor: "bg-indigo-500",
    barWidth: "w-2/3",
    details: [
      { label: "Completed", value: "12" },
      { label: "In progress", value: "3" },
      { label: "Not started", value: "3" },
      { label: "Behind sched.", value: "1 item" },
    ],
  },
  {
    label: "Covers",
    value: "142",
    subtitle: "proj. 185",
    subtitleColor: "text-amber-500",
    icon: Coffee,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
    barColor: "bg-amber-500",
    barWidth: "w-[77%]",
    details: [
      { label: "Seated now", value: "142" },
      { label: "Projected", value: "185" },
      { label: "Walk-ins", value: "23" },
      { label: "Reservations left", value: "8" },
    ],
  },
];

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.08,
      type: "spring",
      stiffness: 300,
      damping: 30,
    },
  }),
};

export function SolitaireCards() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-4 gap-4 py-8 w-full max-w-[680px] mx-auto">
      {CARDS.map((card, i) => {
        const Icon = card.icon;
        const isOpen = expandedIndex === i;

        return (
          <motion.div
            key={card.label}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            whileHover={!isOpen ? { y: -4, scale: 1.02, transition: { type: "spring", stiffness: 400, damping: 25 } } : {}}
            onClick={() => setExpandedIndex(isOpen ? null : i)}
            className="relative overflow-hidden bg-card border border-border rounded-2xl p-5 text-center cursor-pointer min-h-[140px] flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow duration-300"
          >
            {/* Front face */}
            <div className={`size-9 rounded-[10px] ${card.iconBg} flex items-center justify-center mb-2.5`}>
              <Icon className={`size-[18px] ${card.iconColor}`} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              {card.label}
            </span>
            <span className="text-3xl font-extrabold tracking-tight leading-none tabular-nums">
              {card.value}
            </span>
            <span className={`mt-1 text-xs font-semibold ${card.subtitleColor}`}>
              {card.subtitle}
            </span>
            <div className="w-full h-[3px] rounded-full bg-muted mt-3">
              <div className={`${card.barColor} ${card.barWidth} h-full rounded-full`} />
            </div>

            {/* Expanded overlay */}
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="absolute inset-0 bg-card rounded-2xl p-4 flex flex-col justify-center text-left"
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                    {card.label} Breakdown
                  </span>
                  {card.details.map((d) => (
                    <div key={d.label} className="flex justify-between text-[11px] py-[3px] border-b border-border/50 last:border-none">
                      <span className="text-muted-foreground">{d.label}</span>
                      <span className="font-bold">{d.value}</span>
                    </div>
                  ))}
                  <span className="text-[9px] text-muted-foreground/60 text-center mt-2.5">
                    tap to close
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
