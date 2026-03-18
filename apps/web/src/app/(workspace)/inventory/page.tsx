"use client";

import { useState } from "react";
import { useInventory } from "@/hooks/use-api";
import { useUpdateInventory } from "@/hooks/use-mutations";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useToast } from "@/components/ui/toast";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceKPICards } from "@/components/workspace/workspace-kpi-cards";
import { WorkspaceTable } from "@/components/workspace/workspace-table";
import { WorkspaceDetailPanel } from "@/components/workspace/workspace-detail-panel";
import {
  getInventoryColumns,
  type InventoryAction,
} from "@/components/workspace/columns/inventory-columns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { InventoryItem } from "@/lib/api";

export default function InventoryPage() {
  const locationId = useWorkspaceStore((s) => s.activeLocationId);
  const { data, isLoading } = useInventory(locationId);
  const updateInventory = useUpdateInventory();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editCount, setEditCount] = useState("");
  const selectedItem = data?.find((d) => d.id === selectedId);

  const items = data ?? [];
  const kpis = [
    {
      label: "Below par",
      value: items.filter((i) => i.variance.startsWith("-")).length,
    },
    {
      label: "Over par",
      value: items.filter((i) => i.variance.startsWith("+")).length,
    },
    { label: "Total items", value: items.length },
  ];

  function handleAction(action: InventoryAction) {
    if (action.type === "edit-count") {
      setEditingItem(action.item);
      setEditCount(action.item.on_hand);
    }
  }

  function submitCountEdit() {
    if (!editingItem || !editCount) return;
    const parNum = parseFloat(editingItem.par.replace(/[^-\d.]/g, ""));
    const newOnHand = parseFloat(editCount.replace(/[^-\d.]/g, ""));
    const variance =
      !isNaN(parNum) && !isNaN(newOnHand)
        ? `${newOnHand - parNum >= 0 ? "+" : ""}${(newOnHand - parNum).toFixed(0)}%`
        : editingItem.variance;

    updateInventory.mutate(
      { id: editingItem.id, on_hand: editCount, variance },
      {
        onSuccess: () => {
          toast({
            title: "Count updated",
            description: `${editingItem.item_name}: ${editCount}`,
            variant: "success",
          });
          setEditingItem(null);
        },
        onError: (err) =>
          toast({
            title: "Failed to update count",
            description: err.message,
            variant: "error",
          }),
      }
    );
  }

  function handleDetailCountEdit() {
    if (!selectedItem) return;
    setEditingItem(selectedItem);
    setEditCount(selectedItem.on_hand);
  }

  const columns = getInventoryColumns(handleAction);

  return (
    <>
      <WorkspaceHeader
        title="Inventory"
        subtitle="Par levels and variance tracking"
      />
      <div className="p-4 lg:p-6 space-y-6">
        <WorkspaceKPICards cards={kpis} />
        <WorkspaceTable
          columns={columns}
          data={items}
          isLoading={isLoading}
          onRowClick={(item: InventoryItem) => setSelectedId(item.id)}
          searchPlaceholder="Search inventory..."
        />
      </div>
      <WorkspaceDetailPanel
        open={!!selectedItem}
        onClose={() => setSelectedId(null)}
        title={selectedItem?.item_name ?? ""}
        fields={
          selectedItem
            ? [
                { label: "Item", value: selectedItem.item_name },
                { label: "On Hand", value: selectedItem.on_hand },
                { label: "Par", value: selectedItem.par },
                { label: "Variance", value: selectedItem.variance },
              ]
            : []
        }
        summary={selectedItem?.summary ?? null}
        detailPoints={selectedItem?.detail_points ?? null}
        prompt={selectedItem?.prompt ?? null}
        actions={
          selectedItem
            ? [
                {
                  label: "Edit Count",
                  variant: "default" as const,
                  onClick: handleDetailCountEdit,
                },
              ]
            : undefined
        }
      />

      {/* Inline count edit dialog */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setEditingItem(null)}
          />
          <div className="relative z-50 w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg">
            <h3 className="text-sm font-semibold mb-1">
              Update Count: {editingItem.item_name}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Current par: {editingItem.par}
            </p>
            <Input
              value={editCount}
              onChange={(e) => setEditCount(e.target.value)}
              placeholder="New on-hand count"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && submitCountEdit()}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingItem(null)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={submitCountEdit}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
