"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Instagram,
  Facebook,
  Mail,
  Music2,
  CalendarDays,
  Megaphone,
  Tag,
  Clock,
  DollarSign,
  ArrowUp,
} from "lucide-react";
import type { Campaign, CampaignStage } from "@/lib/types";
import { Button } from "@/components/ui/button";

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

const STAGE_STYLES: Record<
  CampaignStage,
  { dot: string; badge: string; ring: string }
> = {
  Research: {
    dot: "bg-muted-foreground/40",
    badge: "bg-muted text-muted-foreground",
    ring: "ring-muted-foreground/20",
  },
  Drafting: {
    dot: "bg-amber-500",
    badge:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
    ring: "ring-amber-500/20",
  },
  Review: {
    dot: "bg-blue-500",
    badge:
      "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20",
    ring: "ring-blue-500/20",
  },
  Live: {
    dot: "bg-emerald-500",
    badge:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
    ring: "ring-emerald-500/20",
  },
  Completed: {
    dot: "bg-muted-foreground/40",
    badge: "bg-muted text-muted-foreground",
    ring: "ring-muted-foreground/20",
  },
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

function formatDateTime(v: string | null): string {
  if (!v) return "--";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "--";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatBudget(cents: number | null): string {
  if (cents === null || cents === undefined) return "--";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

function normalizeStage(s: string): CampaignStage {
  const match = STAGES.find(
    (st) => st.toLowerCase() === s.trim().toLowerCase(),
  );
  return match ?? "Research";
}

/* ------------------------------------------------------------------ */
/*  Mini Pipeline                                                      */
/* ------------------------------------------------------------------ */

function MiniPipeline({ currentStage }: { currentStage: CampaignStage }) {
  const currentIndex = STAGES.indexOf(currentStage);

  return (
    <div className="flex items-center gap-1">
      {STAGES.map((stage, i) => {
        const isPast = i < currentIndex;
        const isCurrent = i === currentIndex;
        const style = STAGE_STYLES[stage];

        return (
          <React.Fragment key={stage}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={`
                  size-2.5 rounded-full transition-all
                  ${isCurrent ? `${style.dot} ring-2 ${style.ring}` : ""}
                  ${isPast ? "bg-emerald-500/60" : ""}
                  ${!isPast && !isCurrent ? "bg-muted-foreground/20" : ""}
                `}
              />
              <span
                className={`text-[10px] ${
                  isCurrent
                    ? "text-foreground font-medium"
                    : "text-muted-foreground/60"
                }`}
              >
                {stage}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className={`h-px flex-1 min-w-3 mt-[-12px] ${
                  isPast ? "bg-emerald-500/40" : "bg-border"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Campaign Detail Panel                                              */
/* ------------------------------------------------------------------ */

interface CampaignDetailPanelProps {
  campaign: Campaign | null;
  open: boolean;
  onClose: () => void;
  onSendChat: (text: string) => void;
}

export function CampaignDetailPanel({
  campaign,
  open,
  onClose,
  onSendChat,
}: CampaignDetailPanelProps) {
  const [chatInput, setChatInput] = useState("");

  const handleChatSubmit = useCallback(() => {
    const text = chatInput.trim();
    if (!text || !campaign) return;
    // Prefix with campaign context so A0 knows which campaign
    onSendChat(
      `[Campaign: ${campaign.campaign_name}] ${text}`,
    );
    setChatInput("");
  }, [chatInput, campaign, onSendChat]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit();
    }
  };

  if (!campaign) return null;

  const stage = normalizeStage(campaign.stage);
  const stageStyle = STAGE_STYLES[stage];

  const chatSuggestions = [
    "Write a caption for this",
    `Move to ${stage === "Drafting" ? "Review" : stage === "Review" ? "Live" : "Completed"}`,
    "Schedule for Friday 5pm",
    "Generate hashtags",
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-background shadow-md"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center justify-center size-7 rounded-lg bg-gradient-to-br from-pink-500/20 to-violet-500/20">
                    {React.createElement(channelIcon(campaign.channel), { className: "size-3.5 text-pink-600 dark:text-pink-400" })}
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${stageStyle.badge}`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${stageStyle.dot}`}
                    />
                    {stage}
                  </span>
                </div>
                <h2 className="text-base font-bold text-foreground leading-tight">
                  {campaign.campaign_name}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {campaign.channel}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={onClose}>
                <X className="size-4" />
              </Button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-auto p-4 space-y-6">
              {/* Mini pipeline */}
              <MiniPipeline currentStage={stage} />

              {/* Deliverable */}
              {campaign.deliverable && (
                <div>
                  <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Deliverable
                  </h3>
                  <p className="text-sm text-foreground">
                    {campaign.deliverable}
                  </p>
                </div>
              )}

              {/* Summary */}
              {campaign.summary && (
                <div>
                  <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Summary
                  </h3>
                  <p className="text-sm text-foreground leading-relaxed">
                    {campaign.summary}
                  </p>
                </div>
              )}

              {/* Detail points */}
              {campaign.detail_points && campaign.detail_points.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Details
                  </h3>
                  <ul className="space-y-1.5">
                    {campaign.detail_points.map((point, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-foreground"
                      >
                        <span className="shrink-0 mt-1.5 size-1.5 rounded-full bg-primary/40" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Metadata row */}
              <div className="grid grid-cols-2 gap-4">
                {campaign.scheduled_at && (
                  <div className="flex items-center gap-2">
                    <Clock className="size-3.5 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        Scheduled
                      </p>
                      <p className="text-xs font-mono text-foreground">
                        {formatDateTime(campaign.scheduled_at)}
                      </p>
                    </div>
                  </div>
                )}
                {campaign.budget_cents !== null && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="size-3.5 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        Budget
                      </p>
                      <p className="text-xs font-mono text-foreground">
                        {formatBudget(campaign.budget_cents)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Tags */}
              {campaign.tags && campaign.tags.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {campaign.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20"
                      >
                        <Tag className="size-2.5" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat suggestions */}
              <div>
                <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Quick actions
                </h3>
                <div className="flex flex-wrap gap-2">
                  {chatSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() =>
                        onSendChat(
                          `[Campaign: ${campaign.campaign_name}] ${suggestion}`,
                        )
                      }
                      className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chat input at bottom */}
            <div className="border-t border-border px-4 py-3">
              <div className="relative">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about this campaign..."
                  className="
                    w-full rounded-xl border border-border bg-card/80
                    px-4 py-2.5 pr-10 text-sm text-foreground
                    placeholder:text-muted-foreground/40
                    outline-none transition-all duration-200
                    focus:border-primary/50 focus:ring-2 focus:ring-primary/20
                  "
                />
                <button
                  onClick={handleChatSubmit}
                  disabled={!chatInput.trim()}
                  className="
                    absolute right-1.5 top-1/2 -translate-y-1/2
                    size-7 rounded-lg flex items-center justify-center
                    bg-primary text-primary-foreground
                    disabled:opacity-20 transition-all duration-200 cursor-pointer
                  "
                >
                  <ArrowUp className="size-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
