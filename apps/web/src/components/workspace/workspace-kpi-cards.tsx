"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/ui/animated-number";

interface KPICard {
  label: string;
  value: string | number;
  delta?: string;
}

interface WorkspaceKPICardsProps {
  cards: KPICard[];
}

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, type: "spring" as const, stiffness: 300, damping: 30 },
  }),
};

function parseNumericValue(val: string | number): { num: number; prefix: string; suffix: string } | null {
  if (typeof val === "number") return { num: val, prefix: "", suffix: "" };
  const match = String(val).match(/^([^0-9-]*)([0-9,.]+)(.*)$/);
  if (!match) return null;
  const num = parseFloat(match[2].replace(/,/g, ""));
  if (isNaN(num)) return null;
  return { num, prefix: match[1], suffix: match[3] };
}

export function WorkspaceKPICards({ cards }: WorkspaceKPICardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, i) => {
        const parsed = parseNumericValue(card.value);
        return (
          <motion.div
            key={card.label}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
          >
            <Card className="shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.04),0_12px_24px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_1px_2px_rgba(0,0,0,0.06),0_6px_12px_rgba(0,0,0,0.06),0_16px_32px_rgba(0,0,0,0.08)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {parsed ? (
                    <AnimatedNumber
                      value={parsed.num}
                      prefix={parsed.prefix}
                      suffix={parsed.suffix}
                    />
                  ) : (
                    card.value
                  )}
                </div>
                {card.delta && (
                  <p className="text-xs text-muted-foreground tabular-nums">{card.delta}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
