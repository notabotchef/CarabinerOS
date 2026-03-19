"use client";

import { useMemo, useState } from "react";
import { Package, AlertTriangle, TrendingUp, Search } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { WorkspaceTable } from "@/components/workspace-table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

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
  summary: string | null;
  detail_points: string[] | null;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseNum(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
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
/*  KPI Card                                                           */
/* ------------------------------------------------------------------ */

function KpiCard({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tint?: "red" | "green";
}) {
  const tintBg =
    tint === "red"
      ? "bg-red-500/10 dark:bg-red-500/15"
      : tint === "green"
        ? "bg-emerald-500/10 dark:bg-emerald-500/15"
        : "bg-muted";

  const tintText =
    tint === "red"
      ? "text-red-600 dark:text-red-400"
      : tint === "green"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-muted-foreground";

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
      <div className={`rounded-md p-2 ${tintBg}`}>
        <Icon className={`h-5 w-5 ${tintText}`} />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
      <Skeleton className="h-9 w-9 rounded-md" />
      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-7 w-10" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Columns                                                            */
/* ------------------------------------------------------------------ */

const COLUMNS = [
  { key: "item_name" as const, label: "Item Name" },
  {
    key: "on_hand" as const,
    label: "On Hand",
    render: (v: unknown) => (
      <span className="tabular-nums">{parseNum(v)}</span>
    ),
  },
  {
    key: "par" as const,
    label: "Par",
    render: (v: unknown) => (
      <span className="tabular-nums">{parseNum(v)}</span>
    ),
  },
  {
    key: "variance" as const,
    label: "Variance",
    render: (v: unknown) => {
      const n = parseNum(v);
      const color =
        n < 0
          ? "text-red-600 dark:text-red-400"
          : n > 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-muted-foreground";
      const prefix = n > 0 ? "+" : "";
      return <span className={`tabular-nums font-medium ${color}`}>{prefix}{n}</span>;
    },
  },
  {
    key: "updated_at" as const,
    label: "Last Updated",
    render: (v: unknown) => (
      <span className="text-muted-foreground">{formatDate(v)}</span>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function InventoryPage() {
  const { data, loading, error } = useWorkspace<InventoryItem>("/api/inventory");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((item) => item.item_name?.toLowerCase().includes(q));
  }, [data, search]);

  const totalItems = data.length;
  const belowPar = data.filter((d) => parseNum(d.variance) < 0).length;
  const abovePar = data.filter((d) => parseNum(d.variance) > 0).length;

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Inventory</h1>
            <p className="text-sm text-muted-foreground">
              Stock levels and par management
            </p>
          </div>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Total Items"
              value={totalItems}
              icon={Package}
            />
            <KpiCard
              label="Below Par"
              value={belowPar}
              icon={AlertTriangle}
              tint="red"
            />
            <KpiCard
              label="Above Par"
              value={abovePar}
              icon={TrendingUp}
              tint="green"
            />
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            No data available — API endpoint not connected yet
          </div>
        )}

        {/* Data Table */}
        <WorkspaceTable
          columns={COLUMNS}
          data={filtered}
          loading={loading}
          emptyMessage="No inventory items. Use chat to run an inventory count."
        />
      </div>
    </div>
  );
}
