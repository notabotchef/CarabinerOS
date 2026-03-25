/*
 * ORDERS WORKSPACE — CarabinerOS
 *
 * Design direction: EDITORIAL / MAGAZINE
 *
 * Purpose: Restaurant managers need a single view to track purchase orders
 *   across vendors — what's drafting, submitted, confirmed, delivered.
 * Audience: Busy operators who want glanceable status, not spreadsheet noise.
 * Tone: Clean editorial — generous whitespace, bold type hierarchy, subtle
 *   motion. Feels like a well-designed newspaper finance section, not CRUD.
 * Differentiation: Conversational empty state invites AI interaction.
 *   Status pipeline is a visual KPI strip, not just filter tabs.
 *   Rows animate in with staggered spring physics.
 */

"use client";

import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, ShoppingCart, ChevronRight } from "lucide-react";
import { MenuButton } from "@/components/menu-button";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { OrderDetailPanel } from "./components/order-detail-panel";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type OrderStatus = "Drafting" | "Ready to send" | "Awaiting approval" | "Submitted" | "Confirmed" | "Delivered";

interface Order {
  [key: string]: unknown;
  id: string;
  vendor: string;
  channel: string;
  status: OrderStatus;
  total: string;
  eta: string | null;
  line_items: unknown;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

const STATUSES = ["All", "Drafting", "Ready to send", "Awaiting approval", "Submitted", "Confirmed", "Delivered"] as const;
type StatusFilter = (typeof STATUSES)[number];

const PIPELINE_STAGES: { key: OrderStatus; label: string }[] = [
  { key: "Drafting", label: "Drafting" },
  { key: "Ready to send", label: "Ready" },
  { key: "Awaiting approval", label: "Pending" },
  { key: "Submitted", label: "Submitted" },
  { key: "Confirmed", label: "Confirmed" },
  { key: "Delivered", label: "Delivered" },
];

/* ------------------------------------------------------------------ */
/*  Status styles                                                      */
/* ------------------------------------------------------------------ */

const STATUS_STYLES: Record<OrderStatus, string> = {
  Drafting: "bg-muted text-muted-foreground",
  "Ready to send": "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  "Awaiting approval": "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Submitted: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Confirmed: "bg-green-500/15 text-green-700 dark:text-green-400",
  Delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 opacity-70",
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
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ------------------------------------------------------------------ */
/*  Animations                                                         */
/* ------------------------------------------------------------------ */

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { ...spring, delay: i * 0.04 },
  }),
};

/* ------------------------------------------------------------------ */
/*  Pipeline strip                                                     */
/* ------------------------------------------------------------------ */

