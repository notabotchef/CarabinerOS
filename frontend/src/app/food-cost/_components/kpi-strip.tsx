"use client";

import { motion } from "motion/react";
import {
  DollarSign,
  TrendingUp,
  Target,
  Percent,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FoodCostSummary {
  today_food_cost_pct: number | null;
  today_sales: number | null;
  today_purchases: number | null;
  period_food_cost_pct: number | null;
  period_total_purchases: number;
  period_total_sales: number;
  budget_target_pct: number | null;
  budget_amount: number | null;
  budget_over_under: number | null;
  prime_cost_pct: number | null;
  period_start: string | null;
  period_end: string | null;
}

interface KpiStripProps {
  summary: FoodCostSummary | null;
  loading: boolean;
}

/* ------------------------------------------------------------------ */
/*  KPI Card                                                           */
/* ------------------------------------------------------------------ */

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  bar,
  delay,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  accent: string;
  bar: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-4"
    >
      <div className={`absolute inset-x-0 top-0 h-[2px] ${bar}`} />
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <span className={`text-3xl font-bold font-mono tabular-nums tracking-tight ${accent}`}>
        {value}
      </span>
      {accent === "text-emerald-400" && value !== "--" && (
        <span className="text-[10px] text-emerald-500 mt-0.5">On track</span>
      )}
      {accent === "text-red-400" && value !== "--" && (
        <span className="text-[10px] text-amber-500 mt-0.5">Watch this</span>
      )}
    </motion.div>
  );
}

function KpiSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Color helpers                                                      */
/* ------------------------------------------------------------------ */

function pctAccent(pct: number | null, target: number | null): { text: string; bar: string } {
  if (pct === null) return { text: "text-muted-foreground", bar: "bg-muted" };
  const t = target ?? 30;
  if (pct > t) return { text: "text-red-400", bar: "bg-gradient-to-r from-red-500 to-red-500/0" };
  return { text: "text-emerald-400", bar: "bg-gradient-to-r from-emerald-500 to-emerald-500/0" };
}

function overUnderAccent(val: number | null): { text: string; bar: string } {
  if (val === null) return { text: "text-muted-foreground", bar: "bg-muted" };
  if (val > 0) return { text: "text-red-400", bar: "bg-gradient-to-r from-red-500 to-red-500/0" };
  if (val < 0) return { text: "text-emerald-400", bar: "bg-gradient-to-r from-emerald-500 to-emerald-500/0" };
  return { text: "text-foreground", bar: "bg-muted" };
}

function primeCostAccent(pct: number | null): { text: string; bar: string } {
  if (pct === null) return { text: "text-muted-foreground", bar: "bg-muted" };
  if (pct > 60) return { text: "text-red-400", bar: "bg-gradient-to-r from-red-500 to-red-500/0" };
  if (pct >= 55) return { text: "text-amber-400", bar: "bg-gradient-to-r from-amber-500 to-amber-500/0" };
  return { text: "text-emerald-400", bar: "bg-gradient-to-r from-emerald-500 to-emerald-500/0" };
}

/* ------------------------------------------------------------------ */
/*  Export                                                             */
/* ------------------------------------------------------------------ */

export function KpiStrip({ summary, loading }: KpiStripProps) {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
      </div>
    );
  }

  const todayColors = pctAccent(summary.today_food_cost_pct, summary.budget_target_pct);
  const periodColors = pctAccent(summary.period_food_cost_pct, summary.budget_target_pct);
  const overUnderColors = overUnderAccent(summary.budget_over_under);
  const primeColors = primeCostAccent(summary.prime_cost_pct);

  const formatOverUnder = (val: number | null) => {
    if (val === null) return "--";
    const prefix = val > 0 ? "+" : "";
    return `${prefix}$${Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="Today's Food Cost"
        value={summary.today_food_cost_pct !== null ? `${summary.today_food_cost_pct.toFixed(1)}%` : "--"}
        icon={DollarSign}
        accent={todayColors.text}
        bar={todayColors.bar}
        delay={0}
      />
      <KpiCard
        label="Period-to-Date"
        value={summary.period_food_cost_pct !== null ? `${summary.period_food_cost_pct.toFixed(1)}%` : "--"}
        icon={TrendingUp}
        accent={periodColors.text}
        bar={periodColors.bar}
        delay={0.06}
      />
      <KpiCard
        label="Budget vs Actual"
        value={formatOverUnder(summary.budget_over_under)}
        icon={Target}
        accent={overUnderColors.text}
        bar={overUnderColors.bar}
        delay={0.12}
      />
      <KpiCard
        label="Prime Cost"
        value={summary.prime_cost_pct !== null ? `${summary.prime_cost_pct.toFixed(1)}%` : "--"}
        icon={Percent}
        accent={primeColors.text}
        bar={primeColors.bar}
        delay={0.18}
      />
    </div>
  );
}
