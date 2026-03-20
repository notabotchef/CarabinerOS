"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChefHat, ClipboardList } from "lucide-react";
import { MenuButton } from "@/components/menu-button";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useWorkspace } from "@/hooks/use-workspace";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PrepItem {
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

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

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

const tabUnderline: Variants = {
  inactive: { scaleX: 0, opacity: 0 },
  active: { scaleX: 1, opacity: 1, transition: { duration: 0.2 } },
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

function groupByStation(items: PrepItem[]): Record<string, PrepItem[]> {
  const groups: Record<string, PrepItem[]> = {};
  for (const item of items) {
    const station = item.station || "Unassigned";
    if (!groups[station]) groups[station] = [];
    groups[station].push(item);
  }
  const sorted: Record<string, PrepItem[]> = {};
  for (const key of Object.keys(groups).sort()) sorted[key] = groups[key];
  return sorted;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ReadinessRing({ items }: { items: PrepItem[] }) {
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
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground tabular-nums">
          {pct}%
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground tabular-nums">
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

function StationGroup({ station, items }: { station: string; items: PrepItem[] }) {
  const readyCount = items.filter((i) => i.readiness === "Ready").length;
  const allReady = readyCount === items.length;

  return (
    <motion.div variants={fadeSlideUp} className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Station header */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3 border-b border-border",
        allReady ? "bg-emerald-500/5" : "bg-muted/40",
      )}>
        <h3 className="text-sm font-bold text-foreground tracking-tight">{station}</h3>
        <span className={cn(
          "text-xs font-medium tabular-nums",
          allReady ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
        )}>
          {readyCount}/{items.length}
        </span>
      </div>

      {/* Task rows */}
      <div className="divide-y divide-border">
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
      </div>
    </motion.div>
  );
}

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
      <div className="rounded-full bg-muted p-4 mb-4">
        <ClipboardList className="size-8 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">No prep tasks</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Prep lists will appear here once tasks are created for the day.
      </p>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PrepPage() {
  const { data, loading, error } = useWorkspace<PrepItem>("/api/prep");
  const [activeLane, setActiveLane] = useState<ServiceLane>("All");

  const filtered = useMemo(() => {
    if (activeLane === "All") return data;
    return data.filter((item) => item.service_lane === activeLane);
  }, [data, activeLane]);

  const grouped = useMemo(() => groupByStation(filtered), [filtered]);

  const laneCounts = useMemo(() => {
    const map: Record<string, number> = { All: data.length };
    for (const item of data) map[item.service_lane] = (map[item.service_lane] ?? 0) + 1;
    return map;
  }, [data]);

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0 bg-card">
        <MenuButton />
        <div className="flex-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ChefHat className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">Prep Lists</h1>
            <p className="text-xs text-muted-foreground">{todayFormatted()}</p>
          </div>
        </div>
        {!loading && data.length > 0 && <ReadinessRing items={filtered} />}
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
              {data.length > 0 && (
                <span className={cn(
                  "ml-1.5 text-xs tabular-nums",
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
        ) : error && data.length === 0 ? (
          <div className="p-6">
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              No data available — API endpoint not connected yet
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeLane}
              className="flex flex-col gap-4 p-6"
              variants={staggerContainer}
              initial="hidden"
              animate="show"
            >
              {Object.entries(grouped).map(([station, items]) => (
                <StationGroup key={station} station={station} items={items} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
