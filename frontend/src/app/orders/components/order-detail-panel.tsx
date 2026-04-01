"use client";

import { useState, useEffect, useCallback } from "react";
import { Send, Save, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OrderDetail, OrderLineItem, OrderStatus, VendorSummary } from "@/lib/types";
import { ModuleChat } from "@/components/module-chat";

/* ------------------------------------------------------------------ */
/*  Status badge (reused from page)                                    */
/* ------------------------------------------------------------------ */

const STATUS_STYLES: Record<OrderStatus, string> = {
  Drafting: "bg-muted text-muted-foreground",
  "Ready to send": "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  "Awaiting approval": "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Submitted: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Confirmed: "bg-green-500/10 text-green-700 dark:text-green-400",
  Delivered: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
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

function formatDate(v: unknown): string {
  if (!v || typeof v !== "string") return "\u2014";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ------------------------------------------------------------------ */
/*  Vendor select (for new orders)                                     */
/* ------------------------------------------------------------------ */

function VendorSelect({
  vendors,
  selectedId,
  onSelect,
  loading,
}: {
  vendors: VendorSummary[];
  selectedId: string | null;
  onSelect: (id: string, name: string) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="px-5 py-4 border-b border-border">
        <p className="text-xs font-medium text-muted-foreground mb-2">Vendor</p>
        <div className="h-10 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="px-5 py-4 border-b border-border">
      <p className="text-xs font-medium text-muted-foreground mb-2">Vendor</p>
      <select
        value={selectedId ?? ""}
        onChange={(e) => {
          const v = vendors.find((v) => v.id === e.target.value);
          if (v) onSelect(v.id, v.name);
        }}
        className="
          w-full rounded-lg border border-border bg-card
          px-3 py-2.5 text-sm text-foreground
          outline-none transition-colors
          focus:border-primary/50 focus:ring-2 focus:ring-primary/25
        "
      >
        <option value="">Select a vendor...</option>
        {vendors.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Line items table (read-only)                                       */
/* ------------------------------------------------------------------ */

function LineItemsTable({ items }: { items: OrderLineItem[] }) {
  if (!items || items.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        No line items yet. Use the chat to add items.
      </div>
    );
  }

  return (
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
        {items.map((item, i) => (
          <TableRow key={i}>
            <TableCell className="text-sm text-foreground">{item.name}</TableCell>
            <TableCell className="text-sm text-right font-mono tabular-nums">
              {item.quantity}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{item.unit}</TableCell>
            <TableCell className="text-sm text-right font-mono tabular-nums">
              {formatCurrency(item.unit_price)}
            </TableCell>
            <TableCell className="text-sm text-right font-mono tabular-nums font-semibold">
              {formatCurrency(item.total)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* ------------------------------------------------------------------ */
/*  Main panel component                                               */
/* ------------------------------------------------------------------ */

interface OrderDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing order ID to load, or null for new order */
  orderId: string | null;
  /** If true, this is a new order creation flow */
  isNew?: boolean;
}

export function OrderDetailPanel({
  open,
  onOpenChange,
  orderId,
  isNew = false,
}: OrderDetailPanelProps) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);

  // Vendor data for new orders
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [selectedVendorName, setSelectedVendorName] = useState<string | null>(null);

  // Fetch order detail
  useEffect(() => {
    if (!open || !orderId || isNew) {
      if (!open) {
        setOrder(null);
        setSelectedVendorId(null);
        setSelectedVendorName(null);
      }
      return;
    }

    setLoading(true);
    fetch(`/api/orders/${orderId}`, { credentials: "include" })
      .then(async (res) => {
        const json = await res.json();
        // Handle both {ok, data} envelope and bare object responses
        const payload = json.data ?? json;
        if (payload && typeof payload === "object" && payload.id) {
          setOrder(payload);
        } else {
          setOrder(null);
        }
      })
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [open, orderId, isNew, refetchKey]);

  // Fetch vendors for new order flow
  useEffect(() => {
    if (!open || !isNew) return;

    setVendorsLoading(true);
    fetch("/api/vendors", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        setVendors(Array.isArray(json) ? json : json.data ?? []);
      })
      .catch(() => setVendors([]))
      .finally(() => setVendorsLoading(false));
  }, [open, isNew]);

  // Action handlers
  const handleSubmit = useCallback(async () => {
    const id = orderId ?? order?.id;
    if (!id) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/orders/${id}/submit`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setOrder(json.data ?? json);
      }
    } finally {
      setActionLoading(false);
    }
  }, [orderId, order?.id]);

  const handleDraft = useCallback(async () => {
    const id = orderId ?? order?.id;
    if (!id) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/orders/${id}/draft`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setOrder(json.data ?? json);
      }
    } finally {
      setActionLoading(false);
    }
  }, [orderId, order?.id]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Normalize line items from DB format {qty, item, price} to display format
  const lineItems: OrderLineItem[] = Array.isArray(order?.line_items)
    ? (order.line_items as Record<string, unknown>[]).map((raw) => {
        // DB format: {qty: "5 cs", item: "Roma Tomatoes", price: "$140.00"}
        // Display format: {name, quantity, unit, unit_price, total}
        const qtyStr = String(raw.qty ?? raw.quantity ?? "1");
        const qtyMatch = qtyStr.match(/^([\d.]+)\s*(.*)/);
        const quantity = qtyMatch ? parseFloat(qtyMatch[1]) : 1;
        const unit = qtyMatch?.[2]?.trim() || (raw.unit as string) || "";
        const priceStr = String(raw.price ?? raw.unit_price ?? raw.total ?? "0");
        const priceNum = parseFloat(priceStr.replace(/[^0-9.-]/g, "")) || 0;
        return {
          name: (raw.item ?? raw.name ?? "") as string,
          quantity,
          unit,
          unit_price: priceNum,
          total: priceNum,
        };
      })
    : [];

  // Derive order total: use stored total string, fall back to line items sum
  const storedTotal = order?.total ? parseFloat(String(order.total).replace(/[^0-9.-]/g, "")) : 0;
  const computedTotal = storedTotal > 0 ? storedTotal : lineItems.reduce((s, i) => s + i.total, 0);

  const currentStatus = order?.status as OrderStatus | undefined;
  const canSubmit = currentStatus === "Drafting" || currentStatus === "Ready to send";
  const canDraft = currentStatus !== "Delivered" && currentStatus !== "Submitted";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg flex flex-col"
        showCloseButton={false}
      >
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base font-extrabold tracking-tight truncate">
                {isNew
                  ? selectedVendorName
                    ? `New Order -- ${selectedVendorName}`
                    : "New Order"
                  : order?.vendor ?? "Order Detail"}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                {isNew
                  ? "Select a vendor and use chat to build your order"
                  : order
                    ? `Created ${formatDate(order.created_at)}`
                    : "Loading..."}
              </SheetDescription>
            </div>
            {currentStatus && (
              <div className="ml-3 shrink-0">
                <StatusBadge status={currentStatus} />
              </div>
            )}
          </div>
        </SheetHeader>

        {/* Vendor select for new orders */}
        {isNew && (
          <VendorSelect
            vendors={vendors}
            selectedId={selectedVendorId}
            onSelect={(id, name) => {
              setSelectedVendorId(id);
              setSelectedVendorName(name);
            }}
            loading={vendorsLoading}
          />
        )}

        {/* Body — scrollable area */}
        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          )}

          {!loading && !isNew && !order && (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Order not found.
            </div>
          )}

          {!loading && order && (
            <div className="p-4 space-y-6">
              {/* Order info strip */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Vendor
                  </p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    {order.vendor}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Channel
                  </p>
                  <p className="text-sm text-foreground mt-0.5">{order.channel}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    ETA
                  </p>
                  <p className="text-sm font-mono text-foreground mt-0.5">
                    {order.eta ?? "\u2014"}
                  </p>
                </div>
              </div>

              {/* Total */}
              <div className="rounded-xl bg-card border border-border p-4">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Order Total
                </p>
                <p className="text-3xl font-extrabold font-mono tabular-nums text-foreground mt-1">
                  {formatCurrency(computedTotal)}
                </p>
              </div>

              {/* Line items */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  Line Items
                </p>
                <div className="rounded-xl border border-border overflow-hidden">
                  <LineItemsTable items={lineItems} />
                </div>
              </div>

              {/* Summary */}
              {order.summary && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                    Summary
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {order.summary}
                  </p>
                </div>
              )}
            </div>
          )}

          {!loading && isNew && !order && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                {selectedVendorName
                  ? `Tell CarabinerOS what you need from ${selectedVendorName}.`
                  : "Pick a vendor above, then describe what you need."}
              </p>
            </div>
          )}
        </div>

        {/* Action buttons — always visible */}
        <div className="shrink-0 border-t border-border px-4 py-3 flex items-center gap-2">
          <Button
            size="default"
            onClick={handleSubmit}
            disabled={actionLoading || (!!order && !canSubmit)}
            className="gap-1.5 flex-1"
          >
            <Send className="size-4" />
            Send
          </Button>
          <Button
            variant="secondary"
            size="default"
            onClick={handleDraft}
            disabled={actionLoading || (!!order && !canDraft)}
            className="gap-1.5 flex-1"
          >
            <Save className="size-4" />
            Draft
          </Button>
          <Button
            variant="ghost"
            size="default"
            onClick={handleCancel}
            className="gap-1.5"
          >
            <X className="size-4" />
            Cancel
          </Button>
        </div>

        {/* Chat composer — pinned to bottom */}
        <ModuleChat
          moduleId="orders"
          buildContext={() =>
            `[module=orders, order_id=${order?.id ?? "new"}]`
          }
          placeholder="Add 2 cases of avocados..."
          chips={["Add items", "Change quantities", "Check prices"]}
          onMessageSent={() => setRefetchKey(k => k + 1)}
        />
      </SheetContent>
    </Sheet>
  );
}
