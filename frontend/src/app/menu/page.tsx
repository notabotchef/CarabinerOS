"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Puzzle,
  Tractor,
  CircleOff,
  UtensilsCrossed,
  AlertTriangle,
  Clock,
  ChevronRight,
  X,
} from "lucide-react";
import { MenuButton } from "@/components/menu-button";
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
  // Phase 1 fields
  price: number | null;
  food_cost: number | null;
  contribution_margin: number | null;
  food_cost_pct: number | null;
  quantity_sold: number | null;
  menu_mix_pct: number | null;
  is_86: boolean;
  eighty_six_reason: string | null;
  eighty_six_at: string | null;
}

interface EightySixItem extends MenuItem {
  eighty_six_count?: number;
}

type Performance = MenuItem["performance"];
type TabId = "performance" | "current-menu" | "history" | "86-board";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORIES = ["All", "Appetizer", "Entree", "Dessert", "Beverage"] as const;

const TABS: { id: TabId; label: string }[] = [
  { id: "performance", label: "Performance" },
  { id: "current-menu", label: "Current Menu" },
  { id: "history", label: "History" },
  { id: "86-board", label: "86 Board" },
];

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
  const cfg = PERF_CFG[performance] ?? PERF_CFG.Dog;
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

function EightySixBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-500 ring-1 ring-red-500/20">
      <AlertTriangle className="h-3 w-3" />
      86&apos;d
    </span>
  );
}

