"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import type { InboxItem } from "@/lib/api";

function priorityVariant(p: string) {
  switch (p.toLowerCase()) {
    case "high":
      return "destructive" as const;
    case "medium":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

export type InboxAction = {
  type: "resolve" | "dismiss" | "escalate" | "set-priority";
  item: InboxItem;
  priority?: string;
};

export function getInboxColumns(
  onAction?: (action: InboxAction) => void
): ColumnDef<InboxItem>[] {
  return [
    { accessorKey: "title", header: "Title" },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => (
        <Badge variant={priorityVariant(row.getValue("priority"))}>
          {row.getValue("priority")}
        </Badge>
      ),
    },
    { accessorKey: "owner", header: "Owner" },
    { accessorKey: "status", header: "Status" },
    {
      accessorKey: "module",
      header: "Module",
      cell: ({ row }) => (
        <Badge variant="outline">{row.getValue("module")}</Badge>
      ),
    },
    ...(onAction
      ? [
          {
            id: "actions",
            header: "Actions",
            enableSorting: false,
            cell: ({ row }: { row: { original: InboxItem } }) => {
              const item = row.original;
              const isOpen = item.status.toLowerCase() === "open";
              return (
                <div
                  className="flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  {isOpen && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="Resolve"
                        onClick={() => onAction({ type: "resolve", item })}
                      >
                        <CheckCircle className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="Dismiss"
                        onClick={() => onAction({ type: "dismiss", item })}
                      >
                        <XCircle className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="Escalate"
                        onClick={() => onAction({ type: "escalate", item })}
                      >
                        <AlertTriangle className="size-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              );
            },
          } as ColumnDef<InboxItem>,
        ]
      : []),
  ];
}

// Backward compat
export const inboxColumns = getInboxColumns();
