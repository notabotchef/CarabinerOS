"use client";

import { useState, useEffect } from "react";
import { RefreshCcw } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { OrderStatus } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RawLineItem {
  qty?: string;
  quantity?: number;
  item?: string;
  name?: string;
  unit?: string;
  price?: string;
  unit_price?: number;
  total?: number;
}

interface OrderData {
  id: string;
  vendor: string;
  channel: string;
  status: OrderStatus;
  total: string;
  eta: string | null;
  line_items: RawLineItem[] | null;
  created_at: string;
}

interface LineItem {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(v: unknown): string {
  if (v == null || v === "") return "\u2014";
  const s = String(v).replace(/[$,]/g, "").trim();
  const n = Number(s);
  if (isNaN(n)) return String(v);
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function normalizeLineItems(raw: RawLineItem[]): LineItem[] {
  return raw.map((r) => {
    const qtyStr = String(r.qty ?? r.quantity ?? "1");
    const qtyMatch = qtyStr.match(/^([\d.]+)\s*(.*)/);
    const quantity = qtyMatch ? parseFloat(qtyMatch[1]) : 1;
    const unit = qtyMatch?.[2]?.trim() || (r.unit ?? "");
    const priceStr = String(r.price ?? r.unit_price ?? r.total ?? "0");
    const priceNum = parseFloat(priceStr.replace(/[^0-9.-]/g, "")) || 0;
    return {
      name: (r.item ?? r.name ?? "") as string,
      quantity,
      unit,
      unitPrice: priceNum,
      total: priceNum,
    };
  });
}

const STATUS_STYLES: Record<string, string> = {
  Drafting: "bg-muted text-muted-foreground",
  "Ready to send": "bg-blue-500/10 text-blue-400",
  "Awaiting approval": "bg-amber-500/10 text-amber-400",
  Submitted: "bg-amber-500/10 text-amber-400",
  Confirmed: "bg-emerald-500/10 text-emerald-400",
  Delivered: "bg-emerald-500/10 text-emerald-400",
};

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function OrderDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* Header strip */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Skeleton className="h-3 w-12 mb-1.5" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div>
          <Skeleton className="h-3 w-12 mb-1.5" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div>
          <Skeleton className="h-3 w-12 mb-1.5" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      {/* Total */}
      <Skeleton className="h-14 w-full rounded-xl" />
      {/* Table rows */}
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface OrderDetailCardProps {
  itemId: string;
}

export function OrderDetailCard({ itemId }: OrderDetailCardProps) {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchOrder = () => {
    setLoading(true);
    setError(false);
    fetch(`/api/orders/${itemId}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        const payload = json.data ?? json;
        if (payload?.id) {
          setOrder(payload);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  if (loading) return <OrderDetailSkeleton />;

  if (error || !order) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground">
        <p>Could not load order details</p>
        <button
          onClick={fetchOrder}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted/50 hover:bg-muted/80 border border-border/60 transition-colors"
        >
          <RefreshCcw className="size-3" />
          Retry
        </button>
      </div>
    );
  }

  const lineItems = Array.isArray(order.line_items)
    ? normalizeLineItems(order.line_items)
    : [];

  const storedTotal = order.total
    ? parseFloat(String(order.total).replace(/[^0-9.-]/g, ""))
    : 0;
  const computedTotal = storedTotal > 0
    ? storedTotal
    : lineItems.reduce((s, i) => s + i.total, 0);

  return (
    <div className="flex flex-col gap-4" data-testid="order-detail-card">
      {/* Header strip: vendor, channel, ETA, status */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
            Vendor
          </p>
          <p className="text-sm font-semibold text-foreground mt-0.5">
            {order.vendor}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
            Channel
          </p>
          <p className="text-sm text-foreground mt-0.5">{order.channel}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
            ETA
          </p>
          <p className="text-sm font-mono text-foreground mt-0.5">
            {order.eta ?? "\u2014"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
            Status
          </p>
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold mt-0.5 ${STATUS_STYLES[order.status] ?? "bg-muted text-muted-foreground"}`}
          >
            {order.status}
          </span>
        </div>
      </div>

      {/* Total */}
      <div className="rounded-xl bg-card border border-border p-4">
        <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
          Order Total
        </p>
        <p className="text-3xl font-extrabold font-mono tabular-nums text-foreground mt-1">
          {formatCurrency(computedTotal)}
        </p>
      </div>

      {/* Line items table */}
      {lineItems.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Item</TableHead>
                <TableHead className="text-xs font-semibold text-right">Qty</TableHead>
                <TableHead className="text-xs font-semibold">Unit</TableHead>
                <TableHead className="text-xs font-semibold text-right">Price</TableHead>
                <TableHead className="text-xs font-semibold text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((item, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm text-foreground">{item.name}</TableCell>
                  <TableCell className="text-sm text-right font-mono tabular-nums">
                    {item.quantity}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.unit}</TableCell>
                  <TableCell className="text-sm text-right font-mono tabular-nums">
                    {formatCurrency(item.unitPrice)}
                  </TableCell>
                  <TableCell className="text-sm text-right font-mono tabular-nums font-semibold">
                    {formatCurrency(item.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground rounded-xl border border-border">
          No line items yet
        </div>
      )}
    </div>
  );
}
