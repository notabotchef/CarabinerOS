"use client";

import { useState, useMemo } from "react";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Flame,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWorkspace } from "@/hooks/use-workspace";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type PressureLevel = "High" | "Medium" | "Low";

type FoodCostItem = {
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
  dot: string; badge: string; glow: string; label: string;
}> = {
  High: {
    dot: "bg-red-500", glow: "shadow-red-500/40 shadow-sm",
    badge: "bg-red-500/12 text-red-400 border-red-500/25 ring-1 ring-red-500/10",
    label: "High",
  },
  Medium: {
    dot: "bg-amber-500", glow: "",
    badge: "bg-amber-500/12 text-amber-400 border-amber-500/25 ring-1 ring-amber-500/10",
    label: "Medium",
  },
  Low: {
    dot: "bg-emerald-500", glow: "",
    badge: "bg-emerald-500/12 text-emerald-400 border-emerald-500/25 ring-1 ring-emerald-500/10",
    label: "Low",
  },
};

const TAB_COLORS: Record<FilterTab, { on: string; off: string }> = {
  All:    { on: "bg-white/10 text-foreground border-white/10", off: "text-muted-foreground hover:text-foreground hover:bg-white/5" },
  High:   { on: "bg-red-500/15 text-red-400 border-red-500/20", off: "text-muted-foreground hover:text-red-400 hover:bg-red-500/8" },
  Medium: { on: "bg-amber-500/15 text-amber-400 border-amber-500/20", off: "text-muted-foreground hover:text-amber-400 hover:bg-amber-500/8" },
  Low:    { on: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", off: "text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/8" },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseCost(raw: string): number {
  const n = parseFloat(raw.replace("%", ""));
  return isNaN(n) ? 0 : n;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function CostTrend({ value }: { value: number }) {
  if (value > 32) return <ArrowUpRight className="inline h-3.5 w-3.5 text-red-400" />;
  if (value < 28) return <ArrowDownRight className="inline h-3.5 w-3.5 text-emerald-400" />;
  return <Minus className="inline h-3.5 w-3.5 text-muted-foreground/50" />;
}

function PressureBadge({ pressure }: { pressure: PressureLevel }) {
  const c = PRESSURE_CFG[pressure];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${c.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot} ${c.glow}`} />
      {c.label}
    </span>
  );
}

function KpiCard({
  label, value, icon: Icon, accent, bar, delay,
}: {
  label: string; value: string; icon: React.ElementType;
  accent?: string; bar?: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-5"
    >
      {bar && (
        <div className={`absolute inset-x-0 top-0 h-[2px] ${bar}`} />
      )}
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <span className={`text-3xl font-bold tabular-nums tracking-tight ${accent ?? "text-foreground"}`}>
        {value}
      </span>
    </motion.div>
  );
}

function KpiSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function FoodCostPage() {
  const { data, loading, error } = useWorkspace<FoodCostItem>("/api/food-cost");
  const [tab, setTab] = useState<FilterTab>("All");

  const filtered = useMemo(
    () => (tab === "All" ? data : data.filter((d) => d.pressure === tab)),
    [data, tab],
  );

  const overallPct = useMemo(() => {
    if (!data.length) return 0;
    return data.reduce((s, d) => s + parseCost(d.current_cost_pct), 0) / data.length;
  }, [data]);

  const aboveTarget = useMemo(
    () => data.filter((d) => parseCost(d.current_cost_pct) > 30).length,
    [data],
  );

  const highCount = useMemo(
    () => data.filter((d) => d.pressure === "High").length,
    [data],
  );

  const counts = useMemo(() => {
    const m: Record<FilterTab, number> = { All: data.length, High: 0, Medium: 0, Low: 0 };
    for (const d of data) if (d.pressure in m) m[d.pressure as PressureLevel]++;
    return m;
  }, [data]);

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border/60 shrink-0">
        <div className="flex items-center justify-center size-8 rounded-lg bg-red-500/10">
          <Flame className="size-4 text-red-400" />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground tracking-tight">Food Cost</h1>
          <p className="text-xs text-muted-foreground">Margin pressure analysis</p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-5">
          {/* KPI Cards */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard
                label="Overall Food Cost"
                value={data.length ? `${overallPct.toFixed(1)}%` : "--"}
                icon={DollarSign}
                accent={overallPct > 30 ? "text-red-400" : "text-emerald-400"}
                bar={overallPct > 30 ? "bg-gradient-to-r from-red-500 to-red-500/0" : "bg-gradient-to-r from-emerald-500 to-emerald-500/0"}
                delay={0}
              />
              <KpiCard
                label="Items Above 30% Target"
                value={data.length ? String(aboveTarget) : "--"}
                icon={TrendingUp}
                accent={aboveTarget > 0 ? "text-amber-400" : "text-emerald-400"}
                bar={aboveTarget > 0 ? "bg-gradient-to-r from-amber-500 to-amber-500/0" : "bg-gradient-to-r from-emerald-500 to-emerald-500/0"}
                delay={0.08}
              />
              <KpiCard
                label="High Pressure Items"
                value={data.length ? String(highCount) : "--"}
                icon={AlertTriangle}
                accent={highCount > 0 ? "text-red-400" : "text-emerald-400"}
                bar={highCount > 0 ? "bg-gradient-to-r from-red-500 to-red-500/0" : "bg-gradient-to-r from-emerald-500 to-emerald-500/0"}
                delay={0.16}
              />
            </div>
          )}

          {/* Filter Tabs */}
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
                    <span className="ml-1.5 opacity-50 tabular-nums">{counts[t]}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Error */}
          {error && !loading && (
            <div className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
              No data available — API endpoint not connected yet
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-lg" />
              ))}
            </div>
          )}

          {/* Empty */}
          {!loading && !error && filtered.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="flex items-center justify-center size-12 rounded-xl bg-muted/50 mb-3">
                <DollarSign className="size-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {tab === "All" ? "No food cost data yet" : `No ${tab.toLowerCase()} pressure items`}
              </p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                Items appear once the API is connected
              </p>
            </motion.div>
          )}

          {/* Data Table */}
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
                          <TableCell className="font-medium text-foreground">
                            {item.menu_item_name}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            <span className={
                              cost > 32 ? "text-red-400"
                                : cost < 28 ? "text-emerald-400"
                                  : "text-foreground"
                            }>
                              {item.current_cost_pct}
                            </span>
                            <span className="ml-1">
                              <CostTrend value={cost} />
                            </span>
                          </TableCell>
                          <TableCell>
                            <PressureBadge pressure={item.pressure} />
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                            {item.action}
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </TableBody>
                </Table>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
