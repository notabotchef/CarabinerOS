"use client";

import { useWorkspace } from "@/hooks/use-workspace";
import { WorkspaceTable } from "@/components/workspace-table";

const COLUMNS = [
  { key: "item_name" as const, label: "Item" },
  { key: "on_hand" as const, label: "On Hand" },
  { key: "par" as const, label: "Par" },
  { key: "unit" as const, label: "Unit" },
  { key: "vendor" as const, label: "Vendor" },
  { key: "last_counted" as const, label: "Last Counted" },
];

export default function InventoryPage() {
  const { data, loading, error } = useWorkspace("/api/inventory");

  return (
    <div className="flex flex-col h-dvh">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-lg font-bold text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground">Stock levels, par values, and counting</p>
        </div>
      </header>
      <div className="flex-1 overflow-auto p-6">
        {error && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground mb-4">
            No data available — API endpoint not connected yet
          </div>
        )}
        <WorkspaceTable columns={COLUMNS} data={data} loading={loading} emptyMessage="No inventory items yet" />
      </div>
    </div>
  );
}
