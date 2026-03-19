"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";
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

interface Insight {
  text: string;
  tag: string;
  title: string;
  desc: string;
  details: { label: string; value: string }[];
  actions: string[];
}

const INSIGHTS: Insight[] = [
  {
    text: "Produce delivery from Coastal confirmed for 2 PM \u2014 3 items on backorder.",
    tag: "Delivery",
    title: "Coastal Produce \u2014 Order #4821",
    desc: "Delivery confirmed today 2 PM. 3 of 18 items on backorder: Roma Tomatoes (5 cs), Fresh Basil (2 cs), Burrata (1 cs). Backorder ETA Friday.",
    details: [
      { label: "Confirmed", value: "15 / 18" },
      { label: "Backorder ETA", value: "Friday" },
      { label: "Order total", value: "$1,240" },
      { label: "Driver", value: "Miguel R." },
    ],
    actions: ["Contact Supplier", "Find Substitute"],
  },
  {
    text: "Food cost trending at 28.4% this week, down from 31.2% last week.",
    tag: "Food Cost",
    title: "Weekly Food Cost \u2014 Trending Down",
    desc: "Dropped to 28.4% from 31.2% last week. Savings from renegotiated seafood pricing and reduced waste on grill station.",
    details: [
      { label: "This week", value: "28.4%" },
      { label: "Last week", value: "31.2%" },
      { label: "Target", value: "27.0%" },
      { label: "Top spend", value: "Salmon ($840)" },
    ],
    actions: ["View Breakdown", "Set Alert"],
  },
  {
    text: "Friday reservations at 92% capacity \u2014 consider adding a prep cook.",
    tag: "Capacity",
    title: "Friday \u2014 Near Full Capacity",
    desc: "92% reserved. Walk-in capacity limited to ~12 covers. PM shift may need an extra prep cook.",
    details: [
      { label: "Reserved", value: "171 / 185" },
      { label: "Walk-in slots", value: "~12" },
      { label: "Suggested", value: "+1 prep cook" },
      { label: "Last Friday", value: "178 covers" },
    ],
    actions: ["Add to Schedule", "View Reservations"],
  },
];

function DailyBriefing() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [minHeight, setMinHeight] = useState<number | undefined>(undefined);
  const bodyRef = useRef<HTMLDivElement>(null);
  const rowHeightRef = useRef<number>(0);

  useEffect(() => {
    if (bodyRef.current) {
      rowHeightRef.current = bodyRef.current.offsetHeight;
    }
  }, []);

  const handleExpand = useCallback((index: number) => {
    if (bodyRef.current) {
      const currentH = bodyRef.current.offsetHeight;
      setMinHeight(currentH);
    }
    setExpandedIndex(index);

    // After detail renders, check if we need to grow
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (bodyRef.current) {
          const detail = bodyRef.current.querySelector("[data-detail-active]");
          if (detail) {
            const detailH = (detail as HTMLElement).scrollHeight + 8;
            const currentMin = bodyRef.current.offsetHeight;
            if (detailH > currentMin) {
              setMinHeight(detailH);
            }
          }
        }
      });
    });
  }, []);

  const handleCollapse = useCallback(() => {
    setExpandedIndex(null);

    // Ease min-height back to original row height
    setTimeout(() => {
      setMinHeight(rowHeightRef.current);
    }, 150);

    // Release min-height after transition settles
    setTimeout(() => {
      setMinHeight(undefined);
    }, 800);
  }, []);

  const isExpanded = expandedIndex !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 25 }}
      className="w-full max-w-[500px] mb-6 rounded-xl border border-primary/15 bg-primary/5 relative overflow-hidden"
    >
      {/* Shimmer bar */}
      <div
        className="absolute top-0 inset-x-0 h-[2px] z-10"
        style={{
          background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.4), transparent)",
          animation: "shimmer-slide 3s ease-in-out infinite",
        }}
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-5 pt-[18px] pb-2.5">
        <div className="flex size-6 items-center justify-center rounded-md bg-primary/10">
          <Sparkles className="size-3.5 text-primary" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-primary/80">
          Daily Briefing
        </span>
      </div>

      {/* Body — never shrinks during transitions */}
      <div
        ref={bodyRef}
        className="relative px-5 pb-[18px]"
        style={{
          minHeight: minHeight !== undefined ? `${minHeight}px` : undefined,
          transition: "min-height 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Insight rows — fade out but keep space */}
        <div
          className="flex flex-col transition-opacity duration-[450ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{
            opacity: isExpanded ? 0 : 1,
            pointerEvents: isExpanded ? "none" : "auto",
          }}
        >
          {INSIGHTS.map((insight, i) => (
            <motion.div
              key={i}
              onClick={() => handleExpand(i)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border border-transparent cursor-pointer transition-colors hover:bg-primary/5 hover:border-primary/10"
            >
              <motion.span
                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.4 }}
                className="size-1.5 shrink-0 rounded-full bg-primary/40"
              />
              <span className="text-sm text-muted-foreground leading-relaxed flex-1">
                {insight.text}
              </span>
              <span className="text-sm text-muted-foreground/40 transition-colors group-hover:text-primary">
                ›
              </span>
            </motion.div>
          ))}
        </div>

        {/* Detail overlay — absolute, on top */}
        <AnimatePresence>
          {expandedIndex !== null && (
            <motion.div
              key={expandedIndex}
              data-detail-active
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              className="absolute top-0 left-0 right-0 px-5 pb-[18px]"
            >
              <div className="relative">
                {/* Close button */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleCollapse(); }}
                  className="absolute top-1 right-0 size-7 rounded-lg border border-primary/20 bg-primary/5 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  <X className="size-3.5" />
                </button>

                {/* Tag */}
                <span className="inline-block text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-md mb-2">
                  {INSIGHTS[expandedIndex].tag}
                </span>

                {/* Title */}
                <h3 className="text-[15px] font-bold mb-1.5">
                  {INSIGHTS[expandedIndex].title}
                </h3>

                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed mb-3.5">
                  {INSIGHTS[expandedIndex].desc}
                </p>

                {/* Detail grid */}
                <div className="grid grid-cols-2 gap-2 mb-3.5">
                  {INSIGHTS[expandedIndex].details.map((d) => (
                    <div key={d.label} className="bg-background/70 rounded-lg p-2.5">
                      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
                        {d.label}
                      </div>
                      <div className="text-sm font-bold">{d.value}</div>
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="flex gap-1.5">
                  {INSIGHTS[expandedIndex].actions.map((action, ai) => (
                    <button
                      key={action}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                        ai === 0
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function HomeView({ onSend }: HomeViewProps) {
  const [greeting, setGreeting] = useState("Welcome, Chef");

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  const timeContext = useMemo(() => getTimeContext(), []);

  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full max-w-xl mx-auto px-4">
      {/* Greeting */}
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

      {/* Composer (now above briefing) */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 25 }}
        className="w-full max-w-[500px]"
      >
        <ChatComposer onSend={onSend} placeholder="Ask CarabinerOS anything\u2026" />
      </motion.div>

      {/* Daily Briefing (now below composer) */}
      <div className="w-full flex justify-center mt-6">
        <DailyBriefing />
      </div>

      {/* KPI Cards */}
      <SolitaireCards />
    </div>
  );
}
