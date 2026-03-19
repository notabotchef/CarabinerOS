"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChefHat, ClipboardList } from "lucide-react";
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
  { label: string; dot: string; bg: string; text: string }
> = {
  Ready: {
    label: "Ready",
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  "In Progress": {
    label: "In Progress",
    dot: "bg-primary",
    bg: "bg-primary/10",
    text: "text-primary",
  },
  "Not Started": {
    label: "Not Started",
    dot: "bg-muted-foreground/40",
    bg: "bg-muted",
    text: "text-muted-foreground",
  },
  Blocked: {
    label: "Blocked",
    dot: "bg-destructive",
    bg: "bg-destructive/10",
    text: "text-destructive",
  },
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
  // Sort station names alphabetically
  const sorted: Record<string, PrepItem[]> = {};
  for (const key of Object.keys(groups).sort()) {
    sorted[key] = groups[key];
  }
  return sorted;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ReadinessBadge({ readiness }: { readiness: string }) {
  const config = READINESS_CONFIG[readiness] ?? READINESS_CONFIG["Not Started"];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.bg,
        config.text,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}

function ShortageIndicator({ shortage }: { shortage: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate max-w-[200px]">{shortage}</span>
    </span>
  );
}

function ProgressSummary({ items }: { items: PrepItem[] }) {
  const total = items.length;
  const ready = items.filter((i) => i.readiness === "Ready").length;
  const blocked = items.filter((i) => i.readiness === "Blocked").length;
  const pct = total > 0 ? Math.round((ready / total) * 100) : 0;

  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="font-semibold text-foreground tabular-nums">
        {ready}/{total} tasks ready
      </span>
      {/* progress bar */}
      <div className="h-2 w-32 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {blocked > 0 && (
        <span className="text-xs text-destructive font-medium">
          {blocked} blocked
        </span>
      )}
    </div>
  );
}

function StationGroup({
  station,
  items,
}: {
  station: string;
  items: PrepItem[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Station header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">{station}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {items.filter((i) => i.readiness === "Ready").length}/{items.length}
        </span>
      </div>

      {/* Task rows */}
      <div className="divide-y divide-border">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
          >
            {/* Task name + service lane */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {item.task}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {item.service_lane}
                {item.summary && <> &middot; {item.summary}</>}
              </p>
            </div>

            {/* Shortage warning */}
            {item.shortage && (
              <ShortageIndicator shortage={item.shortage} />
            )}

            {/* Readiness badge */}
            <ReadinessBadge readiness={item.readiness} />
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-32 rounded-md" />
        <Skeleton className="h-2 w-32 rounded-full" />
      </div>
      {/* Tab skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-md" />
        ))}
      </div>
      {/* Station group skeletons */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border overflow-hidden">
          <Skeleton className="h-10 w-full" />
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
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <ClipboardList className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">
        No prep tasks
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Prep lists will appear here once tasks are created for the day.
      </p>
    </div>
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

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <ChefHat className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-bold text-foreground">Prep Lists</h1>
            <p className="text-sm text-muted-foreground">{todayFormatted()}</p>
          </div>
        </div>
        {!loading && data.length > 0 && <ProgressSummary items={filtered} />}
      </header>

      {/* Service lane tabs */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-border shrink-0">
        {SERVICE_LANES.map((lane) => (
          <button
            key={lane}
            onClick={() => setActiveLane(lane)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              activeLane === lane
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {lane}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <LoadingSkeleton />
        ) : error && data.length === 0 ? (
          <div className="p-6">
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              No data available — API endpoint not connected yet
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-4 p-6">
            {Object.entries(grouped).map(([station, items]) => (
              <StationGroup key={station} station={station} items={items} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
