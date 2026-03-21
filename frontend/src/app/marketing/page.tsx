"use client";

import React, { useMemo, useState } from "react";
import {
  Megaphone,
  Plus,
  Instagram,
  Facebook,
  Mail,
  Music2,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import { MenuButton } from "@/components/menu-button";
import { motion, AnimatePresence } from "framer-motion";
import type { Variants } from "framer-motion";
import { useWorkspace } from "@/hooks/use-workspace";
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

const STAGES = [
  "Research",
  "Drafting",
  "Review",
  "Live",
  "Completed",
] as const;
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
    badge:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
    bar: "bg-amber-500/60",
  },
  Review: {
    dot: "bg-blue-500",
    badge:
      "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20",
    bar: "bg-blue-500/60",
  },
  Live: {
    dot: "bg-emerald-500",
    badge:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
    bar: "bg-emerald-500/60",
  },
  Completed: {
    dot: "bg-muted-foreground/40",
    badge: "bg-muted text-muted-foreground",
    bar: "bg-muted-foreground/20",
  },
};

/* ------------------------------------------------------------------ */
/*  Motion variants                                                    */
/* ------------------------------------------------------------------ */

const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const cardItem: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: EASE },
  },
  exit: { opacity: 0, y: -8, scale: 0.97, transition: { duration: 0.2 } },
};

const pipelineSegment: Variants = {
  hidden: { scaleX: 0 },
  visible: (i: number) => ({
    scaleX: 1,
    transition: { delay: 0.2 + i * 0.1, duration: 0.5, ease: EASE },
  }),
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
      map[normalizeStage(c.stage)]++;
    });
    return map;
  }, [campaigns]);

  const total = campaigns.length || 1;

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="rounded-xl border border-border bg-card p-5 space-y-3"
    >
      <h2 className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
        Campaign Pipeline
      </h2>

      {/* Animated bar */}
      <div className="flex h-3 w-full rounded-full overflow-hidden bg-muted gap-px">
        {STAGES.map((stage, i) => {
          const pct = (counts[stage] / total) * 100;
          if (pct === 0) return null;
          return (
            <motion.div
              key={stage}
              custom={i}
              variants={pipelineSegment}
              initial="hidden"
              animate="visible"
              className={`${STAGE_STYLES[stage].bar} origin-left`}
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
    </motion.div>
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
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="flex items-center gap-2 flex-wrap"
    >
      {CHANNELS.map((ch) => {
        const isActive = active === ch;
        const Icon = ch === "All" ? Megaphone : channelIcon(ch);
        return (
          <motion.button
            key={ch}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onChange(ch)}
            className={`
              inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium
              transition-colors border cursor-pointer
              ${
                isActive
                  ? "bg-primary text-primary-foreground border-transparent shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
              }
            `}
          >
            <Icon className="size-3.5" />
            {ch}
          </motion.button>
        );
      })}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Campaign Card                                                      */
/* ------------------------------------------------------------------ */

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const stage = normalizeStage(campaign.stage);
  const style = STAGE_STYLES[stage];

  return (
    <motion.div
      layout
      variants={cardItem}
      whileHover={{ y: -4, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="group bg-card border border-border rounded-xl p-5 space-y-3 cursor-default"
    >
      {/* Top row: name + stage */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-sm text-foreground leading-tight line-clamp-2">
          {campaign.campaign_name}
        </h3>
        <span
          className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${style.badge}`}
        >
          <span className={`size-1.5 rounded-full ${style.dot}`} />
          {stage}
        </span>
      </div>

      {/* Channel pill */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {React.createElement(channelIcon(campaign.channel), { className: "size-3.5" })}
        <span className="font-medium">{campaign.channel}</span>
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
        <span className="text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          View details
        </span>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeletons                                                          */
/* ------------------------------------------------------------------ */

function PipelineSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3 animate-pulse">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-full rounded-full" />
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
    <div className="bg-card border border-border rounded-xl p-5 space-y-3 animate-pulse">
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
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0 bg-card">
        <MenuButton />
        <div className="flex-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-8 rounded-lg bg-gradient-to-br from-pink-500/20 to-violet-500/20">
            <Megaphone className="h-4 w-4 text-pink-600 dark:text-pink-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Marketing</h1>
            <p className="text-sm text-muted-foreground">
              Campaign management &amp; content strategy
            </p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          New Campaign
        </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Error banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"
          >
            No data available — API endpoint not connected yet
          </motion.div>
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
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="relative mb-6">
              <div className="flex items-center justify-center size-16 rounded-2xl bg-gradient-to-br from-pink-500/10 to-violet-500/10">
                <Sparkles className="size-7 text-pink-500/60" />
              </div>
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear",
                }}
                className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-pink-500/5 to-violet-500/5 -z-10"
              />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">
              Your creative studio awaits
            </h3>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              Ask CarabinerOS to brainstorm content ideas, plan a social
              campaign, or draft your next email blast.
            </p>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {filtered.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
