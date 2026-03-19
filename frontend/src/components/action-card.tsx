"use client";

import { Button } from "@/components/ui/button";
import type { ActionCard as ActionCardType } from "@/lib/types";

interface ActionCardProps {
  card: ActionCardType;
  onAction?: (action: string) => void;
}

function getTypeColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("alert") || t.includes("warn") || t.includes("approve")) {
    return "text-amber-600 bg-amber-50";
  }
  if (t.includes("order") || t.includes("create") || t.includes("update")) {
    return "text-blue-600 bg-blue-50";
  }
  if (t.includes("complete") || t.includes("done") || t.includes("success")) {
    return "text-emerald-600 bg-emerald-50";
  }
  return "text-neutral-600 bg-neutral-50";
}

function relativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = Math.max(0, now - timestamp);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function ActionCard({ card, onAction }: ActionCardProps) {
  const typeColor = getTypeColor(card.type);

  return (
    <div className="rounded-lg border border-neutral-150 bg-white p-4 transition-shadow hover:shadow-sm">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${typeColor}`}
        >
          {card.type}
        </span>
        <span className="text-[11px] text-neutral-400">
          {relativeTime(card.timestamp)}
        </span>
      </div>

      {/* Summary */}
      <p className="text-sm leading-relaxed text-neutral-700 mb-3">
        {card.summary}
      </p>

      {/* Actions */}
      {onAction && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="bg-neutral-900 text-white hover:bg-neutral-700 text-xs"
            onClick={() => onAction("primary")}
          >
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => onAction("dismiss")}
          >
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}
