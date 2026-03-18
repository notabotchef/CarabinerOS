"use client";

import { useState } from "react";
import { useInbox } from "@/hooks/use-api";
import { useUpdateInbox, useDeleteInbox } from "@/hooks/use-mutations";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useToast } from "@/components/ui/toast";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceKPICards } from "@/components/workspace/workspace-kpi-cards";
import { WorkspaceTable } from "@/components/workspace/workspace-table";
import { WorkspaceDetailPanel } from "@/components/workspace/workspace-detail-panel";
import {
  getInboxColumns,
  type InboxAction,
} from "@/components/workspace/columns/inbox-columns";
import { AlertDialog } from "@/components/ui/alert-dialog";
import type { InboxItem } from "@/lib/api";

export default function InboxPage() {
  const locationId = useWorkspaceStore((s) => s.activeLocationId);
  const { data, isLoading } = useInbox(locationId);
  const updateInbox = useUpdateInbox();
  const deleteInbox = useDeleteInbox();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDismiss, setConfirmDismiss] = useState<InboxItem | null>(null);
  const selectedItem = data?.find((d) => d.id === selectedId);

  const items = data ?? [];
  const kpis = [
    { label: "Total", value: items.length },
    {
      label: "High priority",
      value: items.filter((i) => i.priority.toLowerCase() === "high").length,
    },
    {
      label: "Open",
      value: items.filter((i) => i.status.toLowerCase() === "open").length,
    },
  ];

  function handleAction(action: InboxAction) {
    switch (action.type) {
      case "resolve":
        updateInbox.mutate(
          { id: action.item.id, status: "Resolved" },
          {
            onSuccess: () =>
              toast({
                title: "Item resolved",
                description: action.item.title,
                variant: "success",
              }),
            onError: (err) =>
              toast({
                title: "Failed to resolve",
                description: err.message,
                variant: "error",
                action: {
                  label: "Retry",
                  onClick: () => handleAction(action),
                },
              }),
          }
        );
        break;
      case "dismiss":
        setConfirmDismiss(action.item);
        break;
      case "escalate":
        updateInbox.mutate(
          { id: action.item.id, priority: "high", status: "Escalated" },
          {
            onSuccess: () =>
              toast({
                title: "Item escalated",
                description: `${action.item.title} set to high priority`,
                variant: "success",
              }),
            onError: (err) =>
              toast({
                title: "Failed to escalate",
                description: err.message,
                variant: "error",
                action: {
                  label: "Retry",
                  onClick: () => handleAction(action),
                },
              }),
          }
        );
        break;
      case "set-priority":
        if (action.priority) {
          updateInbox.mutate(
            { id: action.item.id, priority: action.priority },
            {
              onSuccess: () =>
                toast({
                  title: "Priority updated",
                  description: `Set to ${action.priority}`,
                  variant: "success",
                }),
              onError: (err) =>
                toast({
                  title: "Failed to update priority",
                  description: err.message,
                  variant: "error",
                }),
            }
          );
        }
        break;
    }
  }

  function handleDetailAction(type: "resolve" | "dismiss" | "escalate") {
    if (!selectedItem) return;
    handleAction({ type, item: selectedItem });
  }

  const columns = getInboxColumns(handleAction);

  return (
    <>
      <WorkspaceHeader
        title="Inbox"
        subtitle="Operational exceptions needing attention"
      />
      <div className="p-4 lg:p-6 space-y-6">
        <WorkspaceKPICards cards={kpis} />
        <WorkspaceTable
          columns={columns}
          data={items}
          isLoading={isLoading}
          onRowClick={(item: InboxItem) => setSelectedId(item.id)}
          searchPlaceholder="Search inbox..."
        />
      </div>
      <WorkspaceDetailPanel
        open={!!selectedItem}
        onClose={() => setSelectedId(null)}
        title={selectedItem?.title ?? ""}
        statusBadge={selectedItem ? { label: selectedItem.priority } : undefined}
        metaLine={
          selectedItem
            ? `${selectedItem.status} · ${selectedItem.module}`
            : undefined
        }
        fields={
          selectedItem
            ? [
                { label: "Priority", value: selectedItem.priority },
                { label: "Owner", value: selectedItem.owner ?? "Unassigned" },
                { label: "Status", value: selectedItem.status },
                { label: "Module", value: selectedItem.module },
              ]
            : []
        }
        summary={selectedItem?.summary ?? null}
        detailPoints={selectedItem?.detail_points ?? null}
        prompt={selectedItem?.prompt ?? null}
        actions={
          selectedItem && selectedItem.status.toLowerCase() === "open"
            ? [
                {
                  label: "Resolve",
                  variant: "default" as const,
                  onClick: () => handleDetailAction("resolve"),
                },
                {
                  label: "Escalate",
                  variant: "secondary" as const,
                  onClick: () => handleDetailAction("escalate"),
                },
                {
                  label: "Dismiss",
                  variant: "destructive" as const,
                  onClick: () => handleDetailAction("dismiss"),
                },
              ]
            : undefined
        }
      />
      <AlertDialog
        open={!!confirmDismiss}
        onOpenChange={() => setConfirmDismiss(null)}
        title="Dismiss item?"
        description={`This will permanently remove "${confirmDismiss?.title}" from your inbox.`}
        confirmLabel="Dismiss"
        variant="destructive"
        onConfirm={() => {
          if (confirmDismiss) {
            deleteInbox.mutate(confirmDismiss.id, {
              onSuccess: () => {
                toast({
                  title: "Item dismissed",
                  variant: "success",
                });
                setSelectedId(null);
              },
              onError: (err) =>
                toast({
                  title: "Failed to dismiss",
                  description: err.message,
                  variant: "error",
                }),
            });
          }
        }}
      />
    </>
  );
}
