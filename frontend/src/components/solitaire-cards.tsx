"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { ShoppingCart, DollarSign, ChefHat, UtensilsCrossed, type LucideIcon } from "lucide-react";

interface KpiCard {
  label: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  barWidth: string;
  details: { label: string; value: string }[];
}

function useSummary(endpoint: string) {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    fetch(endpoint, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setData(Array.isArray(d) ? d : []))
      .catch(() => setData([]));
  }, [endpoint]);
  return data;
}

export function SolitaireCards() {
  const orders = useSummary("/api/orders");
  const foodCost = useSummary("/api/food-cost");
  const prep = useSummary("/api/prep");

  const cards: KpiCard[] = useMemo(() => {
    // Orders
    const pendingOrders = orders.filter((o) => o.status === "Drafting" || o.status === "Ready to send").length;
    const orderSubtitle = pendingOrders > 0 ? `${pendingOrders} needs approval` : "all sent";

    // Food Cost — average current_cost_pct
    const costs = foodCost.map((f) => parseFloat(String(f.current_cost_pct).replace(/[^0-9.]/g, ""))).filter((n) => !isNaN(n));
    const avgCost = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;
    const highPressure = foodCost.filter((f) => {
      const p = String(f.pressure).toLowerCase();
      return p.includes("+3") || p.includes("+4") || p.includes("+5") || p === "high";
    }).length;

    // Prep — readiness
    const ready = prep.filter((p) => String(p.readiness).toLowerCase() === "ready").length;
    const total = prep.length;
    const remaining = total - ready;

    return [
      {
        label: "Orders",
        value: String(orders.length),
        subtitle: orderSubtitle,
        icon: ShoppingCart,
        barWidth: orders.length > 0 ? `w-[${Math.round((pendingOrders / Math.max(orders.length, 1)) * 100)}%]` : "w-0",
        details: [
          { label: "Total orders", value: String(orders.length) },
          { label: "Needs approval", value: String(pendingOrders) },
          { label: "Submitted", value: String(orders.filter((o) => o.status === "Submitted" || o.status === "Confirmed").length) },
          { label: "Delivered", value: String(orders.filter((o) => o.status === "Delivered").length) },
        ],
      },
      {
        label: "Food Cost",
        value: avgCost > 0 ? `${avgCost.toFixed(1)}%` : "—",
        subtitle: highPressure > 0 ? `${highPressure} high pressure` : "on target",
        icon: DollarSign,
        barWidth: avgCost > 0 ? `w-[${Math.min(Math.round(avgCost * 2.5), 100)}%]` : "w-0",
        details: [
          { label: "Avg cost %", value: avgCost > 0 ? `${avgCost.toFixed(1)}%` : "—" },
          { label: "Items tracked", value: String(foodCost.length) },
          { label: "High pressure", value: String(highPressure) },
          { label: "Target", value: "27.0%" },
        ],
      },
      {
        label: "Prep",
        value: total > 0 ? `${ready}/${total}` : "—",
        subtitle: remaining > 0 ? `${remaining} remaining` : "all ready",
        icon: ChefHat,
        barWidth: total > 0 ? `w-[${Math.round((ready / total) * 100)}%]` : "w-0",
        details: [
          { label: "Ready", value: String(ready) },
          { label: "In progress", value: String(prep.filter((p) => String(p.readiness).toLowerCase() === "in progress").length) },
          { label: "Not started", value: String(prep.filter((p) => String(p.readiness).toLowerCase() === "not started").length) },
          { label: "Blocked", value: String(prep.filter((p) => String(p.readiness).toLowerCase() === "blocked").length) },
        ],
      },
      {
        label: "Covers",
        value: "142",
        subtitle: "proj. 185",
        icon: UtensilsCrossed,
        barWidth: "w-[77%]",
        details: [
          { label: "Seated now", value: "142" },
          { label: "Projected", value: "185" },
          { label: "Walk-ins", value: "23" },
          { label: "Reservations", value: "8 remaining" },
        ],
      },
    ];
  }, [orders, foodCost, prep]);

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { delay: i * 0.08, type: "spring", stiffness: 300, damping: 30 },
    }),
  };

  return (
    <div className="grid grid-cols-4 gap-4 py-8 w-full max-w-[680px] mx-auto">
      {cards.map((card, i) => {
        const Icon = card.icon;
        const isOpen = expandedIndex === i;

        return (
          <motion.div
            key={card.label}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            whileHover={!isOpen ? { y: -4, scale: 1.02, transition: { type: "spring" as const, stiffness: 400, damping: 25 } } : {}}
            onClick={() => setExpandedIndex(isOpen ? null : i)}
            className="relative overflow-hidden bg-card border border-border rounded-2xl p-5 text-center cursor-pointer min-h-[140px] flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow duration-300"
          >
            <div className="size-9 rounded-[10px] bg-muted/50 flex items-center justify-center mb-2.5">
              <Icon className="size-[18px] text-muted-foreground" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              {card.label}
            </span>
            <span className="text-3xl font-extrabold tracking-tight leading-none tabular-nums">
              {card.value}
            </span>
            <span className="mt-1 text-xs font-semibold text-muted-foreground">
              {card.subtitle}
            </span>
            <div className="w-full h-[3px] rounded-full bg-muted mt-3">
              <div className={`bg-muted-foreground/30 ${card.barWidth} h-full rounded-full`} />
            </div>

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
                      <span className="font-bold tabular-nums">{d.value}</span>
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
