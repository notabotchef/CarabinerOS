"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ArrowRightLeft, GraduationCap } from "lucide-react";
import type { FoodCostItem } from "@/lib/api";

export type FoodCostAction = {
  type: "reprice" | "source-swap" | "retrain";
  item: FoodCostItem;
};

function pressureVariant(p: string) {
  if (p.includes("+++") || p.includes("High")) return "destructive" as const;
  if (p.includes("++") || p.includes("Med")) return "secondary" as const;
  return "outline" as const;
}

export function getFoodCostColumns(
  onAction?: (action: FoodCostAction) => void
): ColumnDef<FoodCostItem>[] {
  return [
    {
      accessorKey: "menu_item_name",
      header: "Menu Item",
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("menu_item_name")}</span>
      ),
    },
    {
      accessorKey: "pressure",
      header: "Pressure",
      cell: ({ row }) => (
        <Badge variant={pressureVariant(row.getValue("pressure"))}>
          {row.getValue("pressure")}
        </Badge>
      ),
    },
    { accessorKey: "current_cost_pct", header: "Cost %" },
    { accessorKey: "action", header: "Suggested Action" },
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
            header: "Execute",
            enableSorting: false,
            cell: ({ row }: { row: { original: FoodCostItem } }) => {
              const item = row.original;
              const action = item.action.toLowerCase();
              return (
                <div
                  className="flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  {action.includes("reprice") && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title="Reprice"
                      onClick={() => onAction({ type: "reprice", item })}
                    >
                      <RefreshCw className="size-3.5" />
                    </Button>
                  )}
                  {action.includes("source") && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title="Source swap"
                      onClick={() => onAction({ type: "source-swap", item })}
                    >
                      <ArrowRightLeft className="size-3.5" />
                    </Button>
                  )}
                  {action.includes("retrain") && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title="Retrain"
                      onClick={() => onAction({ type: "retrain", item })}
                    >
                      <GraduationCap className="size-3.5" />
                    </Button>
                  )}
                  {!action.includes("reprice") &&
                    !action.includes("source") &&
                    !action.includes("retrain") && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => onAction({ type: "reprice", item })}
                      >
                        Execute
                      </Button>
                    )}
                </div>
              );
            },
          } as ColumnDef<FoodCostItem>,
        ]
      : []),
  ];
}

// Backward compat
export const foodCostColumns = getFoodCostColumns();
