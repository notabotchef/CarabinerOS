"use client";

import { useState, useMemo } from "react";
import {
  Star,
  Puzzle,
  Tractor,
  CircleOff,
  UtensilsCrossed,
  Loader2,
} from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
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

interface MenuItem {
  id: string;
  location_id: string;
  item_name: string;
  category: string;
  performance: "Star" | "Puzzle" | "Plowhorse" | "Dog";
  margin_pct: string;
  recommendation: string;
  recipe_id: string | null;
  summary: string | null;
  detail_points: string[] | null;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORIES = ["All", "Appetizer", "Entree", "Dessert", "Beverage"] as const;

type Performance = MenuItem["performance"];

const PERF_CONFIG: Record<
  Performance,
  { label: string; icon: typeof Star; bg: string; text: string; dot: string; description: string }
> = {
  Star: {
    label: "Star",
    icon: Star,
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    dot: "bg-amber-400",
    description: "High profit + high popularity",
  },
  Puzzle: {
    label: "Puzzle",
    icon: Puzzle,
    bg: "bg-violet-500/15",
    text: "text-violet-400",
    dot: "bg-violet-400",
    description: "High profit + low popularity",
  },
  Plowhorse: {
    label: "Plowhorse",
    icon: Tractor,
    bg: "bg-blue-500/15",
    text: "text-blue-400",
    dot: "bg-blue-400",
    description: "Low profit + high popularity",
  },
  Dog: {
    label: "Dog",
    icon: CircleOff,
    bg: "bg-muted",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
    description: "Low profit + low popularity",
  },
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function PerformanceBadge({ performance }: { performance: Performance }) {
  const cfg = PERF_CONFIG[performance];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function KpiCard({
  perf,
  count,
}: {
  perf: Performance;
  count: number;
}) {
  const cfg = PERF_CONFIG[perf];
  const Icon = cfg.icon;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className={`flex h-8 w-8 items-center justify-center rounded-md ${cfg.bg}`}>
        <Icon className={`h-4 w-4 ${cfg.text}`} />
      </div>
      <div>
        <p className="text-xl font-semibold tabular-nums text-foreground">{count}</p>
        <p className="text-xs text-muted-foreground">{cfg.label}s</p>
      </div>
    </div>
  );
}

function LegendRow({ perf }: { perf: Performance }) {
  const cfg = PERF_CONFIG[perf];
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
      <span className="font-medium text-foreground">{cfg.label}</span>
      <span className="hidden sm:inline">{cfg.description}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function LoadingState() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* KPI skeletons */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
      {/* Table skeletons */}
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
        <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">No menu items yet</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        Menu items will appear here once they are added to the system. Each item
        will be classified into the BCG performance matrix.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function MenuPage() {
  const { data, loading, error } = useWorkspace<MenuItem>("/api/menu");
  const [activeCategory, setActiveCategory] = useState<string>("All");

  /* Filtered data */
  const filtered = useMemo(() => {
    if (activeCategory === "All") return data;
    return data.filter((item) => item.category === activeCategory);
  }, [data, activeCategory]);

  /* KPI counts */
  const counts = useMemo(() => {
    const map: Record<Performance, number> = { Star: 0, Puzzle: 0, Plowhorse: 0, Dog: 0 };
    for (const item of filtered) {
      if (item.performance in map) map[item.performance]++;
    }
    return map;
  }, [filtered]);

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* ------- Header ------- */}
      <header className="shrink-0 border-b border-border px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Menu Engineering</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Performance and margin analysis
            </p>
          </div>
          {!loading && !error && (
            <span className="text-sm tabular-nums text-muted-foreground">
              {filtered.length} item{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Category filter tabs */}
        <div className="mt-4 flex items-center gap-1">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </header>

      {/* ------- Content ------- */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-destructive">
            <Loader2 className="h-4 w-4" />
            Failed to load menu data
          </div>
        ) : data.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-6 p-6">
            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["Star", "Puzzle", "Plowhorse", "Dog"] as const).map((perf) => (
                <KpiCard key={perf} perf={perf} count={counts[perf]} />
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              {(["Star", "Puzzle", "Plowhorse", "Dog"] as const).map((perf) => (
                <LegendRow key={perf} perf={perf} />
              ))}
            </div>

            {/* Data table */}
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No items in this category
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead className="text-right">Margin %</TableHead>
                    <TableHead>Recommendation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-foreground">
                        {item.item_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.category}
                      </TableCell>
                      <TableCell>
                        <PerformanceBadge performance={item.performance} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-foreground">
                        {item.margin_pct}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {item.recommendation}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
