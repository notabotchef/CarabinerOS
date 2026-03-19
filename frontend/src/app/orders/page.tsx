"use client";

import { useWorkspace } from "@/hooks/use-workspace";
import { WorkspaceTable } from "@/components/workspace-table";

const COLUMNS = [
  { key: "vendor" as const, label: "Vendor" },
  { key: "status" as const, label: "Status" },
  { key: "total" as const, label: "Total", render: (v: unknown) => v != null ? `$${Number(v).toFixed(2)}` : "—" },
  { key: "items_count" as const, label: "Items" },
  { key: "delivery_date" as const, label: "Delivery" },
  { key: "created_at" as const, label: "Created" },
];

export default function OrdersPage() {
  const { data, loading, error } = useWorkspace("/api/orders");

  return (
    <div className="flex flex-col h-dvh">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-lg font-bold text-foreground">Orders</h1>
          <p className="text-sm text-muted-foreground">Purchase orders and vendor management</p>
        </div>
      </header>
      <div className="flex-1 overflow-auto p-6">
        {error && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground mb-4">
            No data available — API endpoint not connected yet
          </div>
        )}
        <WorkspaceTable columns={COLUMNS} data={data} loading={loading} emptyMessage="No orders yet" />
      </div>
    </div>
  );
}
