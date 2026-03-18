"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Pencil } from "lucide-react";
import type { MenuItem } from "@/lib/api";

function perfVariant(p: string) {
  switch (p.toLowerCase()) {
    case "star":
      return "default" as const;
    case "puzzle":
      return "secondary" as const;
    case "plowhorse":
      return "outline" as const;
    default:
      return "destructive" as const;
  }
}

export type MenuAction = {
  type: "edit-performance" | "adjust-price";
  item: MenuItem;
};

export function getMenuColumns(
  onAction?: (action: MenuAction) => void
): ColumnDef<MenuItem>[] {
  return [
    {
      accessorKey: "item_name",
      header: "Item",
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("item_name")}</span>
      ),
    },
    { accessorKey: "category", header: "Category" },
    {
      accessorKey: "performance",
      header: "Performance",
      cell: ({ row }) => (
        <Badge variant={perfVariant(row.getValue("performance"))}>
          {row.getValue("performance")}
        </Badge>
      ),
    },
    { accessorKey: "margin_pct", header: "Margin" },
    { accessorKey: "recommendation", header: "Recommendation" },
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
            cell: ({ row }: { row: { original: MenuItem } }) => (
              <div
                className="flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Edit performance badge"
                  onClick={() =>
                    onAction({ type: "edit-performance", item: row.original })
                  }
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Adjust price"
                  onClick={() =>
                    onAction({ type: "adjust-price", item: row.original })
                  }
                >
                  <DollarSign className="size-3.5" />
                </Button>
              </div>
            ),
          } as ColumnDef<MenuItem>,
        ]
      : []),
  ];
}

// Backward compat
export const menuColumns = getMenuColumns();
