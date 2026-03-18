"use client";

import { useState } from "react";
import { useMenu } from "@/hooks/use-api";
import { useUpdateMenu } from "@/hooks/use-mutations";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useToast } from "@/components/ui/toast";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceKPICards } from "@/components/workspace/workspace-kpi-cards";
import { WorkspaceTable } from "@/components/workspace/workspace-table";
import { WorkspaceDetailPanel } from "@/components/workspace/workspace-detail-panel";
import {
  getMenuColumns,
  type MenuAction,
} from "@/components/workspace/columns/menu-columns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { MenuItem } from "@/lib/api";

const PERFORMANCE_OPTIONS = [
  { value: "Star", label: "Star" },
  { value: "Puzzle", label: "Puzzle" },
  { value: "Plowhorse", label: "Plowhorse" },
  { value: "Dog", label: "Dog" },
];

export default function MenuPage() {
  const locationId = useWorkspaceStore((s) => s.activeLocationId);
  const { data, isLoading } = useMenu(locationId);
  const updateMenu = useUpdateMenu();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editType, setEditType] = useState<"performance" | "price" | null>(
    null
  );
  const [editValue, setEditValue] = useState("");
  const selectedItem = data?.find((d) => d.id === selectedId);

  const items = data ?? [];
  const count = (perf: string) =>
    items.filter((i) => i.performance.toLowerCase() === perf).length;
  const kpis = [
    { label: "Stars", value: count("star") },
    { label: "Puzzles", value: count("puzzle") },
    { label: "Plowhorses", value: count("plowhorse") },
    { label: "Dogs", value: count("dog") },
  ];

  function handleAction(action: MenuAction) {
    setEditingItem(action.item);
    if (action.type === "edit-performance") {
      setEditType("performance");
      setEditValue(action.item.performance);
    } else {
      setEditType("price");
      setEditValue(action.item.margin_pct);
    }
  }

  function submitEdit() {
    if (!editingItem || !editType) return;
    const updates: Record<string, unknown> = { id: editingItem.id };
    if (editType === "performance") {
      updates.performance = editValue;
    } else {
      updates.margin_pct = editValue;
    }

    updateMenu.mutate(updates as { id: string } & Record<string, unknown>, {
      onSuccess: () => {
        toast({
          title:
            editType === "performance"
              ? "Performance updated"
              : "Price adjusted",
          description: editingItem.item_name,
          variant: "success",
        });
        setEditingItem(null);
        setEditType(null);
      },
      onError: (err) =>
        toast({
          title: "Failed to update",
          description: err.message,
          variant: "error",
        }),
    });
  }

  const columns = getMenuColumns(handleAction);

  return (
    <>
      <WorkspaceHeader title="Menu" subtitle="Menu engineering analysis" />
      <div className="p-4 lg:p-6 space-y-6">
        <WorkspaceKPICards cards={kpis} />
        <WorkspaceTable
          columns={columns}
          data={items}
          isLoading={isLoading}
          onRowClick={(item: MenuItem) => setSelectedId(item.id)}
          searchPlaceholder="Search menu items..."
        />
      </div>
      <WorkspaceDetailPanel
        open={!!selectedItem}
        onClose={() => setSelectedId(null)}
        title={selectedItem?.item_name ?? ""}
        statusBadge={
          selectedItem ? { label: selectedItem.performance } : undefined
        }
        fields={
          selectedItem
            ? [
                { label: "Item", value: selectedItem.item_name },
                { label: "Category", value: selectedItem.category },
                { label: "Performance", value: selectedItem.performance },
                { label: "Margin", value: selectedItem.margin_pct },
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
                  label: "Edit Performance",
                  variant: "default" as const,
                  onClick: () => {
                    if (selectedItem)
                      handleAction({
                        type: "edit-performance",
                        item: selectedItem,
                      });
                  },
                },
                {
                  label: "Adjust Price",
                  variant: "secondary" as const,
                  onClick: () => {
                    if (selectedItem)
                      handleAction({
                        type: "adjust-price",
                        item: selectedItem,
                      });
                  },
                },
              ]
            : undefined
        }
      />

      {/* Edit dialog */}
      {editingItem && editType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => {
              setEditingItem(null);
              setEditType(null);
            }}
          />
          <div className="relative z-50 w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg">
            <h3 className="text-sm font-semibold mb-4">
              {editType === "performance"
                ? "Edit Performance Badge"
                : "Adjust Margin %"}{" "}
              \u2014 {editingItem.item_name}
            </h3>
            {editType === "performance" ? (
              <Select
                options={PERFORMANCE_OPTIONS}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
              />
            ) : (
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="e.g. 32%"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && submitEdit()}
              />
            )}
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setEditType(null);
                }}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={submitEdit}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
