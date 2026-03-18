"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { Campaign } from "@/lib/api";

function stageVariant(s: string) {
  switch (s.toLowerCase()) {
    case "ready for review":
      return "default" as const;
    case "drafting":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

export const marketingColumns: ColumnDef<Campaign>[] = [
  {
    accessorKey: "campaign_name",
    header: "Campaign",
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("campaign_name")}</span>
    ),
  },
  { accessorKey: "channel", header: "Channel" },
  {
    accessorKey: "stage",
    header: "Stage",
    cell: ({ row }) => (
      <Badge variant={stageVariant(row.getValue("stage"))}>
        {row.getValue("stage")}
      </Badge>
    ),
  },
  { accessorKey: "deliverable", header: "Deliverable" },
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
