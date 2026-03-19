"use client";

import { useState } from "react";
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
  direction: "up" | "down" | "neutral";
}

interface PLRow {
  category: string;
  amount: number;
  pctRevenue: number;
  budget: number;
  variance: number;
  type: "item" | "subtotal" | "header";
  section?: string;
}

/* ------------------------------------------------------------------ */
/*  Fallback data                                                      */
/* ------------------------------------------------------------------ */

const KPIS_BY_PERIOD: Record<Period, KPI[]> = {
  today: [
    { label: "Revenue", value: "$12,450", delta: "+8.2% vs last week", direction: "up" },
    { label: "COGS", value: "$3,890", delta: "31.2% of revenue", direction: "neutral" },
    { label: "Labor", value: "$3,112", delta: "25.0% of revenue", direction: "neutral" },
    { label: "Net Profit", value: "$2,845", delta: "22.8% margin", direction: "up" },
  ],
  week: [
    { label: "Revenue", value: "$84,320", delta: "+5.1% vs last week", direction: "up" },
    { label: "COGS", value: "$26,140", delta: "31.0% of revenue", direction: "neutral" },
    { label: "Labor", value: "$21,080", delta: "25.0% of revenue", direction: "neutral" },
    { label: "Net Profit", value: "$18,620", delta: "22.1% margin", direction: "up" },
  ],
  month: [
    { label: "Revenue", value: "$348,900", delta: "+12.4% vs last month", direction: "up" },
    { label: "COGS", value: "$108,960", delta: "31.2% of revenue", direction: "neutral" },
    { label: "Labor", value: "$87,225", delta: "25.0% of revenue", direction: "neutral" },
    { label: "Net Profit", value: "$74,510", delta: "21.4% margin", direction: "up" },
  ],
};

const FALLBACK_PL: PLRow[] = [
  // Revenue
  { category: "Revenue", amount: 0, pctRevenue: 0, budget: 0, variance: 0, type: "header" },
  { category: "Food Sales", amount: 9200, pctRevenue: 73.9, budget: 8800, variance: 400, type: "item" },
  { category: "Beverage Sales", amount: 3250, pctRevenue: 26.1, budget: 3100, variance: 150, type: "item" },
  { category: "Total Revenue", amount: 12450, pctRevenue: 100.0, budget: 11900, variance: 550, type: "subtotal" },

  // COGS
  { category: "Cost of Goods Sold", amount: 0, pctRevenue: 0, budget: 0, variance: 0, type: "header" },
  { category: "Food COGS", amount: 2950, pctRevenue: 23.7, budget: 2860, variance: -90, type: "item" },
  { category: "Beverage COGS", amount: 940, pctRevenue: 7.5, budget: 900, variance: -40, type: "item" },
  { category: "Total COGS", amount: 3890, pctRevenue: 31.2, budget: 3760, variance: -130, type: "subtotal" },

  // Labor
  { category: "Labor", amount: 0, pctRevenue: 0, budget: 0, variance: 0, type: "header" },
  { category: "Kitchen Labor", amount: 1242, pctRevenue: 10.0, budget: 1300, variance: 58, type: "item" },
  { category: "FOH Labor", amount: 1370, pctRevenue: 11.0, budget: 1400, variance: 30, type: "item" },
  { category: "Management", amount: 500, pctRevenue: 4.0, budget: 500, variance: 0, type: "item" },
  { category: "Total Labor", amount: 3112, pctRevenue: 25.0, budget: 3200, variance: 88, type: "subtotal" },

  // Overhead
  { category: "Overhead", amount: 0, pctRevenue: 0, budget: 0, variance: 0, type: "header" },
  { category: "Rent", amount: 580, pctRevenue: 4.7, budget: 580, variance: 0, type: "item" },
  { category: "Utilities", amount: 210, pctRevenue: 1.7, budget: 250, variance: 40, type: "item" },
  { category: "Insurance", amount: 95, pctRevenue: 0.8, budget: 95, variance: 0, type: "item" },
  { category: "Marketing", amount: 320, pctRevenue: 2.6, budget: 350, variance: 30, type: "item" },
  { category: "Total Overhead", amount: 1205, pctRevenue: 9.7, budget: 1275, variance: 70, type: "subtotal" },

  // Net
  { category: "Net Operating Income", amount: 0, pctRevenue: 0, budget: 0, variance: 0, type: "header" },
  { category: "Net Operating Income", amount: 4243, pctRevenue: 34.1, budget: 3665, variance: 578, type: "subtotal" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function DeltaIndicator({ value, direction }: { value: string; direction: "up" | "down" | "neutral" }) {
  if (direction === "neutral") {
    return <span className="text-xs text-muted-foreground">{value}</span>;
  }
  const isUp = direction === "up";
  return (
    <span className={`text-xs font-medium inline-flex items-center gap-1 ${isUp ? "text-emerald-400" : "text-red-400"}`}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={isUp ? "" : "rotate-180"}>
        <path d="M6 2.5L10 7.5H2L6 2.5Z" fill="currentColor" />
      </svg>
      {value}
    </span>
  );
}

function VarianceCell({ value }: { value: number }) {
  if (value === 0) return <span className="tabular-nums text-muted-foreground">--</span>;
  const isPositive = value > 0;
  return (
    <span className={`tabular-nums font-medium ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
      {isPositive ? "+" : ""}{formatCurrency(value)}
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
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
  ];

  return (
    <div className="flex flex-col h-dvh">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-lg font-bold text-foreground">Reporting</h1>
          <p className="text-sm text-muted-foreground">Daily P&amp;L and financial overview</p>
        </div>
        {/* Period toggle */}
        <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === p.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* KPI Hero Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="bg-card border border-border rounded-xl p-5 flex flex-col gap-1"
            >
              <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
              <p className="text-2xl font-bold text-foreground tabular-nums mt-1">{kpi.value}</p>
              <div className="mt-2">
                <DeltaIndicator value={kpi.delta} direction={kpi.direction} />
              </div>
            </div>
          ))}
        </div>

        {/* Fallback notice */}
        {showFallback && !loading && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Showing sample data — API endpoint not connected yet
          </div>
        )}

        {/* P&L Breakdown Table */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[280px]">Category</TableHead>
                  <TableHead className="text-right">Amount ($)</TableHead>
                  <TableHead className="text-right">% of Revenue</TableHead>
                  <TableHead className="text-right">vs Budget</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plRows.map((row, i) => {
                  if (row.type === "header") {
                    return (
                      <TableRow key={i} className="hover:bg-transparent border-t-2 border-border">
                        <TableCell
                          colSpan={5}
                          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-5 pb-2"
                        >
                          {row.category}
                        </TableCell>
                      </TableRow>
                    );
                  }

                  const isSubtotal = row.type === "subtotal";

                  return (
                    <TableRow
                      key={i}
                      className={isSubtotal ? "bg-secondary/50 font-semibold border-t border-border" : ""}
                    >
                      <TableCell className={isSubtotal ? "font-semibold text-foreground" : "text-foreground"}>
                        {isSubtotal ? row.category : row.category}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${isSubtotal ? "font-semibold text-foreground" : "text-foreground"}`}>
                        {formatCurrency(row.amount)}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${isSubtotal ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                        {row.pctRevenue.toFixed(1)}%
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${isSubtotal ? "font-semibold" : ""} text-muted-foreground`}>
                        {formatCurrency(row.budget)}
                      </TableCell>
                      <TableCell className="text-right">
                        <VarianceCell value={row.variance} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
