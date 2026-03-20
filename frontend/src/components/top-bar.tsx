"use client";

import { motion } from "framer-motion";
import { Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MenuButton } from "@/components/menu-button";

interface TopBarProps {
  unreadCount: number;
  onBellClick: () => void;
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

export function TopBar({ unreadCount, onBellClick, locationName = "Main Kitchen" }: TopBarProps) {
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

        {/* Card duo notification icon */}
        <div className="relative w-8 h-[30px] cursor-pointer group" onClick={onBellClick} title="Action Cards">
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
          <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Action Cards
          </span>
        </div>
      </div>
    </header>
  );
}
