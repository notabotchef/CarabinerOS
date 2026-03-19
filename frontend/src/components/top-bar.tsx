"use client";

import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TopBarProps {
  unreadCount: number;
  onBellClick: () => void;
  locationName?: string;
}

export function TopBar({ unreadCount, onBellClick, locationName = "Main Kitchen" }: TopBarProps) {
  return (
    <header className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-border bg-card">
      {/* Left: Brand */}
      <span className="text-lg font-bold tracking-tight select-none text-primary">
        CarabinerOS
      </span>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Location */}
        <span className="text-sm text-muted-foreground hidden sm:block">
          {locationName}
        </span>

        {/* Notification bell */}
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground hover:bg-accent"
          onClick={onBellClick}
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-[18px] min-w-[18px] px-1 text-[10px] font-semibold bg-primary text-primary-foreground border-none"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </div>
    </header>
  );
}
