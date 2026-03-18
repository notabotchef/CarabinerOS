"use client";

import { useState } from "react";
import { useOrders } from "@/hooks/use-api";
import { useUpdateOrder, useDeleteOrder } from "@/hooks/use-mutations";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useToast } from "@/components/ui/toast";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceKPICards } from "@/components/workspace/workspace-kpi-cards";
import { WorkspaceTable } from "@/components/workspace/workspace-table";
import { WorkspaceDetailPanel } from "@/components/workspace/workspace-detail-panel";
import {
  getOrdersColumns,
  type OrderAction,
} from "@/components/workspace/columns/orders-columns";
import { AlertDialog } from "@/components/ui/alert-dialog";
import type { Order } from "@/lib/api";

export default function OrdersPage() {
  const locationId = useWorkspaceStore((s) => s.activeLocationId);
  const { data, isLoading } = useOrders(locationId);
  const updateOrder = useUpdateOrder();
  const deleteOrder = useDeleteOrder();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Order | null>(null);
  const selectedItem = data?.find((d) => d.id === selectedId);

  const items = data ?? [];
  const kpis = [
    {
      label: "Ready to send",
      value: items.filter((i) => i.status.toLowerCase().includes("ready"))
        .length,
    },
    {
      label: "Total value",
      value: items
        .reduce((sum, i) => {
          const n = parseFloat(i.total.replace(/[$,]/g, ""));
          return sum + (isNaN(n) ? 0 : n);
        }, 0)
        .toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }),
    },
    {
      label: "Drafting",
      value: items.filter((i) => i.status.toLowerCase().includes("draft"))
        .length,
    },
  ];

  function handleAction(action: OrderAction) {
    switch (action.type) {
      case "approve":
        updateOrder.mutate(
          { id: action.order.id, status: "Ready" },
          {
            onSuccess: () =>
              toast({
                title: "Order approved",
                description: `${action.order.vendor} marked as Ready`,
                variant: "success",
              }),
            onError: (err) =>
              toast({
                title: "Failed to approve order",
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
      case "send":
        updateOrder.mutate(
          { id: action.order.id, status: "Sent" },
          {
            onSuccess: () =>
              toast({
                title: "Order sent",
                description: `${action.order.vendor} order dispatched`,
                variant: "success",
              }),
            onError: (err) =>
              toast({
                title: "Failed to send order",
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
      case "delete":
        setConfirmDelete(action.order);
        break;
    }
  }

  function handleDetailAction(type: "approve" | "send" | "delete") {
    if (!selectedItem) return;
    handleAction({ type, order: selectedItem });
    if (type === "delete") return;
  }

  const columns = getOrdersColumns(handleAction);

  return (
    <>
      <WorkspaceHeader title="Orders" subtitle="Vendor orders and replenishment" />
      <div className="p-4 lg:p-6 space-y-6">
        <WorkspaceKPICards cards={kpis} />
        <WorkspaceTable
          columns={columns}
          data={items}
          isLoading={isLoading}
          onRowClick={(item: Order) => setSelectedId(item.id)}
          searchPlaceholder="Search orders..."
        />
      </div>
      <WorkspaceDetailPanel
        open={!!selectedItem}
        onClose={() => setSelectedId(null)}
        title={selectedItem?.vendor ?? ""}
        statusBadge={selectedItem ? { label: selectedItem.status } : undefined}
        metaLine={
          selectedItem
            ? `${selectedItem.channel} · ${selectedItem.total}`
            : undefined
        }
        fields={
          selectedItem
            ? [
                { label: "Vendor", value: selectedItem.vendor },
                { label: "Channel", value: selectedItem.channel },
                { label: "Total", value: selectedItem.total },
                { label: "ETA", value: selectedItem.eta ?? "\u2014" },
              ]
            : []
        }
        summary={selectedItem?.summary ?? null}
        detailPoints={selectedItem?.detail_points ?? null}
        prompt={selectedItem?.prompt ?? null}
        actions={
          selectedItem
            ? [
                ...(selectedItem.status.toLowerCase().includes("draft")
                  ? [
                      {
                        label: "Approve",
                        variant: "default" as const,
                        onClick: () => handleDetailAction("approve"),
                      },
                    ]
                  : []),
                ...(selectedItem.status.toLowerCase().includes("ready")
                  ? [
                      {
                        label: "Send Order",
                        variant: "default" as const,
                        onClick: () => handleDetailAction("send"),
                      },
                    ]
                  : []),
              ]
            : undefined
        }
      />
      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={() => setConfirmDelete(null)}
        title="Delete order?"
        description={`This will permanently delete the order for ${confirmDelete?.vendor}.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (confirmDelete) {
            deleteOrder.mutate(confirmDelete.id, {
              onSuccess: () =>
                toast({
                  title: "Order deleted",
                  variant: "success",
                }),
              onError: (err) =>
                toast({
                  title: "Failed to delete",
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
