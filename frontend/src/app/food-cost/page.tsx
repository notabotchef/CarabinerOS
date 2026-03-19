"use client";

import { DollarSign } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { WorkspaceTable } from "@/components/workspace-table";

type FoodCostItem = {
  [key: string]: unknown;
  item_name: string;
  plate_cost: number;
  food_cost_pct: number;
  target_pct: number;
  variance: number;
  category: string;
};

function formatDollars(value: unknown): string {
  const n = Number(value);
  if (isNaN(n)) return "$0.00";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatPct(value: unknown): string {
  const n = Number(value);
  if (isNaN(n)) return "0%";
  return `${n.toFixed(1)}%`;
}

const columns = [
  { key: "item_name" as const, label: "Item" },
  {
    key: "plate_cost" as const,
    label: "Plate Cost",
    render: (value: unknown) => formatDollars(value),
  },
  {
    key: "food_cost_pct" as const,
    label: "Food Cost %",
    render: (value: unknown) => formatPct(value),
  },
  {
    key: "target_pct" as const,
    label: "Target %",
    render: (value: unknown) => formatPct(value),
  },
  {
    key: "variance" as const,
    label: "Variance",
    render: (value: unknown) => {
      const n = Number(value);
      if (isNaN(n)) return "0";
      const color =
        n > 0
          ? "text-red-600 dark:text-red-400"
          : n < 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-muted-foreground";
      const prefix = n > 0 ? "+" : "";
      return <span className={color}>{prefix}{n.toFixed(1)}</span>;
    },
  },
  { key: "category" as const, label: "Category" },
];

export default function FoodCostPage() {
  const { data, loading } = useWorkspace<FoodCostItem>("/api/food-cost");

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <DollarSign className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Food Cost</h1>
          <p className="text-sm text-muted-foreground">
            Cost tracking &amp; variance analysis
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <WorkspaceTable
          columns={columns}
          data={data}
          loading={loading}
          emptyMessage="No food cost data yet"
        />
      </div>
    </div>
  );
}
