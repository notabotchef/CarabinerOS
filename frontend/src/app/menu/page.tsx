"use client";

import { UtensilsCrossed } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { WorkspaceTable } from "@/components/workspace-table";

interface MenuItem {
  name: string;
  category: string;
  price: number;
  food_cost: number;
  margin: number;
  status: string;
}

const columns = [
  { key: "name" as const, label: "Name" },
  { key: "category" as const, label: "Category" },
  {
    key: "price" as const,
    label: "Price",
    render: (v: unknown) => `$${Number(v).toFixed(2)}`,
  },
  {
    key: "food_cost" as const,
    label: "Food Cost",
    render: (v: unknown) => `$${Number(v).toFixed(2)}`,
  },
  {
    key: "margin" as const,
    label: "Margin",
    render: (v: unknown) => `${Number(v).toFixed(1)}%`,
  },
  {
    key: "status" as const,
    label: "Status",
    render: (v: unknown) => {
      const s = String(v);
      const color =
        s === "active"
          ? "text-green-600 dark:text-green-400"
          : "text-muted-foreground";
      return <span className={color}>{s}</span>;
    },
  },
];

export default function MenuPage() {
  const { data, loading, error } = useWorkspace<MenuItem>("/api/menu");

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-6 py-4">
        <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold text-foreground">Menu</h1>
        <span className="ml-auto text-sm text-muted-foreground">
          {!loading && !error && `${data.length} items`}
        </span>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {error ? (
          <div className="flex items-center justify-center py-16 text-sm text-destructive">
            Failed to load menu data
          </div>
        ) : (
          <WorkspaceTable
            columns={columns}
            data={data}
            loading={loading}
            emptyMessage="No menu items yet"
          />
        )}
      </div>
    </div>
  );
}
