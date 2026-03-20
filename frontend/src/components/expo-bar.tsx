"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ExpoState } from "@/hooks/use-expo-stream";

type ExpoBarProps = ExpoState;

export function ExpoBar({ text, thought, step, active }: ExpoBarProps) {
  if (!text && !thought) return null;

  // Priority: thought > step > text
  const displayText = active
    ? thought ?? step ?? text ?? "Working..."
    : text ?? "Done";

  return (
    <div
      className={`
        flex items-center gap-2.5 px-4 py-2
        transition-all duration-300 ease-in-out
        ${text || thought ? "opacity-100 max-h-12" : "opacity-0 max-h-0"}
      `}
    >
      {active ? (
        <div className="flex items-center gap-1">
          <span className="expo-dot-1 inline-block size-[6px] rounded-full bg-primary" />
          <span className="expo-dot-2 inline-block size-[6px] rounded-full bg-primary" />
          <span className="expo-dot-3 inline-block size-[6px] rounded-full bg-primary" />
        </div>
      ) : (
        <span className="inline-block size-[6px] rounded-full bg-emerald-500" />
      )}

      <AnimatePresence mode="wait">
        <motion.span
          key={displayText}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={`text-xs leading-tight truncate max-w-[calc(100vw-6rem)] ${
            active
              ? thought
                ? "text-muted-foreground"
                : "italic text-primary/70"
              : "font-medium text-emerald-500/80"
          }`}
        >
          {displayText}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