function KpiCard({ perf, count, index }: { perf: Performance; count: number; index: number }) {
  const cfg = PERF_CFG[perf] ?? PERF_CFG.Dog;
  const Icon = cfg.icon;
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="relative overflow-hidden rounded-xl border border-border bg-card p-4"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${cfg.gradient} pointer-events-none`} />
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {cfg.label}s
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums font-mono text-foreground">{count}</p>
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
/*  Format helpers                                                     */
/* ------------------------------------------------------------------ */

function formatCurrency(val: number | null): string {
  if (val === null || val === undefined) return "--";
  return `$${val.toFixed(2)}`;
}

function formatPct(val: number | null): string {
  if (val === null || val === undefined) return "--";
  return `${val.toFixed(1)}%`;
}

function formatDuration(isoDate: string | null): string {
  if (!isoDate) return "--";
  const ms = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

/* ------------------------------------------------------------------ */
/*  Item Detail Sheet                                                  */
/* ------------------------------------------------------------------ */

function ItemDetailSheet({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card shadow-md"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">{item.item_name}</h2>
          {item.is_86 && <EightySixBadge />}
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Category and Performance */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{item.category}</span>
          <span className="text-xs text-muted-foreground">--</span>
          <PerformanceBadge performance={item.performance} />
        </div>

        {/* Pricing grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Price</p>
            <p className="mt-1 text-xl font-bold font-mono text-foreground">{formatCurrency(item.price)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Food Cost</p>
            <p className="mt-1 text-xl font-bold font-mono text-foreground">{formatCurrency(item.food_cost)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">CM</p>
            <p className="mt-1 text-xl font-bold font-mono text-emerald-400">{formatCurrency(item.contribution_margin)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Food Cost %</p>
            <p className={`mt-1 text-xl font-bold font-mono ${
              (item.food_cost_pct ?? 0) > 35 ? "text-red-500" :
              (item.food_cost_pct ?? 0) > 30 ? "text-amber-500" :
              "text-emerald-400"
            }`}>{formatPct(item.food_cost_pct)}</p>
          </div>
        </div>

        {/* Sales */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Qty Sold (30d)</p>
            <p className="mt-1 text-xl font-bold font-mono text-foreground">{item.quantity_sold ?? "--"}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Menu Mix %</p>
            <p className="mt-1 text-xl font-bold font-mono text-foreground">{formatPct(item.menu_mix_pct)}</p>
          </div>
        </div>

        {/* Recommendation */}
        {item.recommendation && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Recommendation</p>
            <p className="mt-2 text-sm text-foreground leading-relaxed">{item.recommendation}</p>
          </div>
        )}

        {/* Detail points */}
        {item.detail_points && item.detail_points.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Details</p>
            <ul className="mt-2 space-y-1">
              {item.detail_points.map((point, i) => (
                <li key={i} className="text-xs text-muted-foreground leading-relaxed">
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Linked recipe */}
        {item.recipe_id && (
          <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Linked Recipe</p>
              <p className="mt-1 text-sm text-primary font-medium">View recipe</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
/*  Tab Content: Performance                                           */
/* ------------------------------------------------------------------ */

function PerformanceTab({
  filtered,
  counts,
  onSelectItem,
}: {
  filtered: MenuItem[];
  counts: Record<Performance, number>;
  onSelectItem: (item: MenuItem) => void;
}) {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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

      {/* Enhanced data table */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No items in this category
        </p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Item Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Performance</TableHead>
                <TableHead className="text-right font-mono">Price</TableHead>
                <TableHead className="text-right font-mono">Food Cost</TableHead>
                <TableHead className="text-right font-mono">CM</TableHead>
                <TableHead className="text-right font-mono">Qty Sold</TableHead>
                <TableHead className="text-right font-mono">FC %</TableHead>
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
                    className="border-b border-border transition-colors hover:bg-muted/50 cursor-pointer"
                    onClick={() => onSelectItem(item)}
                  >
                    <TableCell className="font-medium text-foreground">
                      <span className="flex items-center gap-2">
                        {item.item_name}
                        {item.is_86 && <EightySixBadge />}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.category}
                    </TableCell>
                    <TableCell>
                      <PerformanceBadge performance={item.performance} />
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-foreground">
                      {formatCurrency(item.price)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-foreground">
                      {formatCurrency(item.food_cost)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-emerald-400">
                      {formatCurrency(item.contribution_margin)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-foreground">
                      {item.quantity_sold ?? "--"}
                    </TableCell>
                    <TableCell className={`text-right font-mono tabular-nums ${
                      (item.food_cost_pct ?? 0) > 35 ? "text-red-500" :
                      (item.food_cost_pct ?? 0) > 30 ? "text-amber-500" :
                      "text-foreground"
                    }`}>
                      {formatPct(item.food_cost_pct)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
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
  );
}

/* ------------------------------------------------------------------ */
/*  Tab Content: Current Menu                                          */
/* ------------------------------------------------------------------ */

function CurrentMenuTab({
  data,
  onSelectItem,
}: {
  data: MenuItem[];
  onSelectItem: (item: MenuItem) => void;
}) {
  const activeItems = useMemo(() => data.filter((item) => !item.is_86), [data]);

  const grouped = useMemo(() => {
    const map: Record<string, MenuItem[]> = {};
    for (const item of activeItems) {
      const cat = item.category || "Uncategorized";
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [activeItems]);

  if (activeItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No active menu items</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {grouped.map(([category, items]) => (
        <div key={category}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {category}
            <span className="ml-2 font-mono text-muted-foreground/60">{items.length}</span>
          </h3>
          <div className="space-y-2">
            {items.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50 cursor-pointer"
                onClick={() => onSelectItem(item)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <PerformanceBadge performance={item.performance} />
                  <span className="text-sm font-medium text-foreground truncate">{item.item_name}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-sm font-mono tabular-nums text-foreground">
                    {formatCurrency(item.price)}
                  </span>
                  {item.contribution_margin !== null && (
                    <span className="text-xs font-mono tabular-nums text-emerald-400">
                      CM {formatCurrency(item.contribution_margin)}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab Content: History (placeholder for v1)                          */
/* ------------------------------------------------------------------ */

function HistoryTab() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
        <Clock className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">Menu History</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        Past menus by date will appear here. Ask the chat &quot;Show me last
        Tuesday&apos;s menu&quot; to explore historical data.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab Content: 86 Board                                              */
/* ------------------------------------------------------------------ */

function EightySixBoardTab() {
  const { data, loading } = useWorkspace<EightySixItem>("/api/menu/86-board");

  if (loading) {
    return (
      <div className="p-6 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
          <UtensilsCrossed className="h-6 w-6 text-emerald-400" />
        </div>
        <p className="text-sm font-medium text-foreground">All clear</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          No items are currently 86&apos;d. When something runs out, use the chat:
          &quot;86 the lobster bisque -- ran out&quot;
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-red-500">
        {data.length} item{data.length !== 1 ? "s" : ""} currently 86&apos;d
      </p>
      {data.map((item) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-red-500/20 bg-red-500/5 p-4"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-semibold text-foreground">{item.item_name}</span>
                <span className="text-xs text-muted-foreground">{item.category}</span>
              </div>
              {item.eighty_six_reason && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Reason: {item.eighty_six_reason}
                </p>
              )}
              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="h-3 w-3" />
                  {formatDuration(item.eighty_six_at)}
                </span>
                {typeof item.eighty_six_count === "number" && item.eighty_six_count > 1 && (
                  <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-500">
                    86&apos;d {item.eighty_six_count} times
                  </span>
                )}
              </div>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Un-86 via chat
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function MenuPage() {
  const { data, loading, error } = useWorkspace<MenuItem>("/api/menu");
  const [activeTab, setActiveTab] = useState<TabId>("performance");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  // Count 86'd items for the tab badge
  const eightySixCount = useMemo(() => data.filter((item) => item.is_86).length, [data]);

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

  const handleSelectItem = useCallback((item: MenuItem) => {
    setSelectedItem(item);
  }, []);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-card">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <MenuButton />
            <div className="flex-1 flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold text-foreground">Menu Engineering</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  BCG matrix analysis -- profitability vs. popularity
                </p>
              </div>
              {!loading && !error && (
                <span className="text-sm font-mono tabular-nums text-muted-foreground">
                  {data.length} item{data.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex items-center gap-1">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  {tab.id === "86-board" && eightySixCount > 0 && (
                    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {eightySixCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Category filter (only on performance tab) */}
          {activeTab === "performance" && (
            <div className="mt-3 flex items-center gap-1">
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      isActive
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="rounded-xl border border-border bg-card m-6 p-4 text-sm text-muted-foreground">
            No data available -- API endpoint not connected yet
          </div>
        ) : data.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {activeTab === "performance" && (
              <PerformanceTab
                filtered={filtered}
                counts={counts}
                onSelectItem={handleSelectItem}
              />
            )}
            {activeTab === "current-menu" && (
              <CurrentMenuTab data={data} onSelectItem={handleSelectItem} />
            )}
            {activeTab === "history" && <HistoryTab />}
            {activeTab === "86-board" && <EightySixBoardTab />}
          </>
        )}
      </div>

      {/* Item Detail Sheet Overlay */}
      <AnimatePresence>
        {selectedItem && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setSelectedItem(null)}
            />
            <ItemDetailSheet
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
