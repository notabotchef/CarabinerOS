"use client";

import { type ColumnDef } from "@tanstack/react-table";
import type { InventoryItem } from "@/lib/api";

export const inventoryColumns: ColumnDef<InventoryItem>[] = [
  {
    accessorKey: "item_name",
    header: "Item",
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("item_name")}</span>
    ),
  },
  { accessorKey: "on_hand", header: "On Hand" },
  { accessorKey: "par", header: "Par" },
  {
    accessorKey: "variance",
    header: "Variance",
    cell: ({ row }) => {
      const v = row.getValue("variance") as string;
      const isNeg = v.startsWith("-");
      return (
        <span className={isNeg ? "text-destructive font-medium" : "text-emerald-600 font-medium"}>
          {v}
        </span>
      );
    },
  },
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
