"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ThoughtsStreamProps {
  thoughts: string[];
  active: boolean;
}

const MAX_VISIBLE = 4;

export function ThoughtsStream({ thoughts, active }: ThoughtsStreamProps) {
  const [dismissing, setDismissing] = useState(false);
  const [dismissedCount, setDismissedCount] = useState(0);

  // Show last MAX_VISIBLE thoughts (must be above useEffects that reference it)
  const visibleThoughts = thoughts.slice(-MAX_VISIBLE);

  // When active goes false, start the top-to-bottom vanish cascade
  useEffect(() => {
    if (!active && thoughts.length > 0 && !dismissing) {
      setDismissing(true);
      setDismissedCount(0);
    }
    if (active && dismissing) {
      setDismissing(false);
      setDismissedCount(0);
    }
  }, [active, thoughts.length, dismissing]);

  // Stagger the vanish: dismiss one line every 150ms from top
  useEffect(() => {
    if (!dismissing) return;
    if (dismissedCount >= visibleThoughts.length) return;

    const timer = setTimeout(() => {
      setDismissedCount((c) => c + 1);
    }, 150);
    return () => clearTimeout(timer);
  }, [dismissing, dismissedCount, visibleThoughts.length]);

  // Nothing to show
  if (visibleThoughts.length === 0 && !dismissing) return null;

  // All dismissed — collapse
  if (dismissing && dismissedCount >= visibleThoughts.length) {
    return (
      <motion.div
        initial={{ height: "auto" }}
        animate={{ height: 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      />
    );
  }

  return (
    <div className="px-4 pt-2 pb-0" aria-hidden="true">
      <AnimatePresence mode="popLayout">
        {visibleThoughts.map((thought, i) => {
          const isDismissed = dismissing && i < dismissedCount;
          if (isDismissed) return null;

          // Opacity gradient: oldest (top) = 0.3, newest (bottom) = 0.6
          const total = visibleThoughts.length;
          const opacity = total <= 1 ? 0.6 : 0.3 + (i / (total - 1)) * 0.3;

          return (
            <motion.div
              key={`${thoughts.length - visibleThoughts.length + i}-${thought.slice(0, 20)}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="leading-tight"
              style={{ fontSize: "9px" }}
            >
              <span className="text-muted-foreground truncate block max-w-[calc(100vw-4rem)]">
                {thought}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
