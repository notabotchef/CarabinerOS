/*
 * PREP WORKSPACE -- CarabinerOS
 *
 * Design direction: KITCHEN TICKET / CHECKLIST
 *
 * Purpose: Sous chef arriving at 6am sees everything that needs prepping,
 *   grouped by station, with checkboxes to mark items done while walking
 *   the line. Chat at the bottom for generating lists, assigning cooks,
 *   and adjusting quantities.
 * Audience: Line cooks and sous chefs who need glanceable status and one-tap
 *   completion. Checkboxes are THE physical interaction. Everything else
 *   goes through chat.
 * Tone: Dense but scannable. Kama West Loop prep list format -- station
 *   groups, par levels, status tracking.
 */

"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  AlertTriangle,
  Check,
  ChefHat,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Clock,
} from "lucide-react";

import { motion, AnimatePresence, type Variants } from "motion/react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Legacy workspace prep item (from /api/prep) */
interface WorkspacePrepItem {
  [key: string]: unknown;
  id: string;
  location_id: string;
  service_lane: string;
  task: string;
  station: string;
  readiness: string;
  shortage: string | null;
  summary: string | null;
  detail_points: string[] | null;
  created_at: string;
  updated_at: string;
}

/** Operational prep item (from /api/prep/today) */
interface PrepItem {
  id: string;
  prep_list_id: string;
  recipe_id: string;
  name: string | null;
  qty_needed: number;
  unit: string;
  on_hand: number;
  to_prep: number;
  is_complete: boolean;
  completed_qty: number | null;
  completed_at: string | null;
  station: string | null;
  assigned_to: string | null;
  est_minutes: number | null;
  sort_order: number;
  service_lane: string | null;
  notes: string | null;
}

