"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { Recipe } from "@/lib/api";

function statusVariant(s: string) {
  switch (s.toLowerCase()) {
    case "active":
      return "default" as const;
    case "draft":
      return "secondary" as const;
    case "archived":
      return "outline" as const;
    default:
      return "outline" as const;
  }
}

function statusColor(s: string) {
  switch (s.toLowerCase()) {
    case "active":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
    case "draft":
      return "bg-amber-500/15 text-amber-400 border-amber-500/25";
    case "archived":
      return "bg-zinc-500/15 text-zinc-400 border-zinc-500/25";
    default:
      return "";
  }
}

export function getRecipeColumns(): ColumnDef<Recipe>[] {
  return [
    {
      accessorKey: "name",
      header: "Recipe",
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("name")}</span>
      ),
    },
    { accessorKey: "category", header: "Category" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge
            variant={statusVariant(status)}
            className={statusColor(status)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "total_cost",
      header: "Cost",
      cell: ({ row }) => {
        const cost = row.getValue("total_cost") as number | null;
        return cost != null ? (
          <span className="tabular-nums">${cost.toFixed(2)}</span>
        ) : (
          <span className="text-muted-foreground">--</span>
        );
      },
    },
    {
      accessorKey: "cost_per_serving",
      header: "Per Serving",
      cell: ({ row }) => {
        const cost = row.getValue("cost_per_serving") as number | null;
        return cost != null ? (
          <span className="tabular-nums">${cost.toFixed(2)}</span>
        ) : (
          <span className="text-muted-foreground">--</span>
        );
      },
    },
    {
      accessorKey: "yield_quantity",
      header: "Yield",
      cell: ({ row }) => {
        const qty = row.original.yield_quantity;
        const unit = row.original.yield_unit;
        return qty ? (
          <span className="tabular-nums">
            {qty} {unit}
          </span>
        ) : (
          <span className="text-muted-foreground">--</span>
        );
      },
    },
  ];
}

export const recipeColumns = getRecipeColumns();
