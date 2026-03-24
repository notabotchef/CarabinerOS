"use client";

import { useWorkspace } from "@/hooks/use-workspace";
import { WorkspaceTable } from "@/components/workspace-table";
import { Badge } from "@/components/ui/badge";

interface CountRow {
  [key: string]: unknown;
  id: string;
  count_date: string;
  count_type: string;
  status: string;
  counted_by: string | null;
  line_count: number;
  total_value: number | null;
}

function formatDate(v: unknown): string {
  if (!v || typeof v !== "string") return "\u2014";
  const d = new Date(v + "T00:00:00");
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(v: unknown): string {
  if (v == null) return "\u2014";
  const n = Number(v);
  if (isNaN(n)) return "\u2014";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const COLUMNS = [
  {
    key: "count_date" as const,
    label: "Date",
    render: (v: unknown) => (
      <span className="font-mono text-[13px]">{formatDate(v)}</span>
    ),
  },
  {
    key: "count_type" as const,
    label: "Type",
    render: (v: unknown) => (
      <span className="text-sm capitalize">{String(v).replace("_", " ")}</span>
    ),
  },
  {
    key: "status" as const,
    label: "Status",
    render: (v: unknown) => {
      const s = String(v);
      const isComplete = s === "completed";
      return (
        <Badge
          variant={isComplete ? "secondary" : "default"}
          className={`text-xs ${isComplete ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}
        >
          {s.replace("_", " ")}
        </Badge>
      );
    },
  },
  {
    key: "line_count" as const,
    label: "Items",
    render: (v: unknown) => (
      <span className="font-mono text-[13px]">{String(v)}</span>
    ),
  },
  {
    key: "total_value" as const,
    label: "Value",
    render: (v: unknown) => (
      <span className="font-mono text-[13px]">{formatCurrency(v)}</span>
    ),
  },
  {
    key: "counted_by" as const,
    label: "Counted By",
    render: (v: unknown) => (
      <span className="text-muted-foreground text-sm">{v ? String(v) : "\u2014"}</span>
    ),
  },
];

export function CountHistory() {
  const { data, loading } = useWorkspace<CountRow>("/api/inventory/counts");

  return (
    <div className="space-y-4">
      <WorkspaceTable
        columns={COLUMNS}
        data={data}
        loading={loading}
        emptyMessage="No inventory counts yet. Use the chat to start one."
      />
    </div>
  );
}
