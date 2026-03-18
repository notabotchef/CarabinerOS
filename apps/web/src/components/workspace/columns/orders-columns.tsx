"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { Order } from "@/lib/api";

function statusVariant(s: string) {
  if (s.toLowerCase().includes("ready")) return "default" as const;
  if (s.toLowerCase().includes("draft")) return "secondary" as const;
  return "outline" as const;
}

export const ordersColumns: ColumnDef<Order>[] = [
  {
    accessorKey: "vendor",
    header: "Vendor",
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("vendor")}</span>
    ),
  },
  { accessorKey: "channel", header: "Channel" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={statusVariant(row.getValue("status"))}>
        {row.getValue("status")}
      </Badge>
    ),
  },
  { accessorKey: "total", header: "Total" },
  { accessorKey: "eta", header: "ETA" },
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
