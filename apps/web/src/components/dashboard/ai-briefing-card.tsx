"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { X, Sparkles } from "lucide-react";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getTimeContext(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Here's what needs your attention before service.";
  if (hour < 16) return "Lunch service update — here's what's happening.";
  if (hour < 21) return "Dinner prep is underway. Key items to watch.";
  return "Wrapping up the day. Quick summary.";
}

interface AIBriefingCardProps {
  locationName?: string;
  insights?: string[];
}

const FALLBACK_INSIGHTS = [
  "Produce delivery from Coastal confirmed for 2 PM — 3 items on backorder.",
  "Food cost trending at 31.2% this week, down from 33.8% last week.",
  "Friday reservations at 92% capacity — consider adding a prep cook.",
];

export function AIBriefingCard({ locationName, insights }: AIBriefingCardProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const items = insights ?? FALLBACK_INSIGHTS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 28 }}
    >
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent h-full">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        aria-label="Dismiss briefing"
      >
        <X className="size-3.5" />
      </button>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary/10">
            <Sparkles className="size-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {getGreeting()}{locationName ? `, ${locationName}` : ""}
            </p>
            <p className="text-[11px] text-muted-foreground">{getTimeContext()}</p>
          </div>
        </div>
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/40" />
              <span className="text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
    </motion.div>
  );
}
