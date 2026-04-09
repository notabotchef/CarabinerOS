"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MenuButton } from "@/components/menu-button";
import { ThemeToggle } from "@/components/theme-toggle";

interface TopBarProps {
  unreadCount: number;
  onBellClick: () => void;
  locationName?: string;
  lastCardType?: string;
}

// Hex values for Framer Motion runtime animation — see DESIGN_TOKENS.md Type Accent Colors section.
// urgent=amber-500 (#f59e0b), action=blue-500 (#3b82f6), update=emerald-400 (#34d399), info=violet-500 (#8b5cf6)
const TYPE_COLORS: Record<string, { border: string; bg: string }> = {
  urgent: { border: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  action: { border: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  update: { border: "#34d399", bg: "rgba(52,211,153,0.1)" },
  info:   { border: "#8b5cf6", bg: "rgba(139,92,246,0.1)" },
};

/* Variant-driven: parent propagates "idle"/"hovered" to children */
const parentVariants = {
  idle: {},
  hovered: {},
};

/* Back card — peeks from upper-left, subtle fan on hover */
const backCardVariants = {
  idle:    { rotate: -3, x: 0, y: 0 },
  hovered: { rotate: -6, x: -1, y: 0.5 },
};

/* Front card — overlaps bottom-right, subtle fan on hover */
const frontCardVariants = {
  idle:    { rotate: 4, x: 0, y: 0 },
  hovered: { rotate: 6, x: 1, y: -0.5 },
};

const cardTransition = { type: "spring" as const, stiffness: 400, damping: 25 };

export function TopBar({ unreadCount, onBellClick, locationName = "Main Kitchen", lastCardType }: TopBarProps) {
  const [notifyColor, setNotifyColor] = useState<{ border: string; bg: string } | null>(null);
  const prevUnreadRef = useRef(unreadCount);
  const lastAnimTimeRef = useRef(0);

  // Play a short flash animation when unreadCount rises. React 19's
  // set-state-in-effect rule forbids calling setState synchronously inside
  // an effect body, so we schedule both the start and end of the flash via
  // setTimeout — the effect itself only schedules timers, it does not mutate
  // React state directly.
  useEffect(() => {
    const prev = prevUnreadRef.current;
    prevUnreadRef.current = unreadCount;
    if (unreadCount <= prev) return;
    const now = Date.now();
    if (now - lastAnimTimeRef.current < 500) return;
    lastAnimTimeRef.current = now;
    const colors = TYPE_COLORS[lastCardType ?? "info"] ?? TYPE_COLORS.info;
    const startTimer = setTimeout(() => setNotifyColor(colors), 0);
    const endTimer = setTimeout(() => setNotifyColor(null), 600);
    return () => {
      clearTimeout(startTimer);
      clearTimeout(endTimer);
    };
  }, [unreadCount, lastCardType]);

  return (
    <header className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-border bg-card/80 glass-subtle">
      {/* Left: Hamburger + Brand */}
      <div className="flex items-center gap-3">
        <MenuButton />
        <div className="flex items-center gap-2.5 select-none">
          <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-[10px] font-black tracking-tight leading-none shadow-sm">
            cOS
          </div>
          <span className="text-lg font-bold tracking-tight gradient-text-warm">
            CarabinerOS
          </span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Location */}
        <span className="text-sm text-muted-foreground hidden sm:block">
          {locationName}
        </span>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Dev: Agent Zero settings */}
        <a
          href="/a0/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent transition-colors"
          title="Agent Zero Settings (dev)"
        >
          <Settings className="size-4" />
        </a>

        {/* Action cards icon */}
        <div className="relative size-8 cursor-pointer group flex items-center justify-center" onClick={onBellClick} title="Action Cards">
          <motion.div
            initial="idle"
            animate="idle"
            whileHover="hovered"
            variants={parentVariants}
            className="relative"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 16 16"
              fill="none"
              className="text-muted-foreground/60 group-hover:text-foreground transition-colors"
            >
              <motion.rect
                x="2" y="1" width="9" height="12" rx="1.5"
                stroke={notifyColor?.border ?? "currentColor"}
                strokeWidth="1.5"
                opacity="0.4"
                variants={backCardVariants}
                transition={cardTransition}
                style={{ transformOrigin: "center" }}
              />
              <motion.rect
                x="5" y="3" width="9" height="12" rx="1.5"
                stroke="currentColor"
                strokeWidth="1.5"
                variants={frontCardVariants}
                transition={cardTransition}
                style={{ transformOrigin: "center" }}
              />
            </svg>
          </motion.div>
          {unreadCount > 0 && (
            <Badge
              className={`absolute -top-1 -right-1 z-[60] h-[18px] min-w-[18px] px-1 text-[10px] font-semibold border-none text-primary-foreground ${
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
          <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Action Cards
          </span>
        </div>
      </div>
    </header>
  );
}
