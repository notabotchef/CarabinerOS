"use client";

import { useLocations } from "@/hooks/use-api";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceKPICards } from "@/components/workspace/workspace-kpi-cards";
import { WorkspaceTable } from "@/components/workspace/workspace-table";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { Location } from "@/lib/api";

function statusVariant(s: string) {
  switch (s) {
    case "Stable":
      return "default" as const;
    case "Attention":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

const locationColumns: ColumnDef<Location>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("name")}</span>
    ),
  },
  { accessorKey: "city", header: "City" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={statusVariant(row.getValue("status"))}>
        {row.getValue("status")}
      </Badge>
    ),
  },
  { accessorKey: "sales_delta", header: "Sales Delta" },
  { accessorKey: "labor_delta", header: "Labor Delta" },
];

export default function LocationsPage() {
  const { data, isLoading } = useLocations();
  const items = data ?? [];
  const kpis = [
    { label: "Total locations", value: items.length },
    { label: "Stable", value: items.filter((l) => l.status === "Stable").length },
    { label: "Attention", value: items.filter((l) => l.status === "Attention").length },
  ];

  return (
    <>
      <WorkspaceHeader title="Locations" subtitle="Multi-location overview" />
      <div className="p-6 space-y-6">
        <WorkspaceKPICards cards={kpis} />
        <WorkspaceTable columns={locationColumns} data={items} isLoading={isLoading} />
      </div>
    </>
  );
}
