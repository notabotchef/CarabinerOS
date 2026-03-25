"use client";

import { useState } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CountDetailPanel } from "./count-detail-panel";

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

export function CountHistory() {
  const { data, loading } = useWorkspace<CountRow>("/api/inventory/counts");
  const [selectedCountId, setSelectedCountId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        No inventory counts yet. Use the chat to start one.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Counted By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => {
            const isComplete = row.status === "completed";
            return (
              <TableRow
                key={row.id}
                className="hover:bg-muted/10 cursor-pointer transition-colors"
                onClick={() => setSelectedCountId(row.id)}
              >
                <TableCell>
                  <span className="font-mono text-[13px]">{formatDate(row.count_date)}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm capitalize">{String(row.count_type).replace("_", " ")}</span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={isComplete ? "secondary" : "default"}
                    className={`text-xs ${isComplete ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}
                  >
                    {row.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-[13px]">{String(row.line_count)}</span>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-[13px]">{formatCurrency(row.total_value)}</span>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground text-sm">{row.counted_by ?? "\u2014"}</span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <CountDetailPanel
        open={selectedCountId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedCountId(null);
        }}
        countId={selectedCountId}
      />
    </div>
  );
}
