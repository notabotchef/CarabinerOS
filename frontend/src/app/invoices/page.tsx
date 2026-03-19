"use client";

import { useMemo, useState } from "react";
import {
  FileText,
  Upload,
  Mail,
  ScanLine,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type InvoiceStatus =
  | "uploaded"
  | "processing"
  | "extracted"
  | "matched"
  | "approved"
  | "rejected";

interface Invoice {
  [key: string]: unknown;
  id: string;
  location_id: string;
  vendor_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  status: InvoiceStatus;
  file_path: string | null;
  source: string | null;
  subtotal: string | null;
  tax: string | null;
  total: string | null;
  line_items: unknown;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PIPELINE_STAGES: { key: InvoiceStatus; label: string }[] = [
  { key: "uploaded", label: "Uploaded" },
  { key: "processing", label: "Processing" },
  { key: "extracted", label: "Extracted" },
  { key: "matched", label: "Matched" },
  { key: "approved", label: "Approved" },
];

const FILTER_TABS: { key: InvoiceStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "uploaded", label: "Uploaded" },
  { key: "processing", label: "Processing" },
  { key: "extracted", label: "Extracted" },
  { key: "matched", label: "Matched" },
  { key: "approved", label: "Approved" },
];

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  uploaded:
    "bg-muted text-muted-foreground",
  processing:
    "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  extracted:
    "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  matched:
    "bg-green-500/15 text-green-700 dark:text-green-400",
  approved:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  rejected:
    "bg-red-500/15 text-red-700 dark:text-red-400",
};

const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  upload: Upload,
  email: Mail,
  scan: ScanLine,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(v: unknown): string {
  if (v == null || v === "") return "\u2014";
  const n = Number(v);
  if (isNaN(n)) return "\u2014";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(v: unknown): string {
  if (!v || typeof v !== "string") return "\u2014";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Status Badge                                                       */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.uploaded;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${style}`}
    >
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Source Icon                                                        */
/* ------------------------------------------------------------------ */

function SourceIcon({ source }: { source: string | null }) {
  const Icon = source ? SOURCE_ICONS[source] ?? FileText : FileText;
  const label = source ?? "unknown";
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      <span className="text-xs capitalize">{label}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Pipeline Status Bar                                                */
/* ------------------------------------------------------------------ */

function PipelineSkeleton() {
  return (
    <div className="flex items-center gap-2">
      {PIPELINE_STAGES.map((s) => (
        <div key={s.key} className="flex items-center gap-2 flex-1">
          <Skeleton className="h-14 w-full rounded-lg" />
          {s.key !== "approved" && (
            <ChevronRight className="h-4 w-4 shrink-0 text-border" />
          )}
        </div>
      ))}
    </div>
  );
}

function PipelineBar({
  counts,
}: {
  counts: Record<InvoiceStatus, number>;
}) {
  return (
    <div className="flex items-center gap-2">
      {PIPELINE_STAGES.map((stage, i) => {
        const count = counts[stage.key] ?? 0;
        const isLast = i === PIPELINE_STAGES.length - 1;
        return (
          <div key={stage.key} className="flex items-center gap-2 flex-1">
            <div className="flex-1 rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">{stage.label}</p>
              <p className="text-xl font-semibold tabular-nums text-foreground">
                {count}
              </p>
            </div>
            {!isLast && (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                   */
/* ------------------------------------------------------------------ */

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function InvoicesPage() {
  const { data, loading, error } = useWorkspace<Invoice>("/api/invoices");
  const [activeFilter, setActiveFilter] = useState<InvoiceStatus | "all">("all");

  /* Compute pipeline counts */
  const counts = useMemo(() => {
    const c: Record<InvoiceStatus, number> = {
      uploaded: 0,
      processing: 0,
      extracted: 0,
      matched: 0,
      approved: 0,
      rejected: 0,
    };
    for (const inv of data) {
      if (inv.status in c) {
        c[inv.status]++;
      }
    }
    return c;
  }, [data]);

  /* Filter */
  const filtered = useMemo(() => {
    if (activeFilter === "all") return data;
    return data.filter((inv) => inv.status === activeFilter);
  }, [data, activeFilter]);

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Invoices</h1>
            <p className="text-sm text-muted-foreground">
              AP automation and invoice processing
            </p>
          </div>
        </div>
        <Button variant="default" size="default">
          <Plus className="h-4 w-4" />
          Upload Invoice
        </Button>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Pipeline Status Bar */}
        {loading ? <PipelineSkeleton /> : <PipelineBar counts={counts} />}

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.key;
            const count =
              tab.key === "all"
                ? data.length
                : counts[tab.key as InvoiceStatus] ?? 0;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`
                  relative px-3 py-2 text-sm font-medium transition-colors
                  ${
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }
                `}
              >
                {tab.label}
                {count > 0 && (
                  <span className="ml-1.5 tabular-nums text-xs text-muted-foreground">
                    {count}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Error banner */}
        {error && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            No data available — API endpoint not connected yet
          </div>
        )}

        {/* Data Table */}
        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              No invoices
            </p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Upload a PDF or forward vendor emails to start.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium text-foreground">
                    {inv.vendor_name ?? "\u2014"}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {inv.invoice_number ?? "\u2014"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(inv.invoice_date)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium text-foreground">
                    {formatCurrency(inv.total)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={inv.status} />
                  </TableCell>
                  <TableCell>
                    <SourceIcon source={inv.source} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(inv.due_date)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
