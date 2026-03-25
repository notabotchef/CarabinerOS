"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  FileText,
  ImageIcon,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUp,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  Invoice,
  InvoiceEvent,
  InvoiceLineItem,
  InvoiceStatus,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                   */
/* ------------------------------------------------------------------ */

interface InvoiceDetailPanelProps {
  invoiceId: string | null;
  onClose: () => void;
}

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  Uploaded: "bg-muted text-muted-foreground",
  Processing: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Extracted: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  Matched: "bg-green-500/10 text-green-700 dark:text-green-400",
  Approved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Rejected: "bg-red-500/10 text-red-700 dark:text-red-400",
};

const PIPELINE_ORDER: InvoiceStatus[] = [
  "Uploaded",
  "Processing",
  "Extracted",
  "Matched",
  "Approved",
  "Paid",
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatCurrency(v: unknown): string {
  if (v == null || v === "") return "\u2014";
  const s = String(v).replace(/[$,]/g, "").trim();
  const n = Number(s);
  if (isNaN(n)) return String(v);
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

function formatTime(v: unknown): string {
  if (!v || typeof v !== "string") return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function eventIcon(type: string) {
  switch (type) {
    case "uploaded":
      return <FileText className="size-3.5 text-muted-foreground" />;
    case "approved":
      return <CheckCircle2 className="size-3.5 text-emerald-500" />;
    case "paid":
      return <CheckCircle2 className="size-3.5 text-emerald-500" />;
    case "extracted":
      return <Clock className="size-3.5 text-blue-500" />;
    default:
      return <Clock className="size-3.5 text-muted-foreground" />;
  }
}

function isImageMime(mime: string | null): boolean {
  if (!mime) return false;
  return mime.startsWith("image/");
}

/* ------------------------------------------------------------------ */
/*  Pipeline Position Indicator                                         */
/* ------------------------------------------------------------------ */

function PipelinePosition({ status }: { status: InvoiceStatus }) {
  const idx = PIPELINE_ORDER.indexOf(status);
  return (
    <div className="flex items-center gap-1">
      {PIPELINE_ORDER.map((stage, i) => {
        const isActive = i <= idx;
        const isCurrent = stage === status;
        return (
          <div key={stage} className="flex items-center gap-1">
            <div
              className={`h-1.5 rounded-full transition-colors ${
                i === 0 ? "w-6" : "w-6"
              } ${
                isActive
                  ? isCurrent
                    ? "bg-primary"
                    : "bg-primary/40"
                  : "bg-muted"
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                      */
/* ------------------------------------------------------------------ */

export function InvoiceDetailPanel({
  invoiceId,
  onClose,
}: InvoiceDetailPanelProps) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchInvoice = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      if (json.ok && json.data) {
        setInvoice(json.data);
      } else {
        setError(json.error || "Failed to load invoice");
      }
    } catch {
      setError("We're having trouble loading this invoice \u2014 try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (invoiceId) {
      fetchInvoice(invoiceId);
    } else {
      setInvoice(null);
    }
  }, [invoiceId, fetchInvoice]);

  const handleApprove = useCallback(async () => {
    if (!invoice) return;
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ approved_by: "user" }),
      });
      if (res.ok) {
        fetchInvoice(invoice.id);
      }
    } catch {
      // silently fail
    }
  }, [invoice, fetchInvoice]);

  const handleMarkPaid = useCallback(async () => {
    if (!invoice) return;
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ actor: "user" }),
      });
      if (res.ok) {
        fetchInvoice(invoice.id);
      }
    } catch {
      // silently fail
    }
  }, [invoice, fetchInvoice]);

  const handleChatSend = useCallback(() => {
    if (!chatInput.trim()) return;
    // For Phase 1: the chat input is a placeholder; future integration with A0 chat
    setChatInput("");
  }, [chatInput]);

  if (!invoiceId) return null;

  const lineItems: InvoiceLineItem[] = Array.isArray(invoice?.line_items)
    ? invoice.line_items
    : [];
  const events: InvoiceEvent[] = Array.isArray(invoice?.events)
    ? invoice.events
    : [];

  return (
    <AnimatePresence>
      {invoiceId && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/10 supports-backdrop-filter:backdrop-blur-xs"
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl flex-col border-l border-border bg-background shadow-[0_8px_32px_oklch(0_0_0_/_0.25)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-8 rounded-lg bg-secondary">
                  <FileText className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-foreground">
                    {invoice?.vendor_name || "Invoice Details"}
                  </h2>
                  <p className="text-xs text-muted-foreground font-mono">
                    {invoice?.invoice_number || "No number"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {invoice && (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      STATUS_STYLES[invoice.status] || STATUS_STYLES.Uploaded
                    }`}
                  >
                    {invoice.status}
                  </span>
                )}
                <Button variant="ghost" size="icon-sm" onClick={onClose}>
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* Loading */}
            {loading && (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="flex-1 flex items-center justify-center p-4">
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            )}

            {/* Content */}
            {invoice && !loading && !error && (
              <div className="flex-1 flex overflow-hidden">
                {/* Left: File Preview */}
                <div className="w-1/2 border-r border-border flex flex-col bg-card/50">
                  <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
                    {invoice.file_path && isImageMime(invoice.file_mime) ? (
                      <img
                        src={invoice.file_path}
                        alt="Invoice preview"
                        className="max-w-full max-h-full object-contain rounded-xl"
                      />
                    ) : invoice.file_path ? (
                      <div className="flex flex-col items-center gap-3 text-center">
                        <div className="flex items-center justify-center size-16 rounded-xl bg-secondary">
                          <FileText className="size-8 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          PDF Document
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Preview not available. Open in a new tab to view.
                        </p>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => window.open(invoice.file_path!, "_blank")}
                        >
                          Open File
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-center">
                        <div className="flex items-center justify-center size-16 rounded-xl bg-secondary">
                          <ImageIcon className="size-8 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          No file attached
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Details + Line Items + Chat */}
                <div className="w-1/2 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-auto p-4 space-y-6">
                    {/* Pipeline position */}
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                        Pipeline
                      </p>
                      <PipelinePosition status={invoice.status} />
                    </div>

                    {/* Extracted fields */}
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Vendor" value={invoice.vendor_name} />
                      <Field
                        label="Invoice #"
                        value={invoice.invoice_number}
                        mono
                      />
                      <Field
                        label="Date"
                        value={formatDate(invoice.invoice_date)}
                      />
                      <Field
                        label="Due Date"
                        value={formatDate(invoice.due_date)}
                      />
                      <Field
                        label="Subtotal"
                        value={formatCurrency(invoice.subtotal)}
                        mono
                      />
                      <Field
                        label="Tax"
                        value={formatCurrency(invoice.tax)}
                        mono
                      />
                      <Field
                        label="Total"
                        value={formatCurrency(invoice.total)}
                        mono
                        bold
                      />
                      {invoice.ocr_confidence != null && (
                        <Field
                          label="OCR Confidence"
                          value={`${invoice.ocr_confidence}%`}
                          mono
                        />
                      )}
                    </div>

                    {/* Line Items */}
                    {lineItems.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                          Line Items
                        </p>
                        <div className="rounded-xl border border-border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs font-semibold">
                                  Item
                                </TableHead>
                                <TableHead className="text-xs font-semibold text-right">
                                  Qty
                                </TableHead>
                                <TableHead className="text-xs font-semibold text-right">
                                  Price
                                </TableHead>
                                <TableHead className="text-xs font-semibold text-right">
                                  Total
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {lineItems.map((li, i) => {
                                const hasVariance =
                                  li.flagged ||
                                  (li.price_variance_pct != null &&
                                    Math.abs(li.price_variance_pct) > 5);
                                return (
                                  <TableRow key={i}>
                                    <TableCell className="text-xs">
                                      <span className="flex items-center gap-1.5">
                                        {li.description}
                                        {hasVariance && (
                                          <AlertTriangle className="size-3 text-red-500 shrink-0" />
                                        )}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-xs text-right font-mono tabular-nums">
                                      {li.quantity}
                                    </TableCell>
                                    <TableCell
                                      className={`text-xs text-right font-mono tabular-nums ${
                                        hasVariance
                                          ? "text-red-500 font-semibold"
                                          : ""
                                      }`}
                                    >
                                      {formatCurrency(li.unit_price)}
                                      {li.price_variance_pct != null &&
                                        Math.abs(li.price_variance_pct) > 0 && (
                                          <span
                                            className={`ml-1 text-[10px] ${
                                              li.price_variance_pct > 0
                                                ? "text-red-500"
                                                : "text-emerald-500"
                                            }`}
                                          >
                                            {li.price_variance_pct > 0
                                              ? "+"
                                              : ""}
                                            {li.price_variance_pct.toFixed(1)}%
                                          </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-xs text-right font-mono tabular-nums font-semibold">
                                      {formatCurrency(li.total)}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* Activity Timeline */}
                    {events.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                          Activity
                        </p>
                        <div className="space-y-2">
                          {events.map((evt) => (
                            <div
                              key={evt.id}
                              className="flex items-start gap-2"
                            >
                              <div className="mt-0.5">{eventIcon(evt.event_type)}</div>
                              <div className="flex-1">
                                <p className="text-xs text-foreground capitalize">
                                  {evt.event_type}
                                  {evt.actor && (
                                    <span className="text-muted-foreground">
                                      {" "}
                                      by {evt.actor}
                                    </span>
                                  )}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  {formatDate(evt.created_at)}{" "}
                                  {formatTime(evt.created_at)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {invoice.status !== "Approved" &&
                        invoice.status !== "Paid" && (
                          <Button size="sm" onClick={handleApprove}>
                            Approve
                          </Button>
                        )}
                      {invoice.status === "Approved" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={handleMarkPaid}
                        >
                          Mark Paid
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Chat at bottom */}
                  <div className="border-t border-border px-4 py-3 shrink-0">
                    <div className="relative">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleChatSend();
                          }
                        }}
                        placeholder="Approve it, dispute a price, ask a question..."
                        className="w-full rounded-xl border border-border bg-card/80 px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none transition-all duration-200 focus:border-primary/50 focus:ring-2 focus:ring-primary/25"
                      />
                      <button
                        onClick={handleChatSend}
                        disabled={!chatInput.trim()}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 size-7 rounded-xl flex items-center justify-center bg-primary text-primary-foreground disabled:opacity-20 transition-opacity"
                      >
                        <ArrowUp className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  Field component                                                     */
/* ------------------------------------------------------------------ */

function Field({
  label,
  value,
  mono = false,
  bold = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  bold?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">
        {label}
      </p>
      <p
        className={`text-sm text-foreground ${mono ? "font-mono tabular-nums" : ""} ${bold ? "font-extrabold" : ""}`}
      >
        {value || "\u2014"}
      </p>
    </div>
  );
}
