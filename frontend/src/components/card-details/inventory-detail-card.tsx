"use client";

import { useState, useEffect } from "react";
import { RefreshCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface InventoryData {
  id: string;
  item_name: string;
  category: string | null;
  storage_area: string | null;
  on_hand: string;
  par: string;
  variance: string;
  unit: string | null;
  unit_cost: string | null;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseNum(v: unknown): number {
  if (v == null) return 0;
  const s = String(v).trim();
  const match = s.match(/^[+-]?\d+(\.\d+)?/);
  return match ? Math.round(Number(match[0]) * 10) / 10 : 0;
}

function formatCurrency(v: unknown): string {
  if (v == null || v === "") return "\u2014";
  const s = String(v).replace(/[$,]/g, "").trim();
  const n = Number(s);
  if (isNaN(n)) return String(v);
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(v: unknown): string {
  if (!v || typeof v !== "string") return "\u2014";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Returns Tailwind classes for the on-hand vs par comparison.
 * Green = at or above par. Amber = within 20% of par. Red = below 80% of par.
 */
function parStatusClasses(onHand: number, par: number): { bg: string; text: string; label: string } {
  if (par <= 0) return { bg: "bg-muted/40", text: "text-muted-foreground", label: "No par set" };
  const ratio = onHand / par;
  if (ratio >= 1) return { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Above par" };
  if (ratio >= 0.8) return { bg: "bg-amber-500/10", text: "text-amber-400", label: "Near par" };
  return { bg: "bg-red-500/10", text: "text-red-400", label: "Below par" };
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function InventoryDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-5 w-40" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface InventoryDetailCardProps {
  itemId: string;
}

export function InventoryDetailCard({ itemId }: InventoryDetailCardProps) {
  const [item, setItem] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchItem = () => {
    setLoading(true);
    setError(false);
    fetch(`/api/inventory/${itemId}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        const payload = json.data ?? json;
        if (payload?.id) {
          setItem(payload);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  if (loading) return <InventoryDetailSkeleton />;

  if (error || !item) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground">
        <p>Could not load inventory details</p>
        <button
          onClick={fetchItem}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted/50 hover:bg-muted/80 border border-border/60 transition-colors"
        >
          <RefreshCcw className="size-3" />
          Retry
        </button>
      </div>
    );
  }

  const onHand = parseNum(item.on_hand);
  const par = parseNum(item.par);
  const variance = parseNum(item.variance);
  const parStatus = parStatusClasses(onHand, par);

  return (
    <div className="flex flex-col gap-4" data-testid="inventory-detail-card">
      {/* Item name + category badge */}
      <div className="flex items-center gap-2">
        <h3 className="text-base font-bold text-foreground">{item.item_name}</h3>
        {item.category && (
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-muted text-muted-foreground">
            {item.category}
          </span>
        )}
      </div>

      {/* Storage area */}
      {item.storage_area && (
        <p className="text-xs text-muted-foreground/60">
          Storage: {item.storage_area}
        </p>
      )}

      {/* On-hand vs Par comparison */}
      <div className="grid grid-cols-2 gap-4">
        <div className={`rounded-xl p-4 border border-border ${parStatus.bg}`}>
          <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
            On Hand
          </p>
          <p className={`text-3xl font-extrabold font-mono tabular-nums mt-1 ${parStatus.text}`}>
            {onHand}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            {item.unit ?? "units"}
          </p>
        </div>
        <div className="rounded-xl p-4 border border-border bg-muted/20">
          <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
            Par Level
          </p>
          <p className="text-3xl font-extrabold font-mono tabular-nums text-foreground mt-1">
            {par}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            {item.unit ?? "units"}
          </p>
        </div>
      </div>

      {/* Status label */}
      <div className={`rounded-lg px-3 py-2 text-xs font-semibold ${parStatus.bg} ${parStatus.text}`}>
        {parStatus.label}
      </div>

      {/* Variance badge */}
      <div className="flex items-center gap-4">
        <div>
          <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
            Variance
          </p>
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-sm font-mono tabular-nums font-semibold mt-0.5 ${
            variance > 0
              ? "bg-emerald-500/10 text-emerald-400"
              : variance < 0
                ? "bg-red-500/10 text-red-400"
                : "bg-muted text-muted-foreground"
          }`}>
            {variance > 0 ? "+" : ""}{variance}
          </span>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
            Unit Cost
          </p>
          <p className="text-sm font-mono tabular-nums font-semibold text-foreground mt-0.5">
            {formatCurrency(item.unit_cost)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
            Last Updated
          </p>
          <p className="text-sm font-mono text-muted-foreground mt-0.5">
            {formatDate(item.updated_at)}
          </p>
        </div>
      </div>
    </div>
  );
}
