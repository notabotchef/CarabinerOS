"use client";

import { ChefHat } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { WorkspaceTable } from "@/components/workspace-table";

interface PrepItem {
  [key: string]: unknown;
  item_name: string;
  station: string;
  quantity: number;
  unit: string;
  status: string;
  assigned_to: string;
}

const columns = [
  { key: "item_name" as const, label: "Item" },
  { key: "station" as const, label: "Station" },
  {
    key: "quantity" as const,
    label: "Qty",
    render: (value: unknown) => String(value ?? ""),
  },
  { key: "unit" as const, label: "Unit" },
  {
    key: "status" as const,
    label: "Status",
    render: (value: unknown) => {
      const s = String(value ?? "");
      const color =
        s.toLowerCase() === "done"
          ? "text-emerald-600 dark:text-emerald-400"
          : s.toLowerCase() === "in progress"
            ? "text-amber-600 dark:text-amber-400"
            : "text-muted-foreground";
      return <span className={color}>{s}</span>;
    },
  },
  { key: "assigned_to" as const, label: "Assigned To" },
];

export default function PrepPage() {
  const { data, loading } = useWorkspace<PrepItem>("/api/prep");

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <ChefHat className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Prep</h1>
          <p className="text-sm text-muted-foreground">Daily prep lists</p>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <WorkspaceTable
          columns={columns}
          data={data}
          loading={loading}
          emptyMessage="No prep items yet"
        />
      </div>
    </div>
  );
}
