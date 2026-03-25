/*
 * INVOICES WORKSPACE -- CarabinerOS
 *
 * Design direction: PROCESSING CENTER
 *
 * Purpose: AP automation -- invoices flow through a visible pipeline from
 *   upload to approval. OCR extraction, PO matching, and approval all
 *   tracked in one view. P1 competitive gap closer (MarginEdge, xtraCHEF).
 * Audience: GM or bookkeeper processing vendor invoices daily. Speed matters.
 * Tone: Processing center -- efficient, clear, every invoice accounted for.
 *   Pipeline stages use a color gradient that intensifies as invoices advance.
 * Differentiation: Visual pipeline bar shows flow + counts per stage.
 *   Source icons distinguish upload/email/scan. Staggered row animations.
 */

"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  ChevronRight,
  Plus,
  Search,
} from "lucide-react";

import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceDetailPanel } from "./components/invoice-detail-panel";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type InvoiceStatus =
  | "Uploaded"
  | "Processing"
  | "Extracted"
  | "Matched"
  | "Approved"
  | "Paid"
  | "Rejected";

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
  { key: "Uploaded", label: "Uploaded" },
  { key: "Processing", label: "Processing" },
  { key: "Matched", label: "Matched" },
  { key: "Approved", label: "Approved" },
  { key: "Paid", label: "Paid" },
];

const FILTER_TABS: { key: InvoiceStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "Uploaded", label: "Uploaded" },
  { key: "Processing", label: "Processing" },
  { key: "Matched", label: "Matched" },
  { key: "Approved", label: "Approved" },
  { key: "Paid", label: "Paid" },
  { key: "Rejected", label: "Rejected" },
];

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  Uploaded: "bg-muted text-muted-foreground",
  Processing: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Extracted: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  Matched: "bg-green-500/10 text-green-700 dark:text-green-400",
  Approved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Rejected: "bg-red-500/10 text-red-700 dark:text-red-400",
};

const STAGE_ACCENT: Record<string, string> = {
  Uploaded: "border-muted-foreground/20",
  Processing: "border-amber-500/20",
  Matched: "border-green-500/20",
  Approved: "border-emerald-500/20",
  Paid: "border-emerald-500/20",
};



/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(v: unknown): string {
  if (v == null || v === "") return "\u2014";
  const s = String(v).replace(/[$,]/g, "").trim();
  const n = Number(s);
  if (isNaN(n)) return String(v);
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
/*  Motion                                                             */
/* ------------------------------------------------------------------ */

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

const stageVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { ...spring, delay: i * 0.06 },
  }),
};

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { ...spring, delay: i * 0.04 },
  }),
};

