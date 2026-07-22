"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence, type Variants } from "motion/react";
import {
  ShoppingCart,
  DollarSign,
  ChefHat,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import { MOCK_DASHBOARD } from "@/lib/mock-dashboard";
import { useWorkspace } from "@/hooks/use-workspace";

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { Promise.resolve().then(() => setMounted(true)); }, []);
  return mounted;
}

/**
 * Returns true when the user has requested reduced motion via
 * `prefers-reduced-motion: reduce`. When active, hover springs and
 * transition animations are disabled to avoid motion sickness.
 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

interface KpiCard {
  label: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  barWidth: string;
  details: { label: string; value: string }[];
}

/**
 * `null` / `undefined` / `""` / `NaN` all count as "no live value".
 * Used to gate the demo fallback so live data always wins when present.
 */
function hasLiveValue(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string" && v.trim() === "") return false;
  if (typeof v === "number" && (Number.isNaN(v) || v === 0)) return false;
  return true;
}

/**
 * Apply the demo fallback when a card's value is missing, empty, or
 * unparseable. Replaces generic placeholders ("on target", "all ready",
 * em dashes) with the operator-specified demo values. Live values pass
 * through untouched.
 */
function withMockFallback(
  label: string,
  liveCard: KpiCard,
): KpiCard {
  const mock = MOCK_DASHBOARD.find(
    (m) => m.label.toLowerCase() === label.toLowerCase(),
  );
  if (!mock) return liveCard;
  const valueMissing = !hasLiveValue(liveCard.value) || liveCard.value === "\u2014";
  if (!valueMissing) return liveCard;
  return {
    ...liveCard,
    value: mock.value,
    subtitle: mock.subtitle,
    barWidth: mock.barWidth,
    icon: mock.icon,
    details: mock.details,
  };
}

/**
 * Shared dashboard data hook.
 *
 * Uses `useWorkspace` (the same hook used by the detail pages) so the
 * dashboard cards and the detail pages read from the same API sources
 * with the same envelope handling. This guarantees dashboard totals
 * reconcile with page details.
 */
export function useDashboardSummary() {
  const orders = useWorkspace<Record<string, unknown>>("/api/orders");
  const foodCost = useWorkspace<Record<string, unknown>>("/api/food-cost");
  const prep = useWorkspace<Record<string, unknown>>("/api/prep");
  return {
    orders: orders.data,
    foodCost: foodCost.data,
    prep: prep.data,
    loading: orders.loading || foodCost.loading || prep.loading,
  };
}

export function SolitaireCards() {
  const { orders, foodCost, prep } = useDashboardSummary();

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
    ].map((c) => withMockFallback(c.label, c));
  }, [orders, foodCost, prep]);

  const mounted = useMounted();
  const reducedMotion = useReducedMotion();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const cardVariants: Variants = {
    hidden: reducedMotion
      ? { opacity: 0 }
      : { opacity: 0, y: 20, scale: 0.95 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: reducedMotion
        ? { delay: i * 0.04, duration: 0.15 }
        : { delay: i * 0.08, type: "spring", stiffness: 300, damping: 30 },
    }),
  };

  const handleKeydown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setExpandedIndex(expandedIndex === index ? null : index);
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-8 w-full max-w-[680px] mx-auto">
      {cards.map((card, i) => {
        const Icon = card.icon;
        const isOpen = expandedIndex === i;

        return (
          <motion.div
            key={card.label}
            custom={i}
            initial={mounted ? "hidden" : false}
            animate="visible"
            variants={cardVariants}
            whileHover={!isOpen && !reducedMotion ? { y: -3, transition: { type: "spring" as const, stiffness: 400, damping: 25 } } : {}}
            onClick={() => setExpandedIndex(isOpen ? null : i)}
            onKeyDown={(e) => handleKeydown(e, i)}
            role="button"
            tabIndex={0}
            aria-expanded={isOpen}
            className="relative overflow-hidden bg-card border border-border rounded-xl p-4 cursor-pointer min-h-[130px] flex flex-col transition-all duration-200 hover:border-primary/20 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {/* Header row: icon + label */}
            <div className="flex items-center gap-2 mb-3">
              <Icon className="size-4 text-muted-foreground/60" strokeWidth={1.5} />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                {card.label}
              </span>
            </div>

            {/* Value */}
            <span className="text-2xl font-bold tracking-tight leading-none tabular-nums mb-1">
              {card.value}
            </span>

            {/* Subtitle */}
            <span className="text-[11px] text-muted-foreground/70 mb-auto">
              {card.subtitle}
            </span>

            {/* Progress bar */}
            <div className="w-full h-[2px] rounded-full bg-border mt-3">
              <div className={`bg-foreground/20 ${card.barWidth} h-full rounded-full transition-all duration-500`} />
            </div>

            {/* Expanded detail overlay */}
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 bg-card border border-border rounded-xl p-4 flex flex-col justify-center text-left"
                >
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-2">
                    {card.label}
                  </span>
                  {card.details.map((d) => (
                    <div key={d.label} className="flex justify-between text-[11px] py-[3px] border-b border-border/30 last:border-none">
                      <span className="text-muted-foreground/70">{d.label}</span>
                      <span className="font-semibold tabular-nums">{d.value}</span>
                    </div>
                  ))}
                  <span className="text-[9px] text-muted-foreground/40 text-center mt-2">
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
