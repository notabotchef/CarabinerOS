"use client";

import { motion } from "framer-motion";
import { PanelLeftOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TopBarProps {
  unreadCount: number;
  onBellClick: () => void;
  onMenuClick?: () => void;
  locationName?: string;
}

const parentVariants = {
  idle: {},
  hovered: {},
};

const backCardVariants = {
  idle: { rotate: 5, x: 0 },
  hovered: { rotate: 8, x: 2 },
};

const frontCardVariants = {
  idle: { rotate: -2, x: 0 },
  hovered: { rotate: -6, x: -2 },
};

const cardTransition = { type: "spring" as const, stiffness: 400, damping: 25 };

export function TopBar({ unreadCount, onBellClick, onMenuClick, locationName = "Main Kitchen" }: TopBarProps) {
  return (
    <header className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-border bg-card">
      {/* Left: Menu + Brand */}
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        )}
        <span className="text-lg font-bold tracking-tight select-none text-primary">
          CarabinerOS
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Location */}
        <span className="text-sm text-muted-foreground hidden sm:block">
          {locationName}
        </span>

        {/* Card duo notification icon */}
        <div className="relative w-8 h-[30px] cursor-pointer" onClick={onBellClick}>
          <motion.div
            initial="idle"
            animate="idle"
            whileHover="hovered"
            variants={parentVariants}
            className="relative w-full h-full"
          >
            {/* Back card */}
            <motion.div
              className="absolute w-[20px] h-[26px] rounded border-[1.8px] border-foreground/50 bg-card top-0 left-2 z-[1]"
              variants={backCardVariants}
              transition={cardTransition}
            />
            {/* Front card */}
            <motion.div
              className="absolute w-[20px] h-[26px] rounded border-[1.8px] border-foreground/50 bg-card top-[1px] left-[2px] z-[2]"
              variants={frontCardVariants}
              transition={cardTransition}
            />
          </motion.div>
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-[18px] min-w-[18px] px-1 text-[10px] font-semibold bg-primary text-primary-foreground border-none"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </header>
  );
}
