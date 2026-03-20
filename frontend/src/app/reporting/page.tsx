"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Period = "today" | "week" | "month";

interface KPI {
  label: string;
  value: string;
  delta: string;
  pctOfRevenue?: string;
  direction: "up" | "down" | "neutral";
  accent: "revenue" | "cogs" | "labor" | "profit";
}

interface PLRow {
  category: string;
  amount: number;
  pctRevenue: number;
  budget: number;
  variance: number;
  type: "item" | "subtotal" | "header" | "grand-total";
  section?: string;
}

/* ------------------------------------------------------------------ */
/*  Fallback data — realistic single-unit restaurant                   */
/* ------------------------------------------------------------------ */

const KPIS_BY_PERIOD: Record<Period, KPI[]> = {
  today: [
    { label: "Revenue",    value: "$12,450", delta: "+8.2%", pctOfRevenue: "vs last Tue", direction: "up",      accent: "revenue" },
    { label: "COGS",       value: "$3,890",  delta: "31.2%", pctOfRevenue: "of revenue",  direction: "neutral", accent: "cogs" },
    { label: "Labor",      value: "$3,112",  delta: "25.0%", pctOfRevenue: "of revenue",  direction: "neutral", accent: "labor" },
    { label: "Net Profit", value: "$2,845",  delta: "+22.8%",pctOfRevenue: "margin",      direction: "up",      accent: "profit" },
  ],
  week: [
    { label: "Revenue",    value: "$84,320", delta: "+5.1%", pctOfRevenue: "vs last week", direction: "up",      accent: "revenue" },
    { label: "COGS",       value: "$26,140", delta: "31.0%", pctOfRevenue: "of revenue",   direction: "neutral", accent: "cogs" },
    { label: "Labor",      value: "$21,080", delta: "25.0%", pctOfRevenue: "of revenue",   direction: "neutral", accent: "labor" },
    { label: "Net Profit", value: "$18,620", delta: "+22.1%",pctOfRevenue: "margin",       direction: "up",      accent: "profit" },
  ],
  month: [
    { label: "Revenue",    value: "$348,900", delta: "+12.4%", pctOfRevenue: "vs last month", direction: "up",      accent: "revenue" },
    { label: "COGS",       value: "$108,960", delta: "31.2%",  pctOfRevenue: "of revenue",    direction: "neutral", accent: "cogs" },
    { label: "Labor",      value: "$87,225",  delta: "25.0%",  pctOfRevenue: "of revenue",    direction: "neutral", accent: "labor" },
    { label: "Net Profit", value: "$74,510",  delta: "+21.4%", pctOfRevenue: "margin",        direction: "up",      accent: "profit" },
  ],
};

const FALLBACK_PL: PLRow[] = [
  // Revenue
  { category: "Revenue",           amount: 0,     pctRevenue: 0,     budget: 0,     variance: 0,    type: "header" },
  { category: "Food Sales",        amount: 9200,  pctRevenue: 73.9,  budget: 8800,  variance: 400,  type: "item" },
  { category: "Beverage Sales",    amount: 2450,  pctRevenue: 19.7,  budget: 2300,  variance: 150,  type: "item" },
  { category: "Catering",          amount: 800,   pctRevenue: 6.4,   budget: 800,   variance: 0,    type: "item" },
  { category: "Total Revenue",     amount: 12450, pctRevenue: 100.0, budget: 11900, variance: 550,  type: "subtotal" },

  // COGS
  { category: "Cost of Goods Sold",amount: 0,     pctRevenue: 0,     budget: 0,     variance: 0,    type: "header" },
  { category: "Food COGS",         amount: 2950,  pctRevenue: 23.7,  budget: 2860,  variance: -90,  type: "item" },
  { category: "Beverage COGS",     amount: 640,   pctRevenue: 5.1,   budget: 600,   variance: -40,  type: "item" },
  { category: "Paper & Supplies",  amount: 300,   pctRevenue: 2.4,   budget: 300,   variance: 0,    type: "item" },
  { category: "Total COGS",        amount: 3890,  pctRevenue: 31.2,  budget: 3760,  variance: -130, type: "subtotal" },

  // Gross Profit
  { category: "Gross Profit",      amount: 8560,  pctRevenue: 68.8,  budget: 8140,  variance: 420,  type: "subtotal" },

  // Labor
  { category: "Labor",             amount: 0,     pctRevenue: 0,     budget: 0,     variance: 0,    type: "header" },
  { category: "Kitchen Labor",     amount: 1242,  pctRevenue: 10.0,  budget: 1300,  variance: 58,   type: "item" },
  { category: "FOH Labor",         amount: 1370,  pctRevenue: 11.0,  budget: 1400,  variance: 30,   type: "item" },
  { category: "Management",        amount: 500,   pctRevenue: 4.0,   budget: 500,   variance: 0,    type: "item" },
  { category: "Total Labor",       amount: 3112,  pctRevenue: 25.0,  budget: 3200,  variance: 88,   type: "subtotal" },

  // Prime Cost
  { category: "Prime Cost",        amount: 7002,  pctRevenue: 56.2,  budget: 6960,  variance: -42,  type: "subtotal" },

  // Overhead
  { category: "Operating Expenses",amount: 0,     pctRevenue: 0,     budget: 0,     variance: 0,    type: "header" },
  { category: "Rent",              amount: 580,   pctRevenue: 4.7,   budget: 580,   variance: 0,    type: "item" },
  { category: "Utilities",         amount: 210,   pctRevenue: 1.7,   budget: 250,   variance: 40,   type: "item" },
  { category: "Insurance",         amount: 95,    pctRevenue: 0.8,   budget: 95,    variance: 0,    type: "item" },
  { category: "Marketing",         amount: 320,   pctRevenue: 2.6,   budget: 350,   variance: 30,   type: "item" },
  { category: "Repairs & Maint.",  amount: 148,   pctRevenue: 1.2,   budget: 175,   variance: 27,   type: "item" },
  { category: "Technology",        amount: 85,    pctRevenue: 0.7,   budget: 85,    variance: 0,    type: "item" },
  { category: "Total OpEx",        amount: 1438,  pctRevenue: 11.6,  budget: 1535,  variance: 97,   type: "subtotal" },

  // Net
  { category: "Net Operating Income", amount: 4010, pctRevenue: 32.2, budget: 3405, variance: 605, type: "grand-total" },
];

