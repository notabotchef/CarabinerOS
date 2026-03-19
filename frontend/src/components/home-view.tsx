"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, type Variants } from "framer-motion";
import { Sparkles } from "lucide-react";
import { ChatComposer } from "@/components/chat-composer";
import { SolitaireCards } from "@/components/solitaire-cards";

interface HomeViewProps {
  onSend: (text: string) => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning, Chef";
  if (hour < 17) return "Good afternoon, Chef";
  return "Good evening, Chef";
}

function getTimeContext(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Here\u2019s what needs your attention before service.";
  if (hour < 16) return "Lunch service update \u2014 here\u2019s what\u2019s happening.";
  if (hour < 21) return "Dinner prep is underway. Key items to watch.";
  return "Wrapping up the day. Quick summary.";
}

const INSIGHTS = [
  "Produce delivery from Coastal confirmed for 2 PM \u2014 3 items on backorder.",
  "Food cost trending at 28.4% this week, down from 31.2% last week.",
  "Friday reservations at 92% capacity \u2014 consider adding a prep cook.",
];

const insightVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: 0.3 + i * 0.08,
      type: "spring",
      stiffness: 300,
      damping: 30,
    },
  }),
};

export function HomeView({ onSend }: HomeViewProps) {
  const [greeting, setGreeting] = useState("Welcome, Chef");

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  const timeContext = useMemo(() => getTimeContext(), []);

  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full max-w-xl mx-auto px-4">
      {/* Premium greeting */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        className="text-center mb-6"
      >
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">
          {greeting}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {timeContext}
        </p>
      </motion.div>

      {/* AI Briefing */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 25 }}
        className="w-full max-w-[500px] mb-6 rounded-xl border border-primary/15 bg-primary/5 px-5 py-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary/10">
            <Sparkles className="size-3.5 text-primary" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary/80">
            Daily Briefing
          </span>
        </div>
        <ul className="flex flex-col gap-2">
          {INSIGHTS.map((item, i) => (
            <motion.li
              key={i}
              custom={i}
              initial="hidden"
              animate="visible"
              variants={insightVariants}
              className="flex gap-2 text-sm leading-relaxed"
            >
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/40" />
              <span className="text-muted-foreground">{item}</span>
            </motion.li>
          ))}
        </ul>
      </motion.div>

      {/* Composer */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, type: "spring", stiffness: 200, damping: 25 }}
        className="w-full max-w-[500px]"
      >
        <ChatComposer onSend={onSend} placeholder="Ask CarabinerOS anything\u2026" />
      </motion.div>

      {/* Solitaire KPI cards */}
      <SolitaireCards />
    </div>
  );
}
