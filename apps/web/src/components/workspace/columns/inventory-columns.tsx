"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import type { InventoryItem } from "@/lib/api";

export type InventoryAction = {
  type: "edit-count";
  item: InventoryItem;
};

export function getInventoryColumns(
  onAction?: (action: InventoryAction) => void
): ColumnDef<InventoryItem>[] {
  return [
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
        const num = parseFloat(v.replace(/[^-\d.]/g, ""));
        const isNeg = num < 0;
        const isCritical = isNeg && Math.abs(num) >= 20;
        return (
          <span
            className={
              isCritical
                ? "text-destructive font-bold animate-pulse"
                : isNeg
                  ? "text-destructive font-medium"
                  : "text-emerald-600 font-medium"
            }
          >
            {v}
          </span>
        );
      },
    },
    {
      accessorKey: "summary",
      header: "Summary",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs line-clamp-1">
          {row.getValue("summary")}
        </span>
      ),
    },
    ...(onAction
      ? [
          {
            id: "actions",
            header: "Actions",
            enableSorting: false,
            cell: ({ row }: { row: { original: InventoryItem } }) => (
              <div
                className="flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Edit count"
                  onClick={() =>
                    onAction({ type: "edit-count", item: row.original })
                  }
                >
                  <Pencil className="size-3.5" />
                </Button>
              </div>
            ),
          } as ColumnDef<InventoryItem>,
        ]
      : []),
  ];
}

// Backward compat
export const inventoryColumns = getInventoryColumns();
