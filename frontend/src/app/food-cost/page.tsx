"use client";

import { useState, useMemo } from "react";
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Badge } from "@/components/ui/badge";
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

const PRESSURE_CONFIG: Record<PressureLevel, {
  dotClass: string;
  badgeClass: string;
  label: string;
}> = {
  High: {
    dotClass: "bg-red-500",
    badgeClass: "bg-red-500/15 text-red-400 border-red-500/20",
    label: "High",
  },
  Medium: {
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    label: "Medium",
  },
  Low: {
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    label: "Low",
  },
};

const TAB_STYLES: Record<FilterTab, { active: string; inactive: string }> = {
  All: {
    active: "bg-primary text-primary-foreground",
    inactive: "text-muted-foreground hover:text-foreground hover:bg-muted",
  },
  High: {
    active: "bg-red-500/15 text-red-400 border border-red-500/20",
    inactive: "text-muted-foreground hover:text-red-400 hover:bg-red-500/10",
  },
  Medium: {
    active: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
    inactive: "text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10",
  },
  Low: {
    active: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
    inactive: "text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10",
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseCostPct(raw: string): number {
  const n = parseFloat(raw.replace("%", ""));
  return isNaN(n) ? 0 : n;
}

function CostTrend({ value }: { value: number }) {
  if (value > 32) {
    return <ArrowUpRight className="inline h-3.5 w-3.5 text-red-400" />;
  }
  if (value < 28) {
    return <ArrowDownRight className="inline h-3.5 w-3.5 text-emerald-400" />;
  }
  return <Minus className="inline h-3.5 w-3.5 text-muted-foreground" />;
}

function PressureBadge({ pressure }: { pressure: PressureLevel }) {
  const config = PRESSURE_CONFIG[pressure];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.badgeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
      {config.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  KPI Card                                                           */
/* ------------------------------------------------------------------ */

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <span className={`text-2xl font-bold tabular-nums ${accent ?? "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function FoodCostPage() {
  const { data, loading, error } = useWorkspace<FoodCostItem>("/api/food-cost");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("All");

  /* Derived data */
  const filteredData = useMemo(() => {
    if (activeFilter === "All") return data;
    return data.filter((d) => d.pressure === activeFilter);
  }, [data, activeFilter]);

  const overallCostPct = useMemo(() => {
    if (data.length === 0) return 0;
    const sum = data.reduce((acc, d) => acc + parseCostPct(d.current_cost_pct), 0);
    return sum / data.length;
  }, [data]);

  const aboveTarget = useMemo(
    () => data.filter((d) => parseCostPct(d.current_cost_pct) > 30).length,
    [data],
  );

  const highPressure = useMemo(
    () => data.filter((d) => d.pressure === "High").length,
    [data],
  );

  /* Count per filter for tab labels */
  const pressureCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = { All: data.length, High: 0, Medium: 0, Low: 0 };
    for (const d of data) {
      if (d.pressure in counts) counts[d.pressure as PressureLevel]++;
    }
    return counts;
  }, [data]);

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* ---- Header ---- */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
        <DollarSign className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-bold text-foreground">Food Cost</h1>
          <p className="text-sm text-muted-foreground">
            Margin pressure analysis
          </p>
        </div>
      </header>

      {/* ---- Content ---- */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* ---- KPI Cards ---- */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiSkeleton />
              <KpiSkeleton />
              <KpiSkeleton />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard
                label="Overall Food Cost"
                value={data.length > 0 ? `${overallCostPct.toFixed(1)}%` : "--"}
                icon={DollarSign}
                accent={overallCostPct > 30 ? "text-red-400" : "text-emerald-400"}
              />
              <KpiCard
                label="Items Above Target"
                value={data.length > 0 ? String(aboveTarget) : "--"}
                icon={TrendingUp}
                accent={aboveTarget > 0 ? "text-amber-400" : "text-emerald-400"}
              />
              <KpiCard
                label="High Pressure Items"
                value={data.length > 0 ? String(highPressure) : "--"}
                icon={AlertTriangle}
                accent={highPressure > 0 ? "text-red-400" : "text-emerald-400"}
              />
            </div>
          )}

          {/* ---- Filter Tabs ---- */}
          <div className="flex items-center gap-1">
            {FILTER_TABS.map((tab) => {
              const isActive = activeFilter === tab;
              const style = TAB_STYLES[tab];
              return (
                <button
                  key={tab}
                  onClick={() => setActiveFilter(tab)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive ? style.active : style.inactive
                  }`}
                >
                  {tab}
                  {!loading && (
                    <span className="ml-1.5 opacity-60">{pressureCounts[tab]}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ---- Error state ---- */}
          {error && !loading && (
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              No data available — API endpoint not connected yet
            </div>
          )}

          {/* ---- Loading state ---- */}
          {loading && (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          )}

          {/* ---- Empty state ---- */}
          {!loading && !error && filteredData.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <DollarSign className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {activeFilter === "All"
                  ? "No food cost data yet"
                  : `No ${activeFilter.toLowerCase()} pressure items`}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Items will appear here once the API is connected
              </p>
            </div>
          )}

          {/* ---- Data Table ---- */}
          {!loading && !error && filteredData.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Menu Item</TableHead>
                    <TableHead className="text-right">Current Cost %</TableHead>
                    <TableHead>Pressure</TableHead>
                    <TableHead>Recommended Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => {
                    const costNum = parseCostPct(item.current_cost_pct);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-foreground">
                          {item.menu_item_name}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className={
                            costNum > 32
                              ? "text-red-400"
                              : costNum < 28
                                ? "text-emerald-400"
                                : "text-foreground"
                          }>
                            {item.current_cost_pct}
                          </span>
                          <span className="ml-1.5">
                            <CostTrend value={costNum} />
                          </span>
                        </TableCell>
                        <TableCell>
                          <PressureBadge pressure={item.pressure} />
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {item.action}
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
    </div>
  );
}
