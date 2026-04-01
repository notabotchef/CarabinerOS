"use client";

import { motion, AnimatePresence } from "motion/react";
import { MenuButton } from "@/components/menu-button";
import { Badge } from "@/components/ui/badge";

interface FloatingIslandProps {
  visible: boolean;
  unreadCount: number;
  lastCardType?: string;
  onBellClick: () => void;
}

export function FloatingIsland({
  visible,
  unreadCount,
  lastCardType,
  onBellClick,
}: FloatingIslandProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed top-3 left-3 z-30 flex flex-col items-center gap-2 rounded-2xl bg-card/95 backdrop-blur-sm shadow-md p-2 border border-border"
        >
          {/* Hamburger menu */}
          <MenuButton />

          {/* Compact logo */}
          <div className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-[8px] font-black tracking-tight leading-none shadow-sm select-none">
            cOS
          </div>

          {/* Action cards badge */}
          <button
            onClick={onBellClick}
            className="relative flex size-8 items-center justify-center rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
            title="Action Cards"
          >
            {/* Simplified card icon for compact view */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="text-current"
            >
              <rect
                x="2"
                y="1"
                width="9"
                height="12"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.5"
                opacity="0.4"
                transform="rotate(-3 6.5 7)"
              />
              <rect
                x="5"
                y="3"
                width="9"
                height="12"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.5"
                transform="rotate(4 9.5 9)"
              />
            </svg>
            {unreadCount > 0 && (
              <Badge
                className={`absolute -top-1 -right-1 h-[16px] min-w-[16px] px-1 text-[9px] font-semibold border-none text-primary-foreground ${
                  lastCardType === "urgent"
                    ? "bg-amber-500"
                    : lastCardType === "action"
                      ? "bg-blue-500"
                      : lastCardType === "update"
                        ? "bg-emerald-500"
                        : lastCardType === "info"
                          ? "bg-violet-500"
                          : "bg-primary"
                }`}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
