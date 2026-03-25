"use client";

import { useMemo, useState, useEffect } from "react";
import { Package, AlertTriangle, TrendingUp, DollarSign, Search } from "lucide-react";

import { motion } from "framer-motion";
import { useWorkspace } from "@/hooks/use-workspace";
import { WorkspaceTable } from "@/components/workspace-table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CountHistory } from "./components/count-history";
import { ParLevelTable } from "./components/par-level-table";
import { WasteLogTable } from "./components/waste-log-table";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface InventoryItem {
  [key: string]: unknown;
  id: string;
  location_id: string;
  item_name: string;
  on_hand: string;
  par: string;
  variance: string;
  unit: string | null;
  category: string | null;
  storage_area: string | null;
  unit_cost: string | null;
  summary: string | null;
  detail_points: string[] | null;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */

const TABS = ["Overview", "Counts", "Par Levels", "Waste"] as const;
type Tab = (typeof TABS)[number];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseNum(v: unknown): number {
  if (v == null) return 0;
  const s = String(v).trim();
  const match = s.match(/^[+-]?\d+(\.\d+)?/);
  return match ? Math.round(Number(match[0]) * 10) / 10 : 0;
}

function parseDisplay(v: unknown): string {
  if (v == null) return "0";
  const s = String(v).trim();
  const match = s.match(/^([+-]?\d+(?:\.\d+)?)\s*(.*)/);
  if (!match) return s;
  const [, num, unit] = match;
  const rounded = parseFloat(Number(num).toFixed(1));
  return unit ? `${rounded} ${unit}` : String(rounded);
}

function formatDate(v: unknown): string {
  if (!v || typeof v !== "string") return "\u2014";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/*  Motion variants                                                    */
/* ------------------------------------------------------------------ */

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: [0, 0, 0.58, 1] as [number, number, number, number] },
  }),
};

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

/* ------------------------------------------------------------------ */
/*  KPI Card                                                           */
/* ------------------------------------------------------------------ */

function KpiCard({
  label,
  value,
  icon: Icon,
  tint,
  index,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tint?: "destructive" | "positive" | "info";
  index: number;
}) {
  const tintBg =
    tint === "destructive"
      ? "bg-destructive/10"
      : tint === "positive"
        ? "bg-emerald-500/10 dark:bg-emerald-500/10"
        : tint === "info"
          ? "bg-blue-500/10"
          : "bg-muted";

  const tintIcon =
    tint === "destructive"
      ? "text-destructive"
      : tint === "positive"
        ? "text-emerald-600 dark:text-emerald-400"
        : tint === "info"
          ? "text-blue-600 dark:text-blue-400"
          : "text-muted-foreground";

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="rounded-xl border border-border bg-card p-4 flex items-center gap-4"
    >
      <div className={`rounded-lg p-2.5 ${tintBg}`}>
        <Icon className={`h-5 w-5 ${tintIcon}`} />
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className={`text-3xl font-bold font-mono leading-tight text-foreground tabular-nums`}>
          {value}
        </span>
      </div>
    </motion.div>
  );
}

function KpiSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-12" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Variance bar                                                       */
/* ------------------------------------------------------------------ */