function PipelineStrip({ counts, loading }: { counts: Record<OrderStatus, number>; loading: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {PIPELINE_STAGES.map((stage, i) => (
        <div key={stage.key} className="flex items-center gap-2 flex-1">
          <div className="flex-1 rounded-lg border border-border bg-card p-3">
            {loading ? (
              <>
                <Skeleton className="h-3 w-14 mb-1.5" />
                <Skeleton className="h-7 w-8" />
              </>
            ) : (
              <>
                <p className="text-xs font-medium text-muted-foreground">{stage.label}</p>
                <p className="text-2xl font-extrabold tabular-nums text-foreground">
                  {counts[stage.key]}
                </p>
              </>
            )}
          </div>
          {i < PIPELINE_STAGES.length - 1 && (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/40" />
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status badge                                                       */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function OrdersPage() {
  const { data, loading, error } = useWorkspace<Order>("/api/orders");
  const [filter, setFilter] = useState<StatusFilter>("All");
  const [search, setSearch] = useState("");

  // Detail panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isNewOrder, setIsNewOrder] = useState(false);

  const handleRowClick = useCallback((orderId: string) => {
    setSelectedOrderId(orderId);
    setIsNewOrder(false);
    setPanelOpen(true);
  }, []);

  const handleNewOrder = useCallback(() => {
    setSelectedOrderId(null);
    setIsNewOrder(true);
    setPanelOpen(true);
  }, []);

  const counts = useMemo(() => {
    const c: Record<OrderStatus, number> = { Drafting: 0, "Ready to send": 0, "Awaiting approval": 0, Submitted: 0, Confirmed: 0, Delivered: 0 };
    for (const o of data) if (o.status in c) c[o.status as OrderStatus]++;
    return c;
  }, [data]);

  const filtered = useMemo(() => {
    let list = filter === "All" ? data : data.filter((o) => o.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((o) => o.vendor?.toLowerCase().includes(q) || o.channel?.toLowerCase().includes(q));
    }
    return list;
  }, [data, filter, search]);

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0 bg-card">
        <MenuButton />
        <div className="flex-1 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">Orders</h1>
          <p className="text-sm text-muted-foreground">Purchase orders across all vendors</p>
        </div>
        <Button size="default" className="gap-1.5" onClick={handleNewOrder}>
          <Plus className="size-4" />
          New Order
        </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 flex flex-col gap-6">
        {/* Pipeline KPI strip */}
        <PipelineStrip counts={counts} loading={loading} />

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
            {STATUSES.map((s) => {
              const active = filter === s;
              const count = s === "All" ? data.length : (counts[s as OrderStatus] ?? 0);
              return (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`relative px-3 py-2 text-sm font-semibold transition-colors ${
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                  {data.length > 0 && (
                    <span className="ml-1.5 text-xs tabular-nums font-normal text-muted-foreground">
                      {count}
                    </span>
                  )}
                  {active && (
                    <motion.span
                      layoutId="orders-tab-underline"
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
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Unable to reach the orders API — data will appear once the backend is connected.
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
                <TableHead className="font-semibold">Channel</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-right">Total</TableHead>
                <TableHead className="font-semibold">ETA</TableHead>
                <TableHead className="font-semibold">Created</TableHead>
              </TableRow>
            </TableHeader>
            <AnimatePresence mode="popLayout">
              <TableBody>
                {filtered.map((order, i) => (
                  <motion.tr
                    key={order.id}
                    custom={i}
                    variants={rowVariants}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0, y: -4 }}
                    className="border-b border-border transition-colors hover:bg-accent/50 cursor-pointer"
                    onClick={() => handleRowClick(order.id)}
                  >
                    <TableCell className="font-semibold text-foreground">{order.vendor}</TableCell>
                    <TableCell className="text-muted-foreground">{order.channel}</TableCell>
                    <TableCell><StatusBadge status={order.status} /></TableCell>
                    <TableCell className="text-right tabular-nums font-extrabold text-foreground">
                      {formatCurrency(order.total)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{order.eta ?? "\u2014"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(order.created_at)}</TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </AnimatePresence>
          </Table>
        )}

        {/* Empty state — filtered */}
        {!loading && !error && data.length > 0 && filtered.length === 0 && (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            No {filter.toLowerCase()} orders match your search.
          </div>
        )}

        {/* Empty state — no data at all */}
        {!loading && !error && data.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="flex items-center justify-center size-14 rounded-2xl bg-secondary shadow-sm">
              <ShoppingCart className="size-7 text-muted-foreground" />
            </div>
            <div>
              <p className="text-base font-extrabold text-foreground mb-1">
                Your order book is empty
              </p>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                Tell CarabinerOS what you need &mdash; &ldquo;Draft a produce order for
                Chef&rsquo;s Warehouse&rdquo; &mdash; and it will build the PO for you.
              </p>
            </div>
            <Button variant="secondary" size="sm" className="mt-2 gap-1.5" onClick={handleNewOrder}>
              <Plus className="size-3.5" />
              Create your first order
            </Button>
          </div>
        )}
      </div>

      {/* Order detail slide-over panel */}
      <OrderDetailPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        orderId={selectedOrderId}
        isNew={isNewOrder}
        onChatSend={async (text) => {
          try {
            const { getCsrfToken } = await import("@/lib/csrf");
            const csrf = await getCsrfToken();
            const res = await fetch("/message_async", {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
              credentials: "include",
              body: JSON.stringify({ text, context: "" }),
            });
            if (!res.ok) console.error("Order chat failed:", res.status);
          } catch (e) {
            console.error("Failed to send order chat:", e);
          }
        }}
      />
    </div>
  );
}
