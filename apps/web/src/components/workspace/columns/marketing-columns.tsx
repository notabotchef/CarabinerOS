"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import type { Campaign } from "@/lib/api";

const STAGE_ORDER = ["Research", "Drafting", "Review", "Live"];

function stageVariant(s: string) {
  switch (s.toLowerCase()) {
    case "live":
      return "default" as const;
    case "review":
    case "ready for review":
      return "secondary" as const;
    case "drafting":
      return "outline" as const;
    default:
      return "outline" as const;
  }
}

function getNextStage(current: string): string | null {
  const idx = STAGE_ORDER.findIndex(
    (s) => s.toLowerCase() === current.toLowerCase()
  );
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

export type MarketingAction = {
  type: "advance-stage";
  item: Campaign;
  nextStage: string;
};

export function getMarketingColumns(
  onAction?: (action: MarketingAction) => void
): ColumnDef<Campaign>[] {
  return [
    {
      accessorKey: "campaign_name",
      header: "Campaign",
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("campaign_name")}</span>
      ),
    },
    { accessorKey: "channel", header: "Channel" },
    {
      accessorKey: "stage",
      header: "Stage",
      cell: ({ row }) => (
        <Badge variant={stageVariant(row.getValue("stage"))}>
          {row.getValue("stage")}
        </Badge>
      ),
    },
    { accessorKey: "deliverable", header: "Deliverable" },
    {
      accessorKey: "summary",
      header: "Summary",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs line-clamp-1">
          {row.getValue("summary")}
        </span>
      ),
    },
    ...(onAction
      ? [
          {
            id: "actions",
            header: "Actions",
            enableSorting: false,
            cell: ({ row }: { row: { original: Campaign } }) => {
              const campaign = row.original;
              const next = getNextStage(campaign.stage);
              if (!next) return null;
              return (
                <div
                  className="flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() =>
                      onAction({
                        type: "advance-stage",
                        item: campaign,
                        nextStage: next,
                      })
                    }
                  >
                    {next} <ChevronRight className="size-3" />
                  </Button>
                </div>
              );
            },
          } as ColumnDef<Campaign>,
        ]
      : []),
  ];
}

// Backward compat
export const marketingColumns = getMarketingColumns();
