"use client";

import { useMemo, useState } from "react";
import {
  Megaphone,
  Plus,
  Instagram,
  Facebook,
  Mail,
  Music2,
  CalendarDays,
} from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Campaign {
  [key: string]: unknown;
  id: string;
  location_id: string;
  campaign_name: string;
  channel: string;
  stage: string;
  deliverable: string;
  summary: string | null;
  detail_points: string[] | null;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STAGES = ["Research", "Drafting", "Review", "Live", "Completed"] as const;
type Stage = (typeof STAGES)[number];

const CHANNELS = [
  "All",
  "Instagram",
  "Facebook",
  "Email",
  "TikTok",
  "Event",
] as const;
type Channel = (typeof CHANNELS)[number];

const STAGE_STYLES: Record<
  Stage,
  { dot: string; badge: string; bar: string }
> = {
  Research: {
    dot: "bg-muted-foreground/50",
    badge: "bg-muted text-muted-foreground",
    bar: "bg-muted-foreground/30",
  },
  Drafting: {
    dot: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    bar: "bg-amber-500/60",
  },
  Review: {
    dot: "bg-blue-500",
    badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    bar: "bg-blue-500/60",
  },
  Live: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    bar: "bg-emerald-500/60",
  },
  Completed: {
    dot: "bg-muted-foreground/40",
    badge: "bg-muted text-muted-foreground",
    bar: "bg-muted-foreground/20",
  },
};

function channelIcon(channel: string) {
  switch (channel.toLowerCase()) {
    case "instagram":
      return Instagram;
    case "facebook":
      return Facebook;
    case "email":
      return Mail;
    case "tiktok":
      return Music2;
    case "event":
      return CalendarDays;
    default:
      return Megaphone;
  }
}

function formatDate(v: unknown): string {
  if (!v || typeof v !== "string") return "\u2014";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function normalizeStage(s: string): Stage {
  const match = STAGES.find(
    (st) => st.toLowerCase() === s.trim().toLowerCase(),
  );
  return match ?? "Research";
}

/* ------------------------------------------------------------------ */
/*  Stage Pipeline                                                     */
/* ------------------------------------------------------------------ */

function StagePipeline({ campaigns }: { campaigns: Campaign[] }) {
  const counts = useMemo(() => {
    const map: Record<Stage, number> = {
      Research: 0,
      Drafting: 0,
      Review: 0,
      Live: 0,
      Completed: 0,
    };
    campaigns.forEach((c) => {
      const stage = normalizeStage(c.stage);
      map[stage]++;
    });
    return map;
  }, [campaigns]);

  const total = campaigns.length || 1;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        Campaign Pipeline
      </h2>

      {/* Bar */}
      <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-muted gap-px">
        {STAGES.map((stage) => {
          const pct = (counts[stage] / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={stage}
              className={`${STAGE_STYLES[stage].bar} transition-all duration-500`}
              style={{ width: `${pct}%`, minWidth: pct > 0 ? "4px" : 0 }}
            />
          );
        })}
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between text-xs">
        {STAGES.map((stage) => (
          <div key={stage} className="flex items-center gap-1.5">
            <span
              className={`inline-block size-2 rounded-full ${STAGE_STYLES[stage].dot}`}
            />
            <span className="text-muted-foreground">{stage}</span>
            <span className="font-semibold text-foreground tabular-nums">
              {counts[stage]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Channel Filters                                                    */
/* ------------------------------------------------------------------ */

function ChannelFilters({
  active,
  onChange,
}: {
  active: Channel;
  onChange: (c: Channel) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {CHANNELS.map((ch) => {
        const isActive = active === ch;
        const Icon = ch === "All" ? Megaphone : channelIcon(ch);
        return (
          <button
            key={ch}
            onClick={() => onChange(ch)}
            className={`
              inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium
              transition-colors border
              ${
                isActive
                  ? "bg-primary text-primary-foreground border-transparent"
                  : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
              }
            `}
          >
            <Icon className="size-3.5" />
            {ch}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Campaign Card                                                      */
/* ------------------------------------------------------------------ */

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const stage = normalizeStage(campaign.stage);
  const style = STAGE_STYLES[stage];
  const Icon = channelIcon(campaign.channel);

  return (
    <div className="group bg-card border border-border rounded-xl p-5 space-y-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20">
      {/* Top row: name + stage */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-sm text-foreground leading-tight line-clamp-2">
          {campaign.campaign_name}
        </h3>
        <span
          className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${style.badge}`}
        >
          <span className={`size-1.5 rounded-full ${style.dot}`} />
          {stage}
        </span>
      </div>

      {/* Channel */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        <span>{campaign.channel}</span>
      </div>

      {/* Deliverable */}
      {campaign.deliverable && (
        <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
          {campaign.deliverable}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {formatDate(campaign.created_at)}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeletons                                                          */
/* ------------------------------------------------------------------ */

function PipelineSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-2.5 w-full rounded-full" />
      <div className="flex items-center justify-between">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Skeleton className="size-2 rounded-full" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CampaignCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex items-center gap-1.5">
        <Skeleton className="size-3.5 rounded" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <div className="pt-2 border-t border-border">
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function MarketingPage() {
  const { data, loading, error } = useWorkspace<Campaign>("/api/campaigns");
  const [channelFilter, setChannelFilter] = useState<Channel>("All");

  const filtered = useMemo(() => {
    if (channelFilter === "All") return data;
    return data.filter(
      (c) => c.channel.toLowerCase() === channelFilter.toLowerCase(),
    );
  }, [data, channelFilter]);

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Megaphone className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Marketing</h1>
            <p className="text-sm text-muted-foreground">
              Campaign management and content strategy
            </p>
          </div>
        </div>
        <Button size="sm">
          <Plus className="size-4" />
          New Campaign
        </Button>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Error banner */}
        {error && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            No data available — API endpoint not connected yet
          </div>
        )}

        {/* Stage Pipeline */}
        {loading ? (
          <PipelineSkeleton />
        ) : (
          <StagePipeline campaigns={data} />
        )}

        {/* Channel Filters */}
        <ChannelFilters active={channelFilter} onChange={setChannelFilter} />

        {/* Campaign Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <CampaignCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Megaphone className="size-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-sm font-medium text-muted-foreground">
              No campaigns
            </h3>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
              Ask CarabinerOS to brainstorm content ideas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