function VarianceBar({
  below,
  at,
  above,
}: {
  below: number;
  at: number;
  above: number;
}) {
  const total = below + at + above || 1;
  const pctBelow = Math.round((below / total) * 100);
  const pctAt = Math.round((at / total) * 100);
  const pctAbove = 100 - pctBelow - pctAt;

  return (
    <motion.div
      initial={{ opacity: 0, scaleX: 0.6 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ delay: 0.3, duration: 0.4, ease: "easeOut" }}
      className="flex h-2 w-full rounded-full overflow-hidden origin-left"
    >
      {pctBelow > 0 && (
        <div
          className="bg-destructive/60"
          style={{ width: `${pctBelow}%` }}
        />
      )}
      {pctAt > 0 && (
        <div
          className="bg-muted-foreground/20"
          style={{ width: `${pctAt}%` }}
        />
      )}
      {pctAbove > 0 && (
        <div
          className="bg-emerald-500/60"
          style={{ width: `${pctAbove}%` }}
        />
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Overview columns                                                   */
/* ------------------------------------------------------------------ */

const COLUMNS = [
  {
    key: "item_name" as const,
    label: "Item",
    render: (v: unknown) => (
      <span className="font-medium text-foreground">{String(v)}</span>
    ),
  },
  {
    key: "category" as const,
    label: "Category",
    render: (v: unknown) => (
      <span className="text-muted-foreground text-sm">{v ? String(v) : "\u2014"}</span>
    ),
  },
  {
    key: "storage_area" as const,
    label: "Storage",
    render: (v: unknown) => (
      <span className="text-muted-foreground text-sm">{v ? String(v) : "\u2014"}</span>
    ),
  },
  {
    key: "on_hand" as const,
    label: "On Hand",
    render: (v: unknown, row: InventoryItem) => (
      <span className="font-mono text-[13px]">
        {parseDisplay(v)}{row.unit ? ` ${row.unit}` : ""}
      </span>
    ),
  },
  {
    key: "par" as const,
    label: "Par",
    render: (v: unknown) => (
      <span className="font-mono text-[13px] text-muted-foreground">{parseDisplay(v)}</span>
    ),
  },
  {
    key: "variance" as const,
    label: "Variance",
    render: (v: unknown) => {
      const n = parseNum(v);
      if (n < 0) {
        return (
          <Badge
            variant="destructive"
            className="font-mono font-semibold text-xs px-2"
          >
            {n}
          </Badge>
        );
      }
      if (n > 0) {
        return (
          <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
            +{n}
          </span>
        );
      }
      return <span className="font-mono text-muted-foreground">0</span>;
    },
  },
  {
    key: "unit_cost" as const,
    label: "Unit Cost",
    render: (v: unknown) => (
      <span className="font-mono text-[13px] text-muted-foreground">
        {v ? `$${Number(v).toFixed(2)}` : "\u2014"}
      </span>
    ),
  },
  {
    key: "updated_at" as const,
    label: "Last Updated",
    render: (v: unknown) => (
      <span className="text-muted-foreground text-xs font-mono">{formatDate(v)}</span>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function InventoryPage() {
  const { data, loading, error } = useWorkspace<InventoryItem>("/api/inventory");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("Overview");

  // Valuation
  const [valuation, setValuation] = useState<{ total_value: number; item_count: number } | null>(null);
  useEffect(() => {
    fetch("/api/inventory/valuation", { credentials: "include" })
      .then(async (res) => {
        if (res.ok) setValuation(await res.json());
      })
      .catch(() => {});
  }, [data]);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (item) =>
        item.item_name?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q) ||
        item.storage_area?.toLowerCase().includes(q)
    );
  }, [data, search]);

  const totalItems = data.length;
  const belowPar = data.filter((d) => parseNum(d.variance) < 0).length;
  const abovePar = data.filter((d) => parseNum(d.variance) > 0).length;
  const atPar = totalItems - belowPar - abovePar;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0 bg-card">
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-8 rounded-lg bg-secondary">
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Inventory</h1>
              <p className="text-sm text-muted-foreground">
                Stock levels &amp; par management
              </p>
            </div>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 border-b border-border bg-card shrink-0">
        {TABS.map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-3 py-2.5 text-sm font-semibold transition-colors ${
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
              {active && (
                <motion.span
                  layoutId="inventory-tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full"
                  transition={spring}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-6 space-y-6 min-h-0">
          {activeTab === "Overview" && (
            <>
              {/* KPI Cards */}
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <KpiSkeleton />
                  <KpiSkeleton />
                  <KpiSkeleton />
                  <KpiSkeleton />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <KpiCard
                      label="Total Items"
                      value={totalItems}
                      icon={Package}
                      index={0}
                    />
                    <KpiCard
                      label="Below Par"
                      value={belowPar}
                      icon={AlertTriangle}
                      tint="destructive"
                      index={1}
                    />
                    <KpiCard
                      label="Above Par"
                      value={abovePar}
                      icon={TrendingUp}
                      tint="positive"
                      index={2}
                    />
                    <KpiCard
                      label="Inventory Value"
                      value={
                        valuation && valuation.total_value > 0
                          ? `$${valuation.total_value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                          : "\u2014"
                      }
                      icon={DollarSign}
                      tint="info"
                      index={3}
                    />
                  </div>

                  {/* Variance distribution bar */}
                  {totalItems > 0 && (
                    <div className="space-y-1.5">
                      <VarianceBar below={belowPar} at={atPar} above={abovePar} />
                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="inline-block size-2 rounded-full bg-destructive/60" />
                          Below par
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block size-2 rounded-full bg-muted-foreground/20" />
                          At par
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block size-2 rounded-full bg-emerald-500/60" />
                          Above par
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Error banner */}
              {error && (
                <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  We&apos;re getting your inventory ready &mdash; check back in a moment.
                </div>
              )}

              {/* Data Table */}
              <WorkspaceTable
                columns={COLUMNS}
                data={filtered}
                loading={loading}
                emptyMessage="Your shelves are clear — run a count or ask CarabinerOS to get started."
              />

              {/* Empty state */}
              {!loading && !error && data.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                  <div className="flex items-center justify-center size-12 rounded-xl bg-secondary">
                    <Package className="size-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Your shelves are waiting
                  </p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Tell CarabinerOS to run a count, set par levels, or log waste &mdash; it&apos;ll take it from there.
                  </p>
                </div>
              )}
            </>
          )}

          {activeTab === "Counts" && <CountHistory />}
          {activeTab === "Par Levels" && <ParLevelTable />}
          {activeTab === "Waste" && <WasteLogTable />}
      </div>
    </div>
  );
}
