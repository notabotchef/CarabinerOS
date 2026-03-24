"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { MenuButton } from "@/components/menu-button";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HeroChartSection,
  type DailyPLRow,
} from "@/components/reporting/revenue-charts";

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
}

/* ------------------------------------------------------------------ */
/*  Fallback P&L (used when API has no data)                           */
/* ------------------------------------------------------------------ */

const FALLBACK_PL: PLRow[] = [
  { category: "Revenue",            amount: 0,     pctRevenue: 0,     budget: 0,     variance: 0,    type: "header" },
  { category: "Food Sales",         amount: 9200,  pctRevenue: 73.9,  budget: 8800,  variance: 400,  type: "item" },
  { category: "Beverage Sales",     amount: 2450,  pctRevenue: 19.7,  budget: 2300,  variance: 150,  type: "item" },
  { category: "Catering",           amount: 800,   pctRevenue: 6.4,   budget: 800,   variance: 0,    type: "item" },
  { category: "Total Revenue",      amount: 12450, pctRevenue: 100.0, budget: 11900, variance: 550,  type: "subtotal" },
  { category: "Cost of Goods Sold", amount: 0,     pctRevenue: 0,     budget: 0,     variance: 0,    type: "header" },
  { category: "Food COGS",          amount: 2950,  pctRevenue: 23.7,  budget: 2860,  variance: -90,  type: "item" },
  { category: "Beverage COGS",      amount: 640,   pctRevenue: 5.1,   budget: 600,   variance: -40,  type: "item" },
  { category: "Paper & Supplies",   amount: 300,   pctRevenue: 2.4,   budget: 300,   variance: 0,    type: "item" },
  { category: "Total COGS",         amount: 3890,  pctRevenue: 31.2,  budget: 3760,  variance: -130, type: "subtotal" },
  { category: "Gross Profit",       amount: 8560,  pctRevenue: 68.8,  budget: 8140,  variance: 420,  type: "subtotal" },
  { category: "Labor",              amount: 0,     pctRevenue: 0,     budget: 0,     variance: 0,    type: "header" },
  { category: "Kitchen Labor",      amount: 1242,  pctRevenue: 10.0,  budget: 1300,  variance: 58,   type: "item" },
  { category: "FOH Labor",          amount: 1370,  pctRevenue: 11.0,  budget: 1400,  variance: 30,   type: "item" },
  { category: "Management",         amount: 500,   pctRevenue: 4.0,   budget: 500,   variance: 0,    type: "item" },
  { category: "Total Labor",        amount: 3112,  pctRevenue: 25.0,  budget: 3200,  variance: 88,   type: "subtotal" },
  { category: "Prime Cost",         amount: 7002,  pctRevenue: 56.2,  budget: 6960,  variance: -42,  type: "subtotal" },
  { category: "Operating Expenses", amount: 0,     pctRevenue: 0,     budget: 0,     variance: 0,    type: "header" },
  { category: "Rent",               amount: 580,   pctRevenue: 4.7,   budget: 580,   variance: 0,    type: "item" },
  { category: "Utilities",          amount: 210,   pctRevenue: 1.7,   budget: 250,   variance: 40,   type: "item" },
  { category: "Insurance",          amount: 95,    pctRevenue: 0.8,   budget: 95,    variance: 0,    type: "item" },
  { category: "Marketing",          amount: 320,   pctRevenue: 2.6,   budget: 350,   variance: 30,   type: "item" },
  { category: "Repairs & Maint.",   amount: 148,   pctRevenue: 1.2,   budget: 175,   variance: 27,   type: "item" },
  { category: "Technology",         amount: 85,    pctRevenue: 0.7,   budget: 85,    variance: 0,    type: "item" },
  { category: "Total OpEx",         amount: 1438,  pctRevenue: 11.6,  budget: 1535,  variance: 97,   type: "subtotal" },
  { category: "Net Operating Income", amount: 4010, pctRevenue: 32.2, budget: 3405,  variance: 605,  type: "grand-total" },
];

/* ------------------------------------------------------------------ */
/*  Accent configuration                                               */
/* ------------------------------------------------------------------ */