interface PrepListData {
  id: string;
  location_id: string;
  prep_date: string;
  status: string;
  expected_covers: number | null;
  generated_by: string;
  approved_by: string | null;
  approved_at: string | null;
  items: PrepItem[];
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TIP_INDEX = Math.floor(Date.now() / 86400000) % 3;

const SERVICE_LANES = ["All", "Lunch", "Dinner", "All Day"] as const;
type ServiceLane = (typeof SERVICE_LANES)[number];

const READINESS_CONFIG: Record<
  string,
  { label: string; dot: string; bg: string; text: string; ring: string }
> = {
  Ready: {
    label: "Ready",
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    ring: "#10b981",
  },
  "In Progress": {
    label: "In Progress",
    dot: "bg-amber-500",
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    ring: "#f59e0b",
  },
  "At risk": {
    label: "At Risk",
    dot: "bg-orange-500",
    bg: "bg-orange-500/10",
    text: "text-orange-700 dark:text-orange-400",
    ring: "#f97316",
  },
  "Not Started": {
    label: "Not Started",
    dot: "bg-muted-foreground/40",
    bg: "bg-muted",
    text: "text-muted-foreground",
    ring: "#71717a",
  },
  Blocked: {
    label: "Blocked",
    dot: "bg-destructive",
    bg: "bg-destructive/10",
    text: "text-destructive",
    ring: "#ef4444",
  },
};

/* ------------------------------------------------------------------ */
/*  Framer Motion variants                                             */
/* ------------------------------------------------------------------ */

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0, 0, 0.58, 1] as [number, number, number, number] } },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function todayFormatted(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function groupByStation<T extends { station?: string | null }>(
  items: T[],
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const station = item.station || "Unassigned";
    if (!groups[station]) groups[station] = [];
    groups[station].push(item);
  }
  const sorted: Record<string, T[]> = {};
  for (const key of Object.keys(groups).sort()) sorted[key] = groups[key];
  return sorted;
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

/* ------------------------------------------------------------------ */
/*  Sub-components: Shared                                             */
/* ------------------------------------------------------------------ */

function ReadinessRing({ items }: { items: WorkspacePrepItem[] }) {
  const total = items.length;
  if (total === 0) return null;

  const ready = items.filter((i) => i.readiness === "Ready").length;
  const inProgress = items.filter((i) => i.readiness === "In Progress").length;
  const atRisk = items.filter((i) => i.readiness === "At risk").length;
  const blocked = items.filter((i) => i.readiness === "Blocked").length;
  const notStarted = total - ready - inProgress - atRisk - blocked;
  const pct = Math.round((ready / total) * 100);

  const r = 28;
  const circ = 2 * Math.PI * r;
  const segments = [
    { count: ready, color: READINESS_CONFIG.Ready.ring },
    { count: inProgress, color: READINESS_CONFIG["In Progress"].ring },
    { count: atRisk, color: READINESS_CONFIG["At risk"].ring },
    { count: blocked, color: READINESS_CONFIG.Blocked.ring },
    { count: notStarted, color: READINESS_CONFIG["Not Started"].ring },
  ].filter((s) => s.count > 0);

  let offset = 0;
  const arcs = segments.map((seg) => {
    const len = (seg.count / total) * circ;
    const arc = { ...seg, dashoffset: -offset, dasharray: `${len} ${circ - len}` };
    offset += len;
    return arc;
  });

  return (
    <motion.div
      className="flex items-center gap-4"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="relative size-16 shrink-0">
        <svg viewBox="0 0 64 64" className="size-full -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/30" />
          {arcs.map((arc, i) => (
            <motion.circle
              key={i}
              cx="32"
              cy="32"
              r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={arc.dasharray}
              strokeDashoffset={arc.dashoffset}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
            />
          ))}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground tabular-nums font-mono">
          {pct}%
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground tabular-nums font-mono">
          {ready}/{total} ready
        </span>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {inProgress > 0 && <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-amber-500" />{inProgress} active</span>}
          {blocked > 0 && <span className="flex items-center gap-1 text-destructive"><span className="size-1.5 rounded-full bg-destructive" />{blocked} blocked</span>}
        </div>
      </div>
    </motion.div>
  );
}

/** Completion progress ring for operational data */
function CompletionRing({ completed, total }: { completed: number; total: number }) {
  if (total === 0) return null;
  const pct = Math.round((completed / total) * 100);
  const r = 28;
  const circ = 2 * Math.PI * r;
  const completedLen = (completed / total) * circ;
  const remainingLen = circ - completedLen;

  return (
    <motion.div
      className="flex items-center gap-4"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="relative size-16 shrink-0">
        <svg viewBox="0 0 64 64" className="size-full -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/30" />
          {completed > 0 && (
            <motion.circle
              cx="32" cy="32" r={r} fill="none"
              stroke="#10b981" strokeWidth="5" strokeLinecap="round"
              strokeDasharray={`${completedLen} ${remainingLen}`}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1, opacity: pct === 100 ? [1, 0.5, 1] : 1 }}
              transition={{ duration: 0.6 }}
            />
          )}
        </svg>
        <span className={cn(
          "absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums font-mono",
          pct === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
        )}>
          {pct === 100 ? "All set" : `${pct}%`}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground font-mono tabular-nums">
          {completed}/{total} done
        </span>
        {total - completed > 0 && (
          <span className="text-xs text-muted-foreground">
            {total - completed} remaining
          </span>
        )}
      </div>
    </motion.div>
  );
}

function ReadinessBadge({ readiness }: { readiness: string }) {
  const config = READINESS_CONFIG[readiness] ?? READINESS_CONFIG["Not Started"];
  return (
    <motion.span
      layout
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        config.bg,
        config.text,
      )}
    >
      <span className={cn("size-1.5 rounded-full", config.dot)} />
      {config.label}
    </motion.span>
  );
}

function ShortageIndicator({ shortage }: { shortage: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
      <AlertTriangle className="size-3.5 shrink-0" />
      <span className="truncate max-w-[180px]">{shortage}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components: Operational Prep (Phase 2)                         */
/* ------------------------------------------------------------------ */

function PrepCheckbox({
  checked,
  onToggle,
  loading,
}: {
  checked: boolean;
  onToggle: () => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={loading}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200",
        checked
          ? "border-emerald-500 bg-emerald-500 text-white"
          : "border-border hover:border-primary/50 bg-transparent",
        loading && "opacity-50",
      )}
    >
      {checked && <Check className="size-3.5" strokeWidth={3} />}
    </button>
  );
}

