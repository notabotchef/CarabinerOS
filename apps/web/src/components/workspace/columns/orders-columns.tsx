"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Send, Check, MoreHorizontal } from "lucide-react";
import type { Order } from "@/lib/api";

function statusVariant(s: string) {
  if (s.toLowerCase().includes("sent")) return "default" as const;
  if (s.toLowerCase().includes("ready")) return "secondary" as const;
  if (s.toLowerCase().includes("draft")) return "outline" as const;
  return "outline" as const;
}

export type OrderAction = {
  type: "approve" | "send" | "delete";
  order: Order;
};

export function getOrdersColumns(
  onAction?: (action: OrderAction) => void
): ColumnDef<Order>[] {
  return [
    {
      accessorKey: "vendor",
      header: "Vendor",
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("vendor")}</span>
      ),
    },
    { accessorKey: "channel", header: "Channel" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.getValue("status"))}>
          {row.getValue("status")}
        </Badge>
      ),
    },
    { accessorKey: "total", header: "Total" },
    { accessorKey: "eta", header: "ETA" },
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
            cell: ({ row }: { row: { original: Order } }) => {
              const order = row.original;
              const isDraft = order.status.toLowerCase().includes("draft");
              const isReady = order.status.toLowerCase().includes("ready");
              return (
                <div
                  className="flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  {isDraft && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title="Approve (mark Ready)"
                      onClick={() => onAction({ type: "approve", order })}
                    >
                      <Check className="size-3.5" />
                    </Button>
                  )}
                  {isReady && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title="Send order"
                      onClick={() => onAction({ type: "send", order })}
                    >
                      <Send className="size-3.5" />
                    </Button>
                  )}
                </div>
              );
            },
          } as ColumnDef<Order>,
        ]
      : []),
  ];
}

// Backward compat
export const ordersColumns = getOrdersColumns();
