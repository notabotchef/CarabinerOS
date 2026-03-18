"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { PrepTask } from "@/lib/api";

interface WorkspaceBoardProps {
  items: PrepTask[];
  isLoading: boolean;
  onCardClick?: (item: PrepTask) => void;
}

function readinessBadgeVariant(readiness: string) {
  switch (readiness.toLowerCase()) {
    case "ready":
      return "default" as const;
    case "at risk":
      return "secondary" as const;
    case "blocked":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export function WorkspaceBoard({
  items,
  isLoading,
  onCardClick,
}: WorkspaceBoardProps) {
  const lanes = items.reduce<Record<string, PrepTask[]>>((acc, item) => {
    const lane = item.service_lane;
    if (!acc[lane]) acc[lane] = [];
    acc[lane].push(item);
    return acc;
  }, {});

  const laneNames =
    Object.keys(lanes).length > 0
      ? Object.keys(lanes)
      : ["Brunch", "Dinner", "Happy hour"];

  if (isLoading) {
    return (
      <div className="flex gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 space-y-3">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto">
      {laneNames.map((lane) => {
        const laneItems = lanes[lane] ?? [];
        return (
          <div key={lane} className="min-w-[280px] flex-1">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold">{lane}</h3>
              <Badge variant="outline" className="text-xs">
                {laneItems.length}
              </Badge>
            </div>
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-2 pr-2">
                {laneItems.length === 0 && (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    No tasks
                  </p>
                )}
                {laneItems.map((item) => (
                  <Card
                    key={item.id}
                    className={
                      onCardClick
                        ? "cursor-pointer hover:bg-accent/50 transition-colors"
                        : ""
                    }
                    onClick={() => onCardClick?.(item)}
                    onKeyDown={(e) => {
                      if (
                        (e.key === "Enter" || e.key === " ") &&
                        onCardClick
                      ) {
                        e.preventDefault();
                        onCardClick(item);
                      }
                    }}
                    tabIndex={onCardClick ? 0 : undefined}
                  >
                    <CardContent className="p-3 space-y-1">
                      <Badge variant={readinessBadgeVariant(item.readiness)}>
                        {item.readiness}
                      </Badge>
                      <p className="text-sm font-medium">{item.task}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.station}
                      </p>
                      {item.shortage && item.shortage !== "No shortage" && (
                        <p className="text-xs text-destructive">
                          {item.shortage}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
