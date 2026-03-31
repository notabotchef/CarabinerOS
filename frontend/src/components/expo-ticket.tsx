"use client";

import { motion, AnimatePresence } from "motion/react";
import type { ExpoTicketStep } from "@/hooks/use-expo-stream";

interface ExpoTicketProps {
  steps: ExpoTicketStep[];
  expanded: boolean;
}

const DOT_COLORS: Record<ExpoTicketStep["type"], string> = {
  agent: "bg-emerald-500/50",
  tool: "bg-orange-500/50",
  subagent: "bg-blue-400/50",
  response: "bg-emerald-500/50",
};

export function ExpoTicket({ steps, expanded }: ExpoTicketProps) {
  return (
    <AnimatePresence>
      {expanded && steps.length > 0 && (
        <motion.div
          key="expo-ticket"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="overflow-hidden"
          aria-hidden="true"
        >
          <div className="mx-3 mb-1 max-h-[40vh] overflow-y-auto">
            <div className="px-3 py-2 space-y-0.5">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2 min-h-[16px]">
                  <span
                    className={`mt-[4px] inline-block size-[5px] rounded-full shrink-0 ${
                      step.isFiller ? "bg-white/15" : DOT_COLORS[step.type]
                    }`}
                  />
                  <span
                    className={`leading-tight truncate ${
                      step.isFiller
                        ? "italic text-muted-foreground/40"
                        : "text-muted-foreground/60"
                    }`}
                    style={{ fontSize: "9px" }}
                  >
                    {step.heading}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
