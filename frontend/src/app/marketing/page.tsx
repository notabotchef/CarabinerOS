"use client";

import React, { useMemo, useState, useCallback } from "react";
import {
  Megaphone,
  Plus,
  Instagram,
  Facebook,
  Mail,
  Music2,
  CalendarDays,
  Sparkles,
  Calendar,
  LayoutGrid,
} from "lucide-react";
import { MenuButton } from "@/components/menu-button";
import { motion, AnimatePresence } from "framer-motion";
import type { Variants } from "framer-motion";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSocket } from "@/hooks/use-socket";
import { useChat } from "@/hooks/use-chat";
import type { Campaign, CampaignStage } from "@/lib/types";
import { CampaignDetailPanel } from "./components/campaign-detail-panel";
import { ContentCalendar } from "./components/content-calendar";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STAGES: CampaignStage[] = [
  "Research",
  "Drafting",
  "Review",
  "Live",
  "Completed",
];

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
  CampaignStage,
  { dot: string; badge: string; bar: string }
> = {
  Research: {
    dot: "bg-muted-foreground/40",
    badge: "bg-muted text-muted-foreground",
    bar: "bg-muted-foreground/20",
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

type ViewMode = "grid" | "calendar";

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

function normalizeStage(s: string): CampaignStage {
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
    const map: Record<CampaignStage, number> = {
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
      className="rounded-xl border border-border bg-card p-4 space-y-3"
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

function CampaignCard({
  campaign,
  onClick,
}: {
  campaign: Campaign;
  onClick: () => void;
}) {
  const stage = normalizeStage(campaign.stage);
  const style = STAGE_STYLES[stage];

  return (
    <motion.div
      layout
      variants={cardItem}
      whileHover={{ y: -4, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      onClick={onClick}
      className="group bg-card border border-border rounded-xl p-4 space-y-3 cursor-pointer"
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
        {React.createElement(channelIcon(campaign.channel), {
          className: "size-3.5",
        })}
        <span className="font-medium">{campaign.channel}</span>
      </div>

      {/* Deliverable */}
      {campaign.deliverable && (
        <p className="text-xs text-muted-foreground/85 line-clamp-2 leading-relaxed">
          {campaign.deliverable}
        </p>
      )}

      {/* Tags */}
      {campaign.tags && campaign.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {campaign.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-violet-500/10 text-violet-700 dark:text-violet-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-[11px] text-muted-foreground font-mono">
          {campaign.scheduled_at
            ? formatDate(campaign.scheduled_at)
            : formatDate(campaign.created_at)}
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
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 animate-pulse">
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
    <div className="bg-card border border-border rounded-xl p-4 space-y-3 animate-pulse">
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
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = useState(false);

  // Chat integration for campaign actions
  const { snapshot } = useSocket();
  const { sendMessage } = useChat(snapshot);

  const filtered = useMemo(() => {
    if (channelFilter === "All") return data;
    return data.filter(
      (c) =>
        c.channel.toLowerCase().includes(channelFilter.toLowerCase()),
    );
  }, [data, channelFilter]);

  const handleCampaignClick = useCallback((campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setDetailOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false);
    // Delay clearing data so exit animation completes
    setTimeout(() => setSelectedCampaign(null), 300);
  }, []);

  const handleSendChat = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage],
  );

  const handleNewCampaign = useCallback(() => {
    sendMessage(
      "What should I post this week? Suggest campaign ideas based on our menu, inventory, and any upcoming events.",
    );
  }, [sendMessage]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0 bg-card">
        <MenuButton />
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-8 rounded-lg bg-gradient-to-br from-pink-500/20 to-violet-500/20">
              <Megaphone className="h-4 w-4 text-pink-600 dark:text-pink-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">Marketing</h1>
              <p className="text-xs text-muted-foreground">
                Campaign management &amp; content strategy
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center justify-center size-7 rounded-md transition-colors cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="size-3.5" />
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`flex items-center justify-center size-7 rounded-md transition-colors cursor-pointer ${
                  viewMode === "calendar"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Calendar className="size-3.5" />
              </button>
            </div>
            <Button size="sm" className="gap-1.5" onClick={handleNewCampaign}>
              <Plus className="size-4" />
              New Campaign
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Error banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground"
          >
            No data available -- API endpoint not connected yet
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

        {/* Content view */}
        {viewMode === "calendar" ? (
          loading ? (
            <div className="rounded-xl border border-border bg-card p-4 animate-pulse">
              <Skeleton className="h-4 w-40 mb-4" />
              <div className="grid grid-cols-7 gap-4">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            </div>
          ) : (
            <ContentCalendar
              campaigns={filtered}
              onCampaignClick={handleCampaignClick}
            />
          )
        ) : loading ? (
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
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed mb-4">
              Ask CarabinerOS to brainstorm content ideas, plan a social
              campaign, or draft your next email blast.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handleNewCampaign}
            >
              <Sparkles className="size-3.5" />
              Ask for ideas
            </Button>
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
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onClick={() => handleCampaignClick(campaign)}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Campaign Detail Panel */}
      <CampaignDetailPanel
        campaign={selectedCampaign}
        open={detailOpen}
        onClose={handleCloseDetail}
        onSendChat={handleSendChat}
      />
    </div>
  );
}
