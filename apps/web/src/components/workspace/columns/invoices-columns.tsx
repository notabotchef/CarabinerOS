"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { Invoice } from "@/lib/api";

function statusVariant(s: string) {
  const lower = s.toLowerCase();
  if (lower === "approved" || lower === "paid") return "default" as const;
  if (lower === "matched") return "secondary" as const;
  if (lower === "disputed") return "destructive" as const;
  if (lower === "processing") return "outline" as const;
  return "outline" as const;
}

export const invoicesColumns: ColumnDef<Invoice>[] = [
  {
    accessorKey: "vendor",
    header: "Vendor",
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("vendor")}</span>
    ),
  },
  {
    accessorKey: "invoice_number",
    header: "Invoice #",
    cell: ({ row }) => (
      <span className="text-muted-foreground font-mono text-xs">
        {row.getValue("invoice_number") ?? "---"}
      </span>
    ),
  },
  { accessorKey: "invoice_date", header: "Date" },
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
  {
    accessorKey: "po_match_id",
    header: "PO Match",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">
        {row.getValue("po_match_id") ?? "No match"}
      </span>
    ),
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
