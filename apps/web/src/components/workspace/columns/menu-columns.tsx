"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
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

export const menuColumns: ColumnDef<MenuItem>[] = [
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
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs line-clamp-1">
        {row.getValue("summary")}
      </span>
    ),
  },
];
