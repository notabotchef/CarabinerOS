"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { InboxItem } from "@/lib/api";

function priorityVariant(p: string) {
  return p.toLowerCase() === "high"
    ? ("destructive" as const)
    : ("secondary" as const);
}

export const inboxColumns: ColumnDef<InboxItem>[] = [
  { accessorKey: "title", header: "Title" },
  {
    accessorKey: "priority",
    header: "Priority",
    cell: ({ row }) => (
      <Badge variant={priorityVariant(row.getValue("priority"))}>
        {row.getValue("priority")}
      </Badge>
    ),
  },
  { accessorKey: "owner", header: "Owner" },
  { accessorKey: "status", header: "Status" },
  {
    accessorKey: "module",
    header: "Module",
    cell: ({ row }) => (
      <Badge variant="outline">{row.getValue("module")}</Badge>
    ),
  },
];
