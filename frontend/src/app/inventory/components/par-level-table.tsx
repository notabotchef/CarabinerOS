"use client";

import { useWorkspace } from "@/hooks/use-workspace";
import { WorkspaceTable } from "@/components/workspace-table";
import { Badge } from "@/components/ui/badge";

interface ParLevelRow {
  [key: string]: unknown;
  id: string;
  item_name: string;
  min_quantity: number;
  on_hand: string | null;
  shortfall: number | null;
  day_of_week: number | null;
}

const COLUMNS = [
  {
    key: "item_name" as const,
    label: "Item",
    render: (v: unknown) => (
      <span className="font-medium text-foreground">{String(v)}</span>
    ),
  },
  {
    key: "on_hand" as const,
    label: "On Hand",
    render: (v: unknown) => (
      <span className="font-mono text-[13px]">{v ? parseFloat(Number(v).toFixed(1)) : "\u2014"}</span>
    ),
  },
  {
    key: "min_quantity" as const,
    label: "Par Level",
    render: (v: unknown) => (
      <span className="font-mono text-[13px] text-muted-foreground">{parseFloat(Number(v).toFixed(1))}</span>
    ),
  },
  {
    key: "shortfall" as const,
    label: "Shortfall",
    render: (v: unknown) => {
      const n = Math.round(Number(v) * 10) / 10;
      if (isNaN(n) || n >= 0) {
        return (
          <span className="font-mono text-[13px] text-emerald-600 dark:text-emerald-400">
            {n > 0 ? `+${n}` : "0"}
          </span>
        );
      }
      return (
        <Badge
          variant="destructive"
          className="font-mono text-xs px-2"
        >
          {n}
        </Badge>
      );
    },
  },
  {
    key: "day_of_week" as const,
    label: "Day",
    render: (v: unknown) => {
      if (v == null) return <span className="text-muted-foreground text-xs">All days</span>;
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      return <span className="text-sm">{days[Number(v)] ?? "\u2014"}</span>;
    },
  },
];

export function ParLevelTable() {
  const { data, loading } = useWorkspace<ParLevelRow>("/api/inventory/par-levels");

  return (
    <div className="space-y-4">
      <WorkspaceTable
        columns={COLUMNS}
        data={data}
        loading={loading}
        emptyMessage="No par levels set. Use the chat to set them."
      />
    </div>
  );
}
