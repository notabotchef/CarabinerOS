"use client";

import { useMemo } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { WorkspaceTable } from "@/components/workspace-table";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Trash2, DollarSign, TrendingUp } from "lucide-react";

interface WasteRow {
  [key: string]: unknown;
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  reason: string;
  notes: string | null;
  waste_date: string;
  estimated_cost: number | null;
}

function formatDate(v: unknown): string {
  if (!v || typeof v !== "string") return "\u2014";
  const d = new Date(v + "T00:00:00");
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatCurrency(v: unknown): string {
  if (v == null) return "\u2014";
  const n = Number(v);
  if (isNaN(n) || n === 0) return "\u2014";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const REASON_STYLES: Record<string, string> = {
  spoilage: "bg-red-500/10 text-red-600 dark:text-red-400",
  overproduction: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  expired: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

const COLUMNS = [
  {
    key: "waste_date" as const,
    label: "Date",
    render: (v: unknown) => (
      <span className="font-mono text-[13px]">{formatDate(v)}</span>
    ),
  },
  {
    key: "item_name" as const,
    label: "Item",
    render: (v: unknown) => (
      <span className="font-medium text-foreground">{String(v)}</span>
    ),
  },
  {
    key: "quantity" as const,
    label: "Qty",
    render: (v: unknown, row: WasteRow) => (
      <span className="font-mono text-[13px]">
        {String(v)} {row.unit}
      </span>
    ),
  },
  {
    key: "reason" as const,
    label: "Reason",
    render: (v: unknown) => {
      const reason = String(v);
      return (
        <Badge
          variant="secondary"
          className={`text-xs capitalize ${REASON_STYLES[reason] ?? "bg-muted"}`}
        >
          {reason}
        </Badge>
      );
    },
  },
  {
    key: "estimated_cost" as const,
    label: "Cost",
    render: (v: unknown) => (
      <span className="font-mono text-[13px] text-destructive">
        {formatCurrency(v)}
      </span>
    ),
  },
  {
    key: "notes" as const,
    label: "Notes",
    render: (v: unknown) => (
      <span className="text-muted-foreground text-xs truncate max-w-[200px] block">
        {v ? String(v) : "\u2014"}
      </span>
    ),
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: [0, 0, 0.58, 1] as [number, number, number, number] },
  }),
};

function WasteKpiCard({
  label,
  value,
  icon: Icon,
  index,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  index: number;
}) {
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="rounded-xl border border-border bg-card p-4 flex items-center gap-4"
    >
      <div className="rounded-lg p-2.5 bg-destructive/10">
        <Icon className="h-5 w-5 text-destructive" />
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-3xl font-bold font-mono leading-tight text-foreground">
          {value}
        </span>
      </div>
    </motion.div>
  );
}

export function WasteLogTable() {
  const { data, loading } = useWorkspace<WasteRow>("/api/inventory/waste");

  const totalWasteCost = useMemo(() => {
    return data.reduce((sum, w) => sum + (w.estimated_cost ?? 0), 0);
  }, [data]);

  const topWasteItem = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const w of data) {
      counts[w.item_name] = (counts[w.item_name] ?? 0) + w.quantity;
    }
    let top = "\u2014";
    let topQty = 0;
    for (const [name, qty] of Object.entries(counts)) {
      if (qty > topQty) {
        topQty = qty;
        top = name;
      }
    }
    return top;
  }, [data]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      {!loading && data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <WasteKpiCard
            label="Total Entries"
            value={String(data.length)}
            icon={Trash2}
            index={0}
          />
          <WasteKpiCard
            label="Total Waste $"
            value={totalWasteCost > 0 ? `$${totalWasteCost.toFixed(2)}` : "\u2014"}
            icon={DollarSign}
            index={1}
          />
          <WasteKpiCard
            label="Top Waste Item"
            value={topWasteItem}
            icon={TrendingUp}
            index={2}
          />
        </div>
      )}

      <WorkspaceTable
        columns={COLUMNS}
        data={data}
        loading={loading}
        emptyMessage="No waste logged yet. Use the chat to log waste."
      />
    </div>
  );
}