const ACCENT_CFG: Record<KPI["accent"], { bar: string; text: string }> = {
  revenue: { bar: "bg-gradient-to-r from-blue-500 to-blue-500/0",    text: "text-blue-400" },
  cogs:    { bar: "bg-gradient-to-r from-amber-500 to-amber-500/0",  text: "text-amber-400" },
  labor:   { bar: "bg-gradient-to-r from-orange-500 to-orange-500/0",text: "text-orange-400" },
  profit:  { bar: "bg-gradient-to-r from-emerald-500 to-emerald-500/0", text: "text-emerald-400" },
};

/* ------------------------------------------------------------------ */
/*  Date helpers                                                        */
/* ------------------------------------------------------------------ */

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getPeriodRange(period: Period, latestDate?: string): { start: string; end: string } {
  const today = new Date();
  const todayStr = toDateStr(today);

  if (period === "today") {
    // Use latest available date if today has no data (e.g. seed ends yesterday)
    const effectiveDate = latestDate && latestDate < todayStr ? latestDate : todayStr;
    return { start: effectiveDate, end: effectiveDate };
  }

  if (period === "week") {
    const dow = (today.getDay() + 6) % 7; // Mon=0
    const mon = new Date(today);
    mon.setDate(today.getDate() - dow);
    return { start: toDateStr(mon), end: todayStr };
  }

  // month
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  return { start: toDateStr(first), end: todayStr };
}

function getPreviousPeriodRange(period: Period): { start: string; end: string } {
  const today = new Date();

  if (period === "today") {
    const y = new Date(today);
    y.setDate(today.getDate() - 1);
    const s = toDateStr(y);
    return { start: s, end: s };
  }

  if (period === "week") {
    const dow = (today.getDay() + 6) % 7;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - dow);
    const prevSun = new Date(thisMonday);
    prevSun.setDate(thisMonday.getDate() - 1);
    const prevMon = new Date(prevSun);
    prevMon.setDate(prevSun.getDate() - 6);
    return { start: toDateStr(prevMon), end: toDateStr(prevSun) };
  }

  // month
  const firstThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastPrevMonth = new Date(firstThisMonth);
  lastPrevMonth.setDate(0);
  const firstPrevMonth = new Date(lastPrevMonth.getFullYear(), lastPrevMonth.getMonth(), 1);
  return { start: toDateStr(firstPrevMonth), end: toDateStr(lastPrevMonth) };
}

function filterRows(rows: DailyPLRow[], start: string, end: string): DailyPLRow[] {
  return rows.filter((r) => r.pl_date >= start && r.pl_date <= end);
}

/* ------------------------------------------------------------------ */
/*  Aggregate rows to KPI values                                       */
/* ------------------------------------------------------------------ */

interface PeriodAgg {
  revenue: number;
  cogs: number;
  labor: number;
  netProfit: number;
  avgFoodCostPct: number;
  avgLaborPct: number;
}

function aggregateRows(rows: DailyPLRow[]): PeriodAgg {
  if (rows.length === 0) {
    return { revenue: 0, cogs: 0, labor: 0, netProfit: 0, avgFoodCostPct: 0, avgLaborPct: 0 };
  }
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const cogs    = rows.reduce((s, r) => s + r.cogs, 0);
  const labor   = rows.reduce((s, r) => s + r.labor_cost, 0);
  const netProfit = revenue - cogs - labor;
  const avgFoodCostPct = revenue > 0 ? (cogs / revenue) * 100 : 0;
  const avgLaborPct    = revenue > 0 ? (labor / revenue) * 100 : 0;
  return { revenue, cogs, labor, netProfit, avgFoodCostPct, avgLaborPct };
}

function deltaStr(current: number, previous: number): { delta: string; direction: "up" | "down" | "neutral" } {
  if (previous === 0) return { delta: "—", direction: "neutral" };
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const sign = pct >= 0 ? "+" : "";
  return {
    delta: `${sign}${pct.toFixed(1)}%`,
    direction: pct > 0 ? "up" : pct < 0 ? "down" : "neutral",
  };
}