function OperationalStationGroup({
  station,
  items,
  onToggleItem,
  loadingItems,
}: {
  station: string;
  items: PrepItem[];
  onToggleItem: (itemId: string) => void;
  loadingItems: Set<string>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const completedCount = items.filter((i) => i.is_complete).length;
  const totalCount = items.length;
  const allDone = completedCount === totalCount;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Separate incomplete from complete: incomplete first, completed at bottom
  const incomplete = items.filter((i) => !i.is_complete).sort((a, b) => a.sort_order - b.sort_order);
  const completed = items.filter((i) => i.is_complete).sort((a, b) => a.sort_order - b.sort_order);
  const ordered = [...incomplete, ...completed];

  return (
    <motion.div variants={fadeSlideUp} className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Station header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "flex items-center w-full gap-3 px-4 py-3 border-b border-border transition-colors",
          allDone ? "bg-emerald-500/5" : "bg-muted/40",
        )}
      >
        {collapsed ? (
          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        )}
        <h3 className="text-sm font-bold text-foreground tracking-tight flex-1 text-left">{station}</h3>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              className={cn("h-full rounded-full", allDone ? "bg-emerald-500" : "bg-primary")}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          <span className={cn(
            "text-xs font-medium tabular-nums font-mono",
            allDone ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
          )}>
            {completedCount}/{totalCount}
          </span>
        </div>
      </button>

      {/* Task rows */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="divide-y divide-border overflow-hidden"
          >
            {ordered.map((item) => (
              <motion.div
                key={item.id}
                layout
                className={cn(
                  "flex items-center gap-3 px-4 py-3 transition-colors",
                  item.is_complete
                    ? "bg-muted/20"
                    : "hover:bg-muted/30",
                )}
              >
                {/* Checkbox */}
                <PrepCheckbox
                  checked={item.is_complete}
                  onToggle={() => onToggleItem(item.id)}
                  loading={loadingItems.has(item.id)}
                />

                {/* Item content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn(
                      "text-sm font-medium truncate",
                      item.is_complete
                        ? "text-muted-foreground line-through"
                        : "text-foreground",
                    )}>
                      {item.name || `Recipe ${item.recipe_id.slice(0, 8)}`}
                    </p>
                    {item.recipe_id && (
                      <Link
                        href={`/recipes?id=${item.recipe_id}`}
                        className="text-muted-foreground/40 hover:text-primary transition-colors shrink-0"
                        title="View recipe"
                      >
                        <ExternalLink className="size-3" />
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {/* Quantity display */}
                    <span className={cn(
                      "text-xs font-mono tabular-nums",
                      item.is_complete ? "text-muted-foreground/60" : "text-foreground",
                    )}>
                      Prep {item.to_prep} {item.unit}
                    </span>
                    {item.on_hand > 0 && (
                      <span className="text-xs text-muted-foreground font-mono tabular-nums">
                        (on hand: {item.on_hand} {item.unit})
                      </span>
                    )}
                    {item.est_minutes && !item.is_complete && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Clock className="size-2.5" />
                        ~{item.est_minutes}m
                      </span>
                    )}
                    {item.assigned_to && (
                      <span className="text-[10px] text-muted-foreground/60">
                        {item.assigned_to}
                      </span>
                    )}
                  </div>
                </div>

                {/* Completion timestamp */}
                {item.is_complete && item.completed_at && (
                  <span className="text-[10px] text-muted-foreground/60 font-mono tabular-nums shrink-0">
                    {timeAgo(item.completed_at)}
                  </span>
                )}

                {/* Service lane badge */}
                {item.service_lane && item.service_lane !== "All Day" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground shrink-0">
                    {item.service_lane}
                  </span>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components: Legacy Workspace (fallback)                        */
/* ------------------------------------------------------------------ */

function LegacyStationGroup({ station, items }: { station: string; items: WorkspacePrepItem[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const readyCount = items.filter((i) => i.readiness === "Ready").length;
  const allReady = readyCount === items.length;

  return (
    <motion.div variants={fadeSlideUp} className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "flex items-center w-full gap-3 px-4 py-3 border-b border-border transition-colors",
          allReady ? "bg-emerald-500/5" : "bg-muted/40",
        )}
      >
        {collapsed ? (
          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        )}
        <h3 className="text-sm font-bold text-foreground tracking-tight flex-1 text-left">{station}</h3>
        <span className={cn(
          "text-xs font-medium tabular-nums font-mono",
          allReady ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
        )}>
          {readyCount}/{items.length}
        </span>
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="divide-y divide-border overflow-hidden"
          >
            {items.map((item) => (
              <motion.div
                key={item.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                whileHover={{ x: 2 }}
                transition={{ duration: 0.15 }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.task}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {item.service_lane}
                    {item.summary && <> &middot; {item.summary}</>}
                  </p>
                </div>
                {item.shortage && <ShortageIndicator shortage={item.shortage} />}
                <ReadinessBadge readiness={item.readiness} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading / Empty                                                    */
/* ------------------------------------------------------------------ */

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-3 w-16 rounded-md" />
        </div>
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-md" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border overflow-hidden">
          <Skeleton className="h-11 w-full" />
          {Array.from({ length: 3 }).map((_, j) => (
            <div key={j} className="flex items-center gap-3 px-4 py-3 border-t border-border">
              <Skeleton className="size-6 rounded-md" />
              <Skeleton className="h-4 flex-1 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-24 text-center"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="rounded-xl bg-muted p-4 mb-4">
        <ClipboardList className="size-8 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">Your prep board is clean</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Tell CarabinerOS what you&apos;re prepping today &mdash; try &quot;Generate prep for tonight, 140 covers.&quot;
      </p>
      <p className="text-[11px] text-muted-foreground/60 italic mt-3">
        {[
          "Tip: Prep proteins first \u2014 they take longest to temper.",
          "Tip: Double-batch sauces on slow days to bank for the weekend.",
          "Tip: Ask CarabinerOS to generate prep based on tomorrow\u2019s covers.",
        ][TIP_INDEX]}
      </p>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PrepPage() {
  // Legacy workspace data (fallback)
  const { data: workspaceData, loading: wsLoading, error: wsError } = useWorkspace<WorkspacePrepItem>("/api/prep");

  // Operational prep data
  const [prepList, setPrepList] = useState<PrepListData | null>(null);
  const [opLoading, setOpLoading] = useState(true);
  const [opError, setOpError] = useState<string | null>(null);
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());
  const [activeLane, setActiveLane] = useState<ServiceLane>("All");

  // Fetch operational prep data
  const fetchPrepToday = useCallback(async () => {
    try {
      setOpLoading(true);
      const res = await fetch("/api/prep/today", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      if (json.ok && json.data) {
        setPrepList(json.data);
      } else {
        setPrepList(null);
      }
      setOpError(null);
    } catch (err: unknown) {
      setOpError(err instanceof Error ? err.message : "Unknown error");
      setPrepList(null);
    } finally {
      setOpLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrepToday();
  }, [fetchPrepToday]);

  // Determine which data source to use
  const hasOperationalData = prepList !== null && prepList.items.length > 0;
  const hasWorkspaceData = workspaceData.length > 0;
  const loading = opLoading || wsLoading;

  // Operational item completion toggle (optimistic UI)
  const handleToggleItem = useCallback(async (itemId: string) => {
    if (!prepList) return;

    // Optimistic update
    setPrepList((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                is_complete: !item.is_complete,
                completed_at: !item.is_complete ? new Date().toISOString() : null,
                completed_qty: !item.is_complete ? item.to_prep : null,
              }
            : item,
        ),
      };
    });

    setLoadingItems((prev) => new Set(prev).add(itemId));

    try {
      const res = await fetch(`/api/prep/items/${itemId}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to toggle");
      const json = await res.json();
      if (json.ok && json.data) {
        // Update with server response
        setPrepList((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map((item) =>
              item.id === itemId ? { ...item, ...json.data } : item,
            ),
          };
        });
      }
    } catch {
      // Revert optimistic update
      setPrepList((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  is_complete: !item.is_complete,
                  completed_at: item.is_complete ? null : item.completed_at,
                  completed_qty: item.is_complete ? null : item.completed_qty,
                }
              : item,
          ),
        };
      });
    } finally {
      setLoadingItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }, [prepList]);

  // Filter operational items by service lane
  const filteredOpItems = useMemo(() => {
    if (!prepList) return [];
    if (activeLane === "All") return prepList.items;
    return prepList.items.filter((item) => item.service_lane === activeLane);
  }, [prepList, activeLane]);

  const groupedOpItems = useMemo(() => groupByStation(filteredOpItems), [filteredOpItems]);

  // Filter legacy workspace items by service lane
  const filteredWsItems = useMemo(() => {
    if (activeLane === "All") return workspaceData;
    return workspaceData.filter((item) => item.service_lane === activeLane);
  }, [workspaceData, activeLane]);

  const groupedWsItems = useMemo(() => groupByStation(filteredWsItems), [filteredWsItems]);

  // Lane counts
  const laneCounts = useMemo(() => {
    if (hasOperationalData && prepList) {
      const map: Record<string, number> = { All: prepList.items.length };
      for (const item of prepList.items) {
        const lane = item.service_lane || "All Day";
        map[lane] = (map[lane] ?? 0) + 1;
      }
      return map;
    }
    const map: Record<string, number> = { All: workspaceData.length };
    for (const item of workspaceData) map[item.service_lane] = (map[item.service_lane] ?? 0) + 1;
    return map;
  }, [hasOperationalData, prepList, workspaceData]);

  // Completion stats for operational data
  const completionStats = useMemo(() => {
    if (!prepList) return { completed: 0, total: 0 };
    const items = activeLane === "All" ? prepList.items : filteredOpItems;
    return {
      completed: items.filter((i) => i.is_complete).length,
      total: items.length,
    };
  }, [prepList, activeLane, filteredOpItems]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0 bg-card">
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ChefHat className="size-5 text-muted-foreground" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-foreground tracking-tight">Prep Lists</h1>
                {hasOperationalData && prepList && (
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-md font-medium",
                    prepList.status === "completed"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : prepList.status === "in_progress"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-muted text-muted-foreground",
                  )}>
                    {prepList.status === "completed" ? "Complete" : prepList.status === "in_progress" ? "In Progress" : "Generated"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">{todayFormatted()}</p>
                {hasOperationalData && prepList?.expected_covers && (
                  <span className="text-xs text-muted-foreground font-mono tabular-nums">
                    {prepList.expected_covers} covers
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Ring visualization */}
          {!loading && hasOperationalData ? (
            <CompletionRing completed={completionStats.completed} total={completionStats.total} />
          ) : !loading && hasWorkspaceData ? (
            <ReadinessRing items={filteredWsItems} />
          ) : null}
        </div>
      </header>

      {/* Service lane tabs */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-border shrink-0">
        {SERVICE_LANES.map((lane) => {
          const active = activeLane === lane;
          const count = laneCounts[lane] ?? 0;
          return (
            <button
              key={lane}
              onClick={() => setActiveLane(lane)}
              className={cn(
                "relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {lane}
              {(hasOperationalData ? (prepList?.items.length ?? 0) : workspaceData.length) > 0 && (
                <span className={cn(
                  "ml-1.5 text-xs tabular-nums font-mono",
                  active ? "text-primary-foreground/70" : "text-muted-foreground",
                )}>
                  {count}
                </span>
              )}
              {active && (
                <motion.span
                  layoutId="prep-tab-indicator"
                  className="absolute inset-0 rounded-md bg-primary -z-10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <LoadingSkeleton />
        ) : hasOperationalData ? (
          /* Operational view with checkboxes */
          filteredOpItems.length === 0 ? (
            <EmptyState />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`op-${activeLane}`}
                className="flex flex-col gap-4 p-6"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
              >
                {Object.entries(groupedOpItems).map(([station, items]) => (
                  <OperationalStationGroup
                    key={station}
                    station={station}
                    items={items}
                    onToggleItem={handleToggleItem}
                    loadingItems={loadingItems}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          )
        ) : hasWorkspaceData ? (
          /* Legacy workspace view */
          filteredWsItems.length === 0 ? (
            <EmptyState />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`ws-${activeLane}`}
                className="flex flex-col gap-4 p-6"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
              >
                {Object.entries(groupedWsItems).map(([station, items]) => (
                  <LegacyStationGroup key={station} station={station} items={items} />
                ))}
              </motion.div>
            </AnimatePresence>
          )
        ) : (wsError || opError) ? (
          <div className="p-6">
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              We&apos;re setting up your prep board &mdash; ask CarabinerOS to generate today&apos;s list.
            </div>
          </div>
        ) : (
          <EmptyState />
        )}
      </div>

    </div>
  );
}