/* ------------------------------------------------------------------ */
/*  Status Badge                                                       */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.Uploaded;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${style}`}
    >
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Pipeline Status Bar                                                */
/* ------------------------------------------------------------------ */

function PipelineBar({
  counts,
  loading,
}: {
  counts: Record<InvoiceStatus, number>;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {PIPELINE_STAGES.map((stage, i) => {
        const count = counts[stage.key] ?? 0;
        const isLast = i === PIPELINE_STAGES.length - 1;
        const accent = STAGE_ACCENT[stage.key] ?? "border-border";
        return (
          <div key={stage.key} className="flex items-center gap-2 flex-1">
            <motion.div
              custom={i}
              variants={stageVariants}
              initial="hidden"
              animate="visible"
              className={`flex-1 rounded-lg border bg-card p-3 ${accent}`}
            >
              {loading ? (
                <>
                  <Skeleton className="h-3 w-14 mb-1.5" />
                  <Skeleton className="h-7 w-8" />
                </>
              ) : (
                <>
                  <p className="text-xs font-medium text-muted-foreground">
                    {stage.label}
                  </p>
                  <p className="text-2xl font-extrabold tabular-nums text-foreground font-mono">
                    {count}
                  </p>
                </>
              )}
            </motion.div>
            {!isLast && (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/40" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function InvoicesPage() {
  const { data, loading, error, refresh } = useWorkspace<Invoice>("/api/invoices");
  const [activeFilter, setActiveFilter] = useState<InvoiceStatus | "all">(
    "all",
  );
  const [search, setSearch] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Compute pipeline counts */
  const counts = useMemo(() => {
    const c: Record<InvoiceStatus, number> = {
      Uploaded: 0,
      Processing: 0,
      Extracted: 0,
      Matched: 0,
      Approved: 0,
      Paid: 0,
      Rejected: 0,
    };
    for (const inv of data) {
      if (inv.status in c) c[inv.status]++;
    }
    return c;
  }, [data]);

  /* Filter + search */
  const filtered = useMemo(() => {
    let list =
      activeFilter === "all"
        ? data
        : data.filter((inv) => inv.status === activeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (inv) =>
          inv.vendor_name?.toLowerCase().includes(q) ||
          inv.invoice_number?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, activeFilter, search]);

  /* Upload handler */
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/invoices/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (res.ok) {
        const json = await res.json();
        refresh();
        if (json.ok && json.data?.id) {
          setSelectedInvoiceId(json.data.id);
        }
      }
    } catch {
      // Upload failed silently
    }

    // Reset file input
    e.target.value = "";
  }, [refresh]);

  /* Close detail panel and refresh list */
  const handleCloseDetail = useCallback(() => {
    setSelectedInvoiceId(null);
    refresh();
  }, [refresh]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,.heic"
        onChange={handleFileSelected}
      />

      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0 bg-card">
        <div className="flex-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-8 rounded-lg bg-secondary">
            <FileText className="size-4 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">
              Invoices
            </h1>
            <p className="text-sm text-muted-foreground">
              AP automation and invoice processing
            </p>
          </div>
        </div>
        <Button size="default" className="gap-1.5" onClick={handleUploadClick}>
          <Plus className="size-4" />
          Upload Invoice
        </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 flex flex-col gap-6">
        {/* Pipeline Status Bar */}
        <PipelineBar counts={counts} loading={loading} />

        {/* Toolbar: search + filter tabs */}
        <div className="flex items-center gap-4">
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search vendors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 border-b border-border flex-1">
            {FILTER_TABS.map((tab) => {
              const isActive = activeFilter === tab.key;
              const count =
                tab.key === "all"
                  ? data.length
                  : (counts[tab.key as InvoiceStatus] ?? 0);
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`relative px-3 py-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  {data.length > 0 && (
                    <span className="ml-1.5 text-xs tabular-nums font-normal text-muted-foreground font-mono">
                      {count}
                    </span>
                  )}
                  {isActive && (
                    <motion.span
                      layoutId="invoices-tab-underline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full"
                      transition={spring}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Unable to reach the invoices API -- data will appear once the backend
            is connected.
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        )}

        {/* Data table */}
        {!loading && filtered.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold">Vendor</TableHead>
                <TableHead className="font-semibold">Invoice #</TableHead>
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold text-right">
                  Total
                </TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <AnimatePresence mode="popLayout">
              <TableBody>
                {filtered.map((inv, i) => (
                  <motion.tr
                    key={inv.id}
                    custom={i}
                    variants={rowVariants}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0, y: -4 }}
                    onClick={() => setSelectedInvoiceId(inv.id)}
                    className="border-b border-border transition-colors hover:bg-accent/50 cursor-pointer"
                  >
                    <TableCell className="font-semibold text-foreground">
                      {inv.vendor_name ?? "\u2014"}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm tabular-nums">
                      {inv.invoice_number ?? "\u2014"}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono">
                      {formatDate(inv.invoice_date)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-extrabold text-foreground font-mono">
                      {formatCurrency(inv.total)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono">
                      {formatDate(inv.due_date)}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </AnimatePresence>
          </Table>
        )}

        {/* Empty state -- filtered */}
        {!loading && !error && data.length > 0 && filtered.length === 0 && (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            No invoices match your search or filter.
          </div>
        )}

        {/* Empty state -- no data at all */}
        {!loading && !error && data.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="flex items-center justify-center size-14 rounded-2xl bg-secondary shadow-sm">
              <FileText className="size-7 text-muted-foreground" />
            </div>
            <div>
              <p className="text-base font-extrabold text-foreground mb-1">
                No invoices yet
              </p>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                Upload a PDF, forward a vendor email, or scan a paper
                invoice to start processing.
              </p>
            </div>
            <Button variant="secondary" size="sm" className="mt-2 gap-1.5" onClick={handleUploadClick}>
              <Plus className="size-3.5" />
              Upload your first invoice
            </Button>
          </div>
        )}
      </div>

      {/* Invoice Detail Slide-Over */}
      <InvoiceDetailPanel
        invoiceId={selectedInvoiceId}
        onClose={handleCloseDetail}
      />
    </div>
  );
}