function buildKPIs(current: PeriodAgg, prev: PeriodAgg): KPI[] {
  const revDelta  = deltaStr(current.revenue, prev.revenue);
  const profDelta = deltaStr(current.netProfit, prev.netProfit);

  return [
    {
      label: "Revenue",
      value: fmt(current.revenue),
      delta: revDelta.delta,
      pctOfRevenue: "total sales",
      direction: revDelta.direction,
      accent: "revenue",
    },
    {
      label: "COGS",
      value: fmt(current.cogs),
      delta: `${current.avgFoodCostPct.toFixed(1)}%`,
      pctOfRevenue: "of revenue",
      direction: "neutral",
      accent: "cogs",
    },
    {
      label: "Labor",
      value: fmt(current.labor),
      delta: `${current.avgLaborPct.toFixed(1)}%`,
      pctOfRevenue: "of revenue",
      direction: "neutral",
      accent: "labor",
    },
    {
      label: "Net Profit",
      value: fmt(current.netProfit),
      delta: profDelta.delta,
      pctOfRevenue: current.revenue > 0 ? `${((current.netProfit / current.revenue) * 100).toFixed(1)}% margin` : "margin",
      direction: profDelta.direction,
      accent: "profit",
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  Build P&L table from aggregate                                     */
/* ------------------------------------------------------------------ */

// Fixed overhead estimates — scale with period days
const OVERHEAD_DAILY = {
  rent: 580 / 30,
  utilities: 210 / 30,
  insurance: 95 / 30,
  marketing: 320 / 30,
  repairs: 148 / 30,
  technology: 85 / 30,
};

function buildPLRows(rows: DailyPLRow[]): PLRow[] {
  const agg = aggregateRows(rows);
  const days = rows.length || 1;
  const rev = agg.revenue;
  const pct = (n: number) => (rev > 0 ? (n / rev) * 100 : 0);

  // Estimate food vs beverage split (food ~75%, bev ~20%, catering ~5%)
  const foodSales = rev * 0.75;
  const bevSales  = rev * 0.20;
  const catSales  = rev * 0.05;

  // COGS split
  const foodCogs = agg.cogs * 0.76;
  const bevCogs  = agg.cogs * 0.16;
  const paperCogs= agg.cogs * 0.08;

  // Labor split
  const kitchenLabor = agg.labor * 0.40;
  const fohLabor     = agg.labor * 0.44;
  const mgmtLabor    = agg.labor * 0.16;

  // Overhead (scale to days in period)
  const o = {
    rent:       OVERHEAD_DAILY.rent * days,
    utilities:  OVERHEAD_DAILY.utilities * days,
    insurance:  OVERHEAD_DAILY.insurance * days,
    marketing:  OVERHEAD_DAILY.marketing * days,
    repairs:    OVERHEAD_DAILY.repairs * days,
    technology: OVERHEAD_DAILY.technology * days,
  };
  const totalOpEx = Object.values(o).reduce((s, v) => s + v, 0);

  const grossProfit = rev - agg.cogs;
  const primeCost   = agg.cogs + agg.labor;
  const netOI       = grossProfit - agg.labor - totalOpEx;

  // Budgets — rough targets
  const budgetRev    = 12000 * days;
  const budgetCogs   = budgetRev * 0.30;
  const budgetLabor  = budgetRev * 0.25;
  const budgetOpEx   = totalOpEx; // fixed, no variance
  const budgetGross  = budgetRev - budgetCogs;
  const budgetPrime  = budgetCogs + budgetLabor;
  const budgetNet    = budgetGross - budgetLabor - budgetOpEx;

  return [
    // Revenue section
    { category: "Revenue",            amount: 0,         pctRevenue: 0,           budget: 0,         variance: 0,                      type: "header" },
    { category: "Food Sales",         amount: foodSales, pctRevenue: pct(foodSales), budget: budgetRev * 0.75, variance: foodSales - budgetRev * 0.75, type: "item" },
    { category: "Beverage Sales",     amount: bevSales,  pctRevenue: pct(bevSales),  budget: budgetRev * 0.20, variance: bevSales - budgetRev * 0.20,  type: "item" },
    { category: "Catering",           amount: catSales,  pctRevenue: pct(catSales),  budget: budgetRev * 0.05, variance: catSales - budgetRev * 0.05,  type: "item" },
    { category: "Total Revenue",      amount: rev,       pctRevenue: 100,            budget: budgetRev,        variance: rev - budgetRev,              type: "subtotal" },

    // COGS section
    { category: "Cost of Goods Sold", amount: 0,         pctRevenue: 0,             budget: 0,          variance: 0,                      type: "header" },
    { category: "Food COGS",          amount: foodCogs,  pctRevenue: pct(foodCogs),  budget: budgetCogs * 0.76, variance: -(foodCogs - budgetCogs * 0.76), type: "item" },
    { category: "Beverage COGS",      amount: bevCogs,   pctRevenue: pct(bevCogs),   budget: budgetCogs * 0.16, variance: -(bevCogs - budgetCogs * 0.16),  type: "item" },
    { category: "Paper & Supplies",   amount: paperCogs, pctRevenue: pct(paperCogs), budget: budgetCogs * 0.08, variance: -(paperCogs - budgetCogs * 0.08), type: "item" },
    { category: "Total COGS",         amount: agg.cogs,  pctRevenue: pct(agg.cogs),  budget: budgetCogs,        variance: -(agg.cogs - budgetCogs),         type: "subtotal" },

    // Gross profit
    { category: "Gross Profit",       amount: grossProfit, pctRevenue: pct(grossProfit), budget: budgetGross, variance: grossProfit - budgetGross, type: "subtotal" },

    // Labor section
    { category: "Labor",              amount: 0,            pctRevenue: 0,                budget: 0,            variance: 0,                          type: "header" },
    { category: "Kitchen Labor",      amount: kitchenLabor, pctRevenue: pct(kitchenLabor), budget: budgetLabor * 0.40, variance: -(kitchenLabor - budgetLabor * 0.40), type: "item" },
    { category: "FOH Labor",          amount: fohLabor,     pctRevenue: pct(fohLabor),     budget: budgetLabor * 0.44, variance: -(fohLabor - budgetLabor * 0.44),     type: "item" },
    { category: "Management",         amount: mgmtLabor,    pctRevenue: pct(mgmtLabor),    budget: budgetLabor * 0.16, variance: -(mgmtLabor - budgetLabor * 0.16),    type: "item" },
    { category: "Total Labor",        amount: agg.labor,    pctRevenue: pct(agg.labor),    budget: budgetLabor,        variance: -(agg.labor - budgetLabor),            type: "subtotal" },

    // Prime cost
    { category: "Prime Cost",         amount: primeCost,   pctRevenue: pct(primeCost),    budget: budgetPrime,        variance: -(primeCost - budgetPrime),            type: "subtotal" },

    // OpEx section
    { category: "Operating Expenses", amount: 0,           pctRevenue: 0,                budget: 0,            variance: 0,                          type: "header" },
    { category: "Rent",               amount: o.rent,      pctRevenue: pct(o.rent),      budget: o.rent,       variance: 0,                          type: "item" },
    { category: "Utilities",          amount: o.utilities, pctRevenue: pct(o.utilities), budget: o.utilities,  variance: 0,                          type: "item" },
    { category: "Insurance",          amount: o.insurance, pctRevenue: pct(o.insurance), budget: o.insurance,  variance: 0,                          type: "item" },
    { category: "Marketing",          amount: o.marketing, pctRevenue: pct(o.marketing), budget: o.marketing,  variance: 0,                          type: "item" },
    { category: "Repairs & Maint.",   amount: o.repairs,   pctRevenue: pct(o.repairs),   budget: o.repairs,    variance: 0,                          type: "item" },
    { category: "Technology",         amount: o.technology,pctRevenue: pct(o.technology),budget: o.technology, variance: 0,                          type: "item" },
    { category: "Total OpEx",         amount: totalOpEx,   pctRevenue: pct(totalOpEx),   budget: budgetOpEx,   variance: 0,                          type: "subtotal" },

    // Net
    { category: "Net Operating Income", amount: netOI, pctRevenue: pct(netOI), budget: budgetNet, variance: netOI - budgetNet, type: "grand-total" },
  ];
}

/* ------------------------------------------------------------------ */
/*  Format helper                                                      */
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
  const isNeutral  = kpi.direction === "neutral";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative overflow-hidden rounded-xl border border-border/60 bg-card"
    >
      <div className={`absolute inset-x-0 top-0 h-[2px] ${cfg.bar}`} />
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {kpi.label}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold tabular-nums tracking-tight text-foreground">
            {kpi.value}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-2.5">
          {!isNeutral && kpi.delta !== "—" && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                isPositive
                  ? "bg-emerald-500/12 text-emerald-400"
                  : "bg-red-500/12 text-red-400"
              }`}
            >
              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {kpi.delta}
            </span>
          )}
          {(isNeutral || kpi.delta === "—") && (
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
  if (value == null || Math.round(value) === 0) {
    return <span className="tabular-nums text-muted-foreground/40">&mdash;</span>;
  }
  const isPositive = value > 0;
  return (
    <span className={`tabular-nums font-medium ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
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
  const { data: rawRows, loading, error } = useWorkspace<DailyPLRow>("/api/reporting/daily-pl");

  const hasLiveData = rawRows.length > 0;

  // Slice rows by period and previous period for delta computation
  const { currentRows, prevRows, chartRows } = useMemo(() => {
    if (!hasLiveData) {
      return { currentRows: [], prevRows: [], chartRows: [] };
    }
    // Find the latest date in dataset for "today" fallback
    const latestDate = rawRows.length > 0
      ? rawRows.reduce((max, r) => r.pl_date > max ? r.pl_date : max, rawRows[0].pl_date)
      : undefined;
    const cur = getPeriodRange(period, latestDate);
    const prev = getPreviousPeriodRange(period);
    return {
      currentRows: filterRows(rawRows, cur.start, cur.end),
      prevRows:    filterRows(rawRows, prev.start, prev.end),
      chartRows:   rawRows, // charts always use full dataset
    };
  }, [rawRows, period, hasLiveData]);

  const kpis: KPI[] = useMemo(() => {
    if (!hasLiveData) {
      // Fallback static KPIs
      const fallbacks: Record<Period, KPI[]> = {
        today: [
          { label: "Revenue",    value: "$12,450", delta: "+8.2%",  pctOfRevenue: "vs last Tue",  direction: "up",     accent: "revenue" },
          { label: "COGS",       value: "$3,890",  delta: "31.2%",  pctOfRevenue: "of revenue",   direction: "neutral",accent: "cogs" },
          { label: "Labor",      value: "$3,112",  delta: "25.0%",  pctOfRevenue: "of revenue",   direction: "neutral",accent: "labor" },
          { label: "Net Profit", value: "$2,845",  delta: "+22.8%", pctOfRevenue: "margin",       direction: "up",     accent: "profit" },
        ],
        week: [
          { label: "Revenue",    value: "$84,320", delta: "+5.1%",  pctOfRevenue: "vs last week", direction: "up",     accent: "revenue" },
          { label: "COGS",       value: "$26,140", delta: "31.0%",  pctOfRevenue: "of revenue",   direction: "neutral",accent: "cogs" },
          { label: "Labor",      value: "$21,080", delta: "25.0%",  pctOfRevenue: "of revenue",   direction: "neutral",accent: "labor" },
          { label: "Net Profit", value: "$18,620", delta: "+22.1%", pctOfRevenue: "margin",       direction: "up",     accent: "profit" },
        ],
        month: [
          { label: "Revenue",    value: "$348,900",delta: "+12.4%", pctOfRevenue: "vs last month",direction: "up",     accent: "revenue" },
          { label: "COGS",       value: "$108,960",delta: "31.2%",  pctOfRevenue: "of revenue",   direction: "neutral",accent: "cogs" },
          { label: "Labor",      value: "$87,225", delta: "25.0%",  pctOfRevenue: "of revenue",   direction: "neutral",accent: "labor" },
          { label: "Net Profit", value: "$74,510", delta: "+21.4%", pctOfRevenue: "margin",       direction: "up",     accent: "profit" },
        ],
      };
      return fallbacks[period];
    }

    const curAgg  = aggregateRows(currentRows);
    const prevAgg = aggregateRows(prevRows);
    return buildKPIs(curAgg, prevAgg);
  }, [hasLiveData, currentRows, prevRows, period]);

  const plRows: PLRow[] = useMemo(() => {
    if (!hasLiveData || currentRows.length === 0) return FALLBACK_PL;
    return buildPLRows(currentRows);
  }, [hasLiveData, currentRows, period]);

  const showFallback = error || !hasLiveData;

  const periods: { key: Period; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week",  label: "This Week" },
    { key: "month", label: "This Month" },
  ];

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* ---- Header ---- */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/60 shrink-0 bg-card">
        <MenuButton />
        <div className="flex-1 flex items-center justify-between">
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

          {/* Hero Chart — single full-width chart with tab switcher */}
          {!loading && hasLiveData && chartRows.length > 0 && (
            <HeroChartSection rows={chartRows} />
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
                    if (row.type === "header") {
                      return (
                        <TableRow key={i} className="hover:bg-transparent border-t border-border/40">
                          <TableCell
                            colSpan={5}
                            className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70 pt-5 pb-1.5 pl-4"
                          >
                            {row.category}
                          </TableCell>
                        </TableRow>
                      );
                    }

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
