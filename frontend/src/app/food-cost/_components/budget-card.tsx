"use client";

import { motion } from "framer-motion";
import { Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BudgetData {
  id: string | null;
  period_start: string | null;
  period_end: string | null;
  target_food_cost_pct: number | null;
  target_labor_pct: number | null;
  target_revenue: number | null;
  actual_purchases: number;
  actual_sales: number;
  actual_food_cost_pct: number | null;
  over_under: number | null;
  days_elapsed: number;
  days_total: number;
}

interface BudgetCardProps {
  budget: BudgetData | null;
  loading: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmtDollar(val: number): string {
  return `$${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start || !end) return "No active budget period";
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(s)} - ${fmt(e)}`;
}

/* ------------------------------------------------------------------ */
/*  Row component                                                      */
/* ------------------------------------------------------------------ */

function BudgetRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold font-mono tabular-nums ${accent ?? "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Export                                                             */
/* ------------------------------------------------------------------ */

export function BudgetCard({ budget, loading }: BudgetCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
    );
  }

  if (!budget || !budget.id) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">
          <Wallet className="h-3.5 w-3.5" />
          Budget
        </div>
        <p className="text-sm text-muted-foreground">
          No active budget period. Use chat to set one: &ldquo;Set weekly food budget to $14,000&rdquo;
        </p>
      </div>
    );
  }

  const overUnder = budget.over_under ?? 0;
  const isOver = overUnder > 0;
  const overUnderText = isOver
    ? `+${fmtDollar(overUnder)}`
    : overUnder < 0
      ? `-${fmtDollar(Math.abs(overUnder))}`
      : "$0";
  const overUnderAccent = isOver ? "text-red-400" : overUnder < 0 ? "text-emerald-400" : "";

  // Progress bar
  const targetRev = budget.target_revenue ?? 0;
  const progressPct =
    targetRev > 0 ? Math.min((budget.actual_purchases / (targetRev * (budget.target_food_cost_pct ?? 30) / 100)) * 100, 100) : 0;
  const progressColor = isOver ? "bg-red-500" : "bg-emerald-500";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-xl border border-border/60 bg-card p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <Wallet className="h-3.5 w-3.5" />
          Budget Checkbook
        </div>
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
          {formatDateRange(budget.period_start, budget.period_end)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-muted/40 overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="space-y-0">
        <BudgetRow
          label="Target Food Cost %"
          value={budget.target_food_cost_pct !== null ? `${budget.target_food_cost_pct}%` : "--"}
        />
        <BudgetRow
          label="Total Spend (Period)"
          value={fmtDollar(budget.actual_purchases)}
        />
        <BudgetRow
          label="Total Revenue (Period)"
          value={fmtDollar(budget.actual_sales)}
        />
        <BudgetRow
          label="Actual Food Cost %"
          value={budget.actual_food_cost_pct !== null ? `${budget.actual_food_cost_pct}%` : "--"}
          accent={
            budget.actual_food_cost_pct !== null && budget.target_food_cost_pct !== null
              ? budget.actual_food_cost_pct > budget.target_food_cost_pct
                ? "text-red-400"
                : "text-emerald-400"
              : undefined
          }
        />
        <BudgetRow
          label="Over / Under"
          value={overUnderText}
          accent={overUnderAccent}
        />
        <BudgetRow
          label="Days Elapsed"
          value={`${budget.days_elapsed} / ${budget.days_total}`}
        />
      </div>
    </motion.div>
  );
}
