"use client";

import { type ColumnDef } from "@tanstack/react-table";
import type { FoodCostItem } from "@/lib/api";

export const foodCostColumns: ColumnDef<FoodCostItem>[] = [
  {
    accessorKey: "menu_item_name",
    header: "Menu Item",
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("menu_item_name")}</span>
    ),
  },
  {
    accessorKey: "pressure",
    header: "Pressure",
    cell: ({ row }) => (
      <span className="text-destructive font-medium">
        {row.getValue("pressure")}
      </span>
    ),
  },
  { accessorKey: "current_cost_pct", header: "Cost %" },
  { accessorKey: "action", header: "Action" },
  {
    accessorKey: "summary",
    header: "Summary",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs line-clamp-1">
        {row.getValue("summary")}
      </span>
    ),
  },
];
