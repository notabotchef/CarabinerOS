"use client";

import { useMemo, useState } from "react";
import { Plus, ShoppingCart } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { WorkspaceTable } from "@/components/workspace-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Order = {
  id: string;
  vendor: string;
  channel: string;
  status: string;
  total: string;
  eta: string | null;
  line_items: unknown;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

const STATUSES = ["All", "Drafting", "Submitted", "Confirmed", "Delivered"] as const;
type StatusFilter = (typeof STATUSES)[number];

const STATUS_VARIANT: Record<string, "secondary" | "default" | "outline"> = {
  Drafting: "secondary",
  Submitted: "default",
  Confirmed: "outline",
  Delivered: "secondary",
};

const STATUS_CLASS: Record<string, string> = {
  Confirmed: "border-green-600/40 bg-green-600/15 text-green-400",
  Delivered: "opacity-60",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "secondary"} className={STATUS_CLASS[status] ?? ""}>
      {status}
    </Badge>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

const COLUMNS = [
  { key: "vendor" as const, label: "Vendor" },
  { key: "channel" as const, label: "Channel" },
  { key: "status" as const, label: "Status", render: (v: unknown) => <StatusBadge status={String(v)} /> },
  { key: "total" as const, label: "Total", render: (v: unknown) => (v != null && v !== "" ? `$${Number(v).toFixed(2)}` : "—") },
  { key: "eta" as const, label: "ETA", render: (v: unknown) => (v ? String(v) : "—") },
  { key: "created_at" as const, label: "Created", render: (v: unknown) => formatDate(String(v)) },
];

export default function OrdersPage() {
  const { data, loading, error } = useWorkspace<Order>("/api/orders");
  const [filter, setFilter] = useState<StatusFilter>("All");

  const filtered = useMemo(
    () => (filter === "All" ? data : data.filter((o) => o.status === filter)),
    [data, filter],
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of data) map[o.status] = (map[o.status] ?? 0) + 1;
    return map;
  }, [data]);

  return (
    <div className="flex flex-col h-dvh">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-lg font-bold text-foreground">Orders</h1>
          <p className="text-sm text-muted-foreground">Purchase orders and vendor management</p>
        </div>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          New Order
        </Button>
      </header>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-6 pt-4 pb-2 shrink-0">
        {STATUSES.map((s) => {
          const active = filter === s;
          const count = s === "All" ? data.length : (counts[s] ?? 0);
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {s}
              {data.length > 0 && (
                <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {error && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground mb-4">
            Unable to reach the orders API — data will appear once the backend is connected.
          </div>
        )}
        <WorkspaceTable
          columns={COLUMNS}
          data={filtered}
          loading={loading}
          emptyMessage={
            filter !== "All" && data.length > 0
              ? `No ${filter.toLowerCase()} orders`
              : undefined
          }
        />
        {!loading && !error && data.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="flex items-center justify-center size-12 rounded-xl bg-secondary">
              <ShoppingCart className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No orders yet</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Ask CarabinerOS to draft one, or click New Order to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
