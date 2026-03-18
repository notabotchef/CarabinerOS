"use client";

import { motion } from "framer-motion";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  ClipboardCheck,
  PackageSearch,
  DollarSign,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import type { Metric } from "@/lib/api";

const ICON_MAP: Record<string, LucideIcon> = {
  "Orders ready": ClipboardCheck,
  "Inventory risks": PackageSearch,
  "Food cost alerts": DollarSign,
  "Campaign ideas": Lightbulb,
};

const FALLBACK_METRICS = [
  { label: "Orders ready", value: "08", delta: "+3 today" },
  { label: "Inventory risks", value: "05", delta: "2 critical" },
  { label: "Food cost alerts", value: "03", delta: "1 new" },
  { label: "Campaign ideas", value: "12", delta: "for next launch" },
];

interface MetricCardsProps {
  metrics: Metric[] | null;
}

export function MetricCards({ metrics }: MetricCardsProps) {
  const data = metrics ?? FALLBACK_METRICS;

  return (
    <>
      {data.map((m, i) => {
        const Icon = ICON_MAP[m.label] ?? Lightbulb;
        const isPositive = m.delta.startsWith("+") || m.delta.includes("launch");
        return (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.3 + i * 0.1,
              type: "spring" as const,
              stiffness: 300,
              damping: 28,
            }}
          >
            <Card className="h-full shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_1px_2px_rgba(0,0,0,0.06),0_6px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {m.label}
                  </span>
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="size-4 text-primary" />
                  </div>
                </div>
                <div className="text-3xl font-bold tabular-nums tracking-tight">{m.value}</div>
                <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1 tabular-nums">
                  {isPositive ? (
                    <TrendingUp className="size-3 text-emerald-500" />
                  ) : (
                    <TrendingDown className="size-3 text-amber-500" />
                  )}
                  {m.delta}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </>
  );
}