/* ------------------------------------------------------------------ */
/*  Accent configuration                                               */
/* ------------------------------------------------------------------ */

const ACCENT_CFG: Record<KPI["accent"], { bar: string; text: string; bg: string }> = {
  revenue: {
    bar:  "bg-gradient-to-r from-blue-500 to-blue-500/0",
    text: "text-blue-400",
    bg:   "bg-blue-500/8",
  },
  cogs: {
    bar:  "bg-gradient-to-r from-amber-500 to-amber-500/0",
    text: "text-amber-400",
    bg:   "bg-amber-500/8",
  },
  labor: {
    bar:  "bg-gradient-to-r from-orange-500 to-orange-500/0",
    text: "text-orange-400",
    bg:   "bg-orange-500/8",
  },
  profit: {
    bar:  "bg-gradient-to-r from-emerald-500 to-emerald-500/0",
    text: "text-emerald-400",
    bg:   "bg-emerald-500/8",
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmt(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return "$0";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function KpiCard({ kpi, index }: { kpi: KPI; index: number }) {
  const cfg = ACCENT_CFG[kpi.accent];
  const isPositive = kpi.direction === "up";
  const isNeutral = kpi.direction === "neutral";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className="relative overflow-hidden rounded-xl border border-border/60 bg-card"
    >
      {/* Top accent bar */}
      <div className={`absolute inset-x-0 top-0 h-[2px] ${cfg.bar}`} />

      <div className="p-5">
        {/* Label */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {kpi.label}
          </span>
        </div>

        {/* Hero number */}
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold tabular-nums tracking-tight text-foreground">
            {kpi.value}
          </span>
        </div>

        {/* Delta line */}
        <div className="flex items-center gap-2 mt-2.5">
          {!isNeutral && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                isPositive
                  ? "bg-emerald-500/12 text-emerald-400"
                  : "bg-red-500/12 text-red-400"
              }`}
            >
              {isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {kpi.delta}
            </span>
          )}
          {isNeutral && (
            <span className="text-[11px] font-bold tabular-nums text-muted-foreground">
              {kpi.delta}
            </span>
          )}
          <span className="text-[11px] text-muted-foreground/60">
            {kpi.pctOfRevenue}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function KpiSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-5">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-muted/40" />
      <Skeleton className="h-3 w-16 mb-3" />
      <Skeleton className="h-9 w-28 mb-2.5" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

function VarianceCell({ value }: { value: number | undefined | null }) {
  if (value == null || value === 0) {
    return <span className="tabular-nums text-muted-foreground/40">&mdash;</span>;
  }
  const isPositive = value > 0;
  return (
    <span
      className={`tabular-nums font-medium ${
        isPositive ? "text-emerald-400" : "text-red-400"
      }`}
    >
      {isPositive ? "+" : ""}
      {fmt(value)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ReportingPage() {
  const [period, setPeriod] = useState<Period>("today");
  const { data, loading, error } = useWorkspace<PLRow>("/api/reporting/daily-pl");

  const plRows = data.length > 0 ? data : FALLBACK_PL;
  const kpis = KPIS_BY_PERIOD[period];
  const showFallback = error || data.length === 0;

  const periods: { key: Period; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week",  label: "This Week" },
    { key: "month", label: "This Month" },
  ];

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* ---- Header ---- */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-8 rounded-lg bg-blue-500/10">
            <BarChart3 className="size-4 text-blue-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground tracking-tight">
              Reporting
            </h1>
            <p className="text-xs text-muted-foreground">
              Daily P&amp;L &middot; Financial Overview
            </p>
          </div>
        </div>

        {/* Period toggle */}
        <div className="flex items-center gap-0.5 rounded-lg bg-secondary/60 p-1">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`relative px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                period === p.key
                  ? "bg-card text-foreground shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* ---- Content ---- */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* KPI Hero Cards */}
          <AnimatePresence mode="wait">
            <motion.div
              key={period}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiSkeleton />
                  <KpiSkeleton />
                  <KpiSkeleton />
                  <KpiSkeleton />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {kpis.map((kpi, i) => (
                    <KpiCard key={kpi.label} kpi={kpi} index={i} />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Fallback notice */}
          {showFallback && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="rounded-lg border border-border/40 bg-card/50 px-4 py-2.5 text-[11px] text-muted-foreground/60 tracking-wide"
            >
              Sample data &mdash; connect API endpoint for live figures
            </motion.div>
          )}

          {/* P&L Breakdown Table */}
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="rounded-xl border border-border/60 bg-card overflow-hidden"
            >
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20 hover:bg-muted/20 border-b border-border/60">
                    <TableHead className="w-[280px] text-[11px] font-semibold uppercase tracking-wider">
                      Category
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                      Amount
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                      % Rev
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                      Budget
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                      Variance
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plRows.map((row, i) => {
                    /* Section header */
                    if (row.type === "header") {
                      return (
                        <TableRow
                          key={i}
                          className="hover:bg-transparent border-t border-border/40"
                        >
                          <TableCell
                            colSpan={5}
                            className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70 pt-5 pb-1.5 pl-4"
                          >
                            {row.category}
                          </TableCell>
                        </TableRow>
                      );
                    }

                    /* Grand total — the money row */
                    if (row.type === "grand-total") {
                      const isPositiveNet = row.amount >= 0;
                      return (
                        <TableRow
                          key={i}
                          className="border-t-2 border-foreground/20 bg-secondary/40 hover:bg-secondary/50"
                        >
                          <TableCell className="font-bold text-foreground text-sm pl-4">
                            {row.category}
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums text-sm font-bold ${
                              isPositiveNet ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {fmt(row.amount)}
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums text-sm font-bold ${
                              isPositiveNet ? "text-emerald-400/80" : "text-red-400/80"
                            }`}
                          >
                            {(row.pctRevenue ?? 0).toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm font-bold text-muted-foreground">
                            {fmt(row.budget)}
                          </TableCell>
                          <TableCell className="text-right">
                            <VarianceCell value={row.variance} />
                          </TableCell>
                        </TableRow>
                      );
                    }

                    /* Subtotal row */
                    const isSubtotal = row.type === "subtotal";

                    return (
                      <TableRow
                        key={i}
                        className={
                          isSubtotal
                            ? "bg-secondary/30 border-t border-border/40 hover:bg-secondary/40"
                            : "hover:bg-muted/8 border-b border-border/20"
                        }
                      >
                        <TableCell
                          className={`pl-4 ${
                            isSubtotal
                              ? "font-semibold text-foreground text-[13px]"
                              : "text-foreground/80 pl-8"
                          }`}
                        >
                          {row.category}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums ${
                            isSubtotal
                              ? "font-semibold text-foreground text-[13px]"
                              : "text-foreground/80"
                          }`}
                        >
                          {fmt(row.amount)}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums ${
                            isSubtotal
                              ? "font-semibold text-muted-foreground"
                              : "text-muted-foreground/60"
                          }`}
                        >
                          {(row.pctRevenue ?? 0).toFixed(1)}%
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums ${
                            isSubtotal
                              ? "font-semibold text-muted-foreground/80"
                              : "text-muted-foreground/50"
                          }`}
                        >
                          {fmt(row.budget)}
                        </TableCell>
                        <TableCell className="text-right">
                          <VarianceCell value={row.variance} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
