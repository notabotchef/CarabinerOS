"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ModuleChat } from "@/components/module-chat";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CountLine {
  id: string;
  item_name: string | null;
  category: string | null;
  quantity: number;
  unit_cost: number;
  line_total: number;
  storage_area: string | null;
}

interface CountDetail {
  id: string;
  count_date: string;
  count_type: string;
  status: string;
  counted_by: string | null;
  notes: string | null;
  line_count: number;
  total_value: number;
  lines: CountLine[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(v: string): string {
  const d = new Date(v + "T00:00:00");
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatQuantity(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

/* ------------------------------------------------------------------ */
/*  Top 5 Mini Bar Chart                                               */
/* ------------------------------------------------------------------ */

function TopItemsChart({ lines }: { lines: CountLine[] }) {
  const sorted = [...lines]
    .sort((a, b) => b.line_total - a.line_total)
    .slice(0, 5);

  if (sorted.length === 0) return null;

  const maxValue = sorted[0].line_total;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Top 5 Most Expensive Items
      </p>
      <div className="space-y-2">
        {sorted.map((line) => {
          const pct = maxValue > 0 ? (line.line_total / maxValue) * 100 : 0;
          return (
            <div key={line.id} className="flex items-center gap-3">
              <span className="text-xs text-foreground w-32 truncate shrink-0">
                {line.item_name ?? "Unknown"}
              </span>
              <div className="flex-1 h-5 rounded-md bg-muted/10 overflow-hidden">
                <div
                  className="h-full rounded-md bg-primary/20"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs font-mono tabular-nums text-foreground shrink-0 w-16 text-right">
                {formatCurrency(line.line_total)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Line Items Table                                                   */
/* ------------------------------------------------------------------ */

function LineItemsTable({ lines }: { lines: CountLine[] }) {
  const sorted = [...lines].sort((a, b) => {
    const catA = a.category ?? "";
    const catB = b.category ?? "";
    if (catA !== catB) return catA.localeCompare(catB);
    return (a.item_name ?? "").localeCompare(b.item_name ?? "");
  });

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        No line items in this count.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs font-semibold">Item</TableHead>
          <TableHead className="text-xs font-semibold">Category</TableHead>
          <TableHead className="text-xs font-semibold text-right">Qty</TableHead>
          <TableHead className="text-xs font-semibold text-right">Unit Cost</TableHead>
          <TableHead className="text-xs font-semibold text-right">Line Total</TableHead>
          <TableHead className="text-xs font-semibold">Storage</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((line) => (
          <TableRow key={line.id}>
            <TableCell className="text-sm text-foreground">
              {line.item_name ?? "\u2014"}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {line.category ?? "\u2014"}
            </TableCell>
            <TableCell className="text-sm text-right font-mono tabular-nums">
              {formatQuantity(line.quantity)}
            </TableCell>
            <TableCell className="text-sm text-right font-mono tabular-nums">
              {formatCurrency(line.unit_cost)}
            </TableCell>
            <TableCell className="text-sm text-right font-mono tabular-nums font-semibold">
              {formatCurrency(line.line_total)}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {line.storage_area ?? "\u2014"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Panel                                                         */
/* ------------------------------------------------------------------ */

interface CountDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  countId: string | null;
}

export function CountDetailPanel({
  open,
  onOpenChange,
  countId,
}: CountDetailPanelProps) {
  const [detail, setDetail] = useState<CountDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDetail = useCallback(async (id: string) => {
    setLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/inventory/counts/${id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setDetail(json.data ?? json);
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && countId) {
      fetchDetail(countId);
    }
    return () => {
      setDetail(null);
      setLoading(false);
    };
  }, [open, countId, fetchDetail]);

  const isComplete = detail?.status === "completed";

  const buildContext = useCallback(() =>
    `[module=inventory, count_id=${countId ?? "unknown"}]`
  , [countId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[90vw] max-w-3xl max-h-[85vh] flex flex-col"
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-extrabold tracking-tight">
                Inventory Count
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {detail ? (
                  <span className="font-mono">
                    {formatDate(detail.count_date)}
                  </span>
                ) : (
                  "Loading..."
                )}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 ml-3 shrink-0">
              {detail && (
                <>
                  <Badge
                    variant="secondary"
                    className="text-xs capitalize"
                  >
                    {detail.count_type.replace("_", " ")}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={`text-xs ${
                      isComplete
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {detail.status.replace("_", " ")}
                  </Badge>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="size-8"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          )}

          {!loading && !detail && (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Count not found.
            </div>
          )}

          {!loading && detail && (
            <div className="p-4 space-y-6">
              {/* Metadata strip */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Items
                  </p>
                  <p className="text-sm font-mono tabular-nums font-semibold text-foreground mt-0.5">
                    {detail.line_count}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Counted By
                  </p>
                  <p className="text-sm text-foreground mt-0.5">
                    {detail.counted_by ?? "\u2014"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Notes
                  </p>
                  <p className="text-sm text-foreground mt-0.5 truncate">
                    {detail.notes ?? "\u2014"}
                  </p>
                </div>
              </div>

              {/* Total value card */}
              <div className="rounded-xl bg-card border border-border p-4">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Total Value
                </p>
                <p className="text-xl font-extrabold font-mono tabular-nums text-foreground mt-1">
                  {formatCurrency(detail.total_value)}
                </p>
              </div>

              {/* Top 5 chart */}
              <TopItemsChart lines={detail.lines} />

              {/* Line items */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  Line Items ({detail.line_count})
                </p>
                <div className="rounded-xl border border-border overflow-hidden">
                  <LineItemsTable lines={detail.lines} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat footer */}
        <div className="shrink-0 border-t border-border">
          <ModuleChat
            moduleId="inventory-count"
            buildContext={buildContext}
            placeholder="Ask about this count..."
            chips={["What items cost the most?", "Compare to last count", "Any shrinkage?"]}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
