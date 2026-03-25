"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type PressureLevel = "High" | "Medium" | "Low";

export type FoodCostItem = {
  [key: string]: unknown;
  id: string;
  location_id: string;
  menu_item_name: string;
  pressure: PressureLevel;
  current_cost_pct: string;
  action: string;
  summary: string | null;
  detail_points: string[] | null;
  created_at: string;
  updated_at: string;
};

type FilterTab = "All" | PressureLevel;

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FILTER_TABS: FilterTab[] = ["All", "High", "Medium", "Low"];

const PRESSURE_CFG: Record<PressureLevel, {
  dot: string; badge: string; label: string;
}> = {
  High: {
    dot: "bg-red-500",
    badge: "bg-red-500/10 text-red-400 border-red-500/20 ring-1 ring-red-500/10",
    label: "High",
  },
  Medium: {
    dot: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/20 ring-1 ring-amber-500/10",
    label: "Medium",
  },
  Low: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 ring-1 ring-emerald-500/10",
    label: "Low",
  },
};

const TAB_COLORS: Record<FilterTab, { on: string; off: string }> = {
  All: { on: "bg-white/10 text-foreground border-white/10", off: "text-muted-foreground hover:text-foreground hover:bg-white/5" },
  High: { on: "bg-red-500/10 text-red-400 border-red-500/20", off: "text-muted-foreground hover:text-red-400 hover:bg-red-500/5" },
  Medium: { on: "bg-amber-500/10 text-amber-400 border-amber-500/20", off: "text-muted-foreground hover:text-amber-400 hover:bg-amber-500/5" },
  Low: { on: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", off: "text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/5" },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseCost(raw: string): number {
  const n = parseFloat(raw.replace("%", ""));
  return isNaN(n) ? 0 : n;
}

function normalizePressure(raw: string): PressureLevel {
  const l = raw.toLowerCase();
  if (l === "high" || l.includes("+3") || l.includes("+4") || l.includes("+5")) return "High";
  if (l === "low" || l.includes("-") || l.includes("0.")) return "Low";
  return "Medium";
}

function CostTrend({ value }: { value: number }) {
  if (value > 32) return <ArrowUpRight className="inline h-3.5 w-3.5 text-red-400" />;
  if (value < 28) return <ArrowDownRight className="inline h-3.5 w-3.5 text-emerald-400" />;
  return <Minus className="inline h-3.5 w-3.5 text-muted-foreground/40" />;
}

function PressureBadge({ pressure }: { pressure: string }) {
  const level = normalizePressure(pressure);
  const c = PRESSURE_CFG[level];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${c.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Export                                                             */
/* ------------------------------------------------------------------ */

interface PressureTableProps {
  data: FoodCostItem[];
  loading: boolean;
  error: string | null;
}

export function PressureTable({ data, loading, error }: PressureTableProps) {
  const [tab, setTab] = useState<FilterTab>("All");

  const filtered = useMemo(
    () => (tab === "All" ? data : data.filter((d) => normalizePressure(d.pressure) === tab)),
    [data, tab],
  );

  const counts = useMemo(() => {
    const m: Record<FilterTab, number> = { All: data.length, High: 0, Medium: 0, Low: 0 };
    for (const d of data) m[normalizePressure(d.pressure)]++;
    return m;
  }, [data]);

  return (
    <div className="space-y-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        AI Pressure Analysis
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1">
        {FILTER_TABS.map((t) => {
          const active = tab === t;
          const c = TAB_COLORS[t];
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative rounded-md px-3 py-1.5 text-xs font-medium transition-colors border border-transparent ${active ? c.on : c.off}`}
            >
              {t}
              {!loading && (
                <span className="ml-1.5 opacity-40 tabular-nums font-mono">{counts[t]}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
          We&apos;re crunching your cost data &mdash; pressure analysis will appear shortly.
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">
            {tab === "All"
              ? "No cost pressure data yet \u2014 CarabinerOS will analyze your menu once costs are tracked."
              : `Nothing in ${tab.toLowerCase()} pressure right now \u2014 try a different filter.`}
          </p>
        </div>
      )}

      {/* Data table */}
      <AnimatePresence mode="wait">
        {!loading && !error && filtered.length > 0 && (
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl border border-border/60 overflow-hidden"
          >
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Menu Item</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Cost %</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Pressure</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item, idx) => {
                  const cost = parseCost(item.current_cost_pct);
                  return (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.03, duration: 0.25 }}
                      className="group border-b border-border/40 last:border-0 hover:bg-muted/10 transition-colors"
                    >
                      <TableCell className="font-medium text-foreground">{item.menu_item_name}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold font-mono">
                        <span className={cost > 32 ? "text-red-400" : cost < 28 ? "text-emerald-400" : "text-foreground"}>
                          {item.current_cost_pct}
                        </span>
                        <span className="ml-1"><CostTrend value={cost} /></span>
                      </TableCell>
                      <TableCell><PressureBadge pressure={item.pressure} /></TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-xs truncate">{item.action}</TableCell>
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
