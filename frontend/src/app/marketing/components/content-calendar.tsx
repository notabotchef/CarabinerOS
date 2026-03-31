"use client";

import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Campaign, CampaignStage } from "@/lib/types";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const STAGE_DOT: Record<CampaignStage, string> = {
  Research: "bg-muted-foreground/40",
  Drafting: "bg-amber-500",
  Review: "bg-blue-500",
  Live: "bg-emerald-500",
  Completed: "bg-muted-foreground/40",
};

function normalizeStage(s: string): CampaignStage {
  const stages: CampaignStage[] = [
    "Research",
    "Drafting",
    "Review",
    "Live",
    "Completed",
  ];
  return stages.find((st) => st.toLowerCase() === s.trim().toLowerCase()) ?? "Research";
}

/* ------------------------------------------------------------------ */
/*  Date helpers                                                       */
/* ------------------------------------------------------------------ */

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${monday.toLocaleDateString("en-US", opts)} - ${sunday.toLocaleDateString("en-US", opts)}`;
}

/* ------------------------------------------------------------------ */
/*  Content Calendar                                                   */
/* ------------------------------------------------------------------ */

interface ContentCalendarProps {
  campaigns: Campaign[];
  onCampaignClick: (campaign: Campaign) => void;
}

export function ContentCalendar({
  campaigns,
  onCampaignClick,
}: ContentCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const monday = useMemo(() => {
    const base = getMonday(new Date());
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [monday]);

  // Group campaigns by day of week
  const campaignsByDay = useMemo(() => {
    const map = new Map<number, Campaign[]>();
    for (let i = 0; i < 7; i++) {
      map.set(i, []);
    }

    for (const c of campaigns) {
      if (!c.scheduled_at) continue;
      const scheduledDate = new Date(c.scheduled_at);
      for (let i = 0; i < 7; i++) {
        if (isSameDay(scheduledDate, weekDays[i])) {
          map.get(i)!.push(c);
          break;
        }
      }
    }

    return map;
  }, [campaigns, weekDays]);

  const today = new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="rounded-xl border border-border bg-card"
    >
      {/* Calendar header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium text-foreground">
          Content Calendar
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">
            {formatWeekRange(monday)}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setWeekOffset((w) => w - 1)}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setWeekOffset(0)}
              className="text-[10px] font-medium px-2"
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setWeekOffset((w) => w + 1)}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Day columns */}
      <div className="grid grid-cols-7 divide-x divide-border">
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today);
          const dayCampaigns = campaignsByDay.get(i) ?? [];

          return (
            <div key={i} className="min-h-[120px]">
              {/* Day header */}
              <div
                className={`px-2 py-2 text-center border-b border-border ${
                  isToday ? "bg-primary/5" : ""
                }`}
              >
                <p className="text-[10px] text-muted-foreground uppercase">
                  {DAY_NAMES[i]}
                </p>
                <p
                  className={`text-sm font-mono ${
                    isToday
                      ? "text-primary font-bold"
                      : "text-foreground"
                  }`}
                >
                  {day.getDate()}
                </p>
              </div>

              {/* Campaign pills */}
              <div className="p-1.5 space-y-1">
                {dayCampaigns.map((c) => {
                  const stage = normalizeStage(c.stage);
                  return (
                    <button
                      key={c.id}
                      onClick={() => onCampaignClick(c)}
                      className="w-full text-left rounded-md px-1.5 py-1 bg-card hover:bg-muted border border-border transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className={`shrink-0 size-1.5 rounded-full ${STAGE_DOT[stage]}`}
                        />
                        <span className="text-[10px] text-foreground font-medium truncate leading-tight">
                          {c.campaign_name}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5 pl-3">
                        {c.channel}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
