"use client";

import { Bell, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TopBarProps {
  unreadCount: number;
  onBellClick: () => void;
  onA0Click?: () => void;
  a0Open?: boolean;
  locationName?: string;
}

export function TopBar({ unreadCount, onBellClick, onA0Click, a0Open, locationName = "Main Kitchen" }: TopBarProps) {
  return (
    <header
      className="flex items-center justify-between px-5 py-3 shrink-0"
      style={{ backgroundColor: "#1a1a1a" }}
    >
      {/* Left: Brand */}
      <span
        className="text-lg font-bold tracking-tight select-none"
        style={{ color: "#f59e0b" }}
      >
        CarabinerOS
      </span>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Location */}
        <span className="text-sm text-neutral-400 hidden sm:block">
          {locationName}
        </span>

        {/* Agent Zero UI toggle */}
        <Button
          variant="ghost"
          size="icon"
          className={`text-neutral-300 hover:text-white hover:bg-white/10 ${a0Open ? "bg-white/10 text-amber-400" : ""}`}
          onClick={onA0Click}
          title="Agent Zero UI"
        >
          <Terminal className="size-5" />
        </Button>

        {/* Notification bell */}
        <Button
          variant="ghost"
          size="icon"
          className="relative text-neutral-300 hover:text-white hover:bg-white/10"
          onClick={onBellClick}
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-[18px] min-w-[18px] px-1 text-[10px] font-semibold bg-amber-500 text-white border-none"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </div>
    </header>
  );
}
