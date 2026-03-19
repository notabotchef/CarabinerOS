"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Puzzle,
  Tractor,
  CircleOff,
  UtensilsCrossed,
} from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
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

type Performance = MenuItem["performance"];

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORIES = ["All", "Appetizer", "Entree", "Dessert", "Beverage"] as const;

const PERF_CFG: Record<
  Performance,
  {
    label: string;
    icon: typeof Star;
    bg: string;
    text: string;
    ring: string;
    dot: string;
    gradient: string;
    desc: string;
  }
> = {
  Star: {
    label: "Star",
    icon: Star,
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    ring: "ring-amber-500/20",
    dot: "bg-amber-400",
    gradient: "from-amber-500/20 to-amber-500/5",
    desc: "High profit, high popularity",
  },
  Puzzle: {
    label: "Puzzle",
    icon: Puzzle,
    bg: "bg-violet-500/10",
    text: "text-violet-400",
    ring: "ring-violet-500/20",
    dot: "bg-violet-400",
    gradient: "from-violet-500/20 to-violet-500/5",
    desc: "High profit, low popularity",
  },
  Plowhorse: {
    label: "Plowhorse",
    icon: Tractor,
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    ring: "ring-blue-500/20",
    dot: "bg-blue-400",
    gradient: "from-blue-500/20 to-blue-500/5",
    desc: "Low profit, high popularity",
  },
  Dog: {
    label: "Dog",
    icon: CircleOff,
    bg: "bg-zinc-500/10",
    text: "text-zinc-500",
    ring: "ring-zinc-500/20",
    dot: "bg-zinc-500",
    gradient: "from-zinc-500/15 to-zinc-500/5",
    desc: "Low profit, low popularity",
  },
};

const PERF_ORDER: Performance[] = ["Star", "Puzzle", "Plowhorse", "Dog"];

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const cardVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.08, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

const tableRowVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.03, duration: 0.25 },
  }),
  exit: { opacity: 0, x: 8, transition: { duration: 0.15 } },
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function PerformanceBadge({ performance }: { performance: Performance }) {
  const cfg = PERF_CFG[performance];
  const Icon = cfg.icon;
  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </motion.span>
  );
}

function KpiCard({ perf, count, index }: { perf: Performance; count: number; index: number }) {
  const cfg = PERF_CFG[perf];
  const Icon = cfg.icon;
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className={`relative overflow-hidden rounded-xl border border-border bg-card p-4`}
    >
      {/* Subtle gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${cfg.gradient} pointer-events-none`} />
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {cfg.label}s
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">{count}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{cfg.desc}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${cfg.bg}`}>
          <Icon className={`h-5 w-5 ${cfg.text}`} />
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading / Empty states                                             */
/* ------------------------------------------------------------------ */

function LoadingState() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center gap-3 py-24 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
        <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">No menu items yet</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        Items will appear here once added. Each will be classified into the BCG
        performance matrix automatically.
      </p>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function MenuPage() {
  const { data, loading, error } = useWorkspace<MenuItem>("/api/menu");
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const filtered = useMemo(() => {
    if (activeCategory === "All") return data;
    return data.filter((item) => item.category === activeCategory);
  }, [data, activeCategory]);

  const counts = useMemo(() => {
    const map: Record<Performance, number> = { Star: 0, Puzzle: 0, Plowhorse: 0, Dog: 0 };
    for (const item of filtered) {
      if (item.performance in map) map[item.performance]++;
    }
    return map;
  }, [filtered]);

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="shrink-0 border-b border-border px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Menu Engineering</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              BCG matrix analysis -- profitability vs. popularity
            </p>
          </div>
          {!loading && !error && (
            <span className="text-sm tabular-nums text-muted-foreground">
              {filtered.length} item{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Category filter */}
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

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="rounded-lg border border-border bg-card m-6 p-4 text-sm text-muted-foreground">
            No data available -- API endpoint not connected yet
          </div>
        ) : data.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-6 p-6">
            {/* KPI cards -- one per BCG quadrant */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PERF_ORDER.map((perf, i) => (
                <KpiCard key={perf} perf={perf} count={counts[perf]} index={i} />
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
              {PERF_ORDER.map((perf) => {
                const cfg = PERF_CFG[perf];
                return (
                  <div key={perf} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                    <span className="font-medium text-foreground">{cfg.label}</span>
                    <span className="hidden sm:inline">{cfg.desc}</span>
                  </div>
                );
              })}
            </div>

            {/* Data table */}
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No items in this category
              </p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Item Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Performance</TableHead>
                      <TableHead className="text-right">Margin %</TableHead>
                      <TableHead>Recommendation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {filtered.map((item, i) => (
                        <motion.tr
                          key={item.id}
                          custom={i}
                          variants={tableRowVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          layout
                          className="border-b border-border transition-colors hover:bg-muted/50"
                        >
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
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
