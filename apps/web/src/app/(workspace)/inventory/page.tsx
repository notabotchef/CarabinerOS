"use client";

import { useState } from "react";
import { useInventory } from "@/hooks/use-api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceKPICards } from "@/components/workspace/workspace-kpi-cards";
import { WorkspaceTable } from "@/components/workspace/workspace-table";
import { WorkspaceDetailPanel } from "@/components/workspace/workspace-detail-panel";
import { inventoryColumns } from "@/components/workspace/columns/inventory-columns";
import type { InventoryItem } from "@/lib/api";

export default function InventoryPage() {
  const locationId = useWorkspaceStore((s) => s.activeLocationId);
  const { data, isLoading } = useInventory(locationId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = data?.find((d) => d.id === selectedId);

  const items = data ?? [];
  const kpis = [
    { label: "Below par", value: items.filter((i) => i.variance.startsWith("-")).length },
    { label: "Over par", value: items.filter((i) => i.variance.startsWith("+")).length },
    { label: "Total items", value: items.length },
  ];

  return (
    <>
      <WorkspaceHeader title="Inventory" subtitle="Par levels and variance tracking" />
      <div className="p-6 space-y-6">
        <WorkspaceKPICards cards={kpis} />
        <WorkspaceTable
          columns={inventoryColumns}
          data={items}
          isLoading={isLoading}
          onRowClick={(item: InventoryItem) => setSelectedId(item.id)}
        />
      </div>
      <WorkspaceDetailPanel
        open={!!selectedItem}
        onClose={() => setSelectedId(null)}
        title={selectedItem?.item_name ?? ""}
        fields={selectedItem ? [
          { label: "Item", value: selectedItem.item_name },
          { label: "On Hand", value: selectedItem.on_hand },
          { label: "Par", value: selectedItem.par },
          { label: "Variance", value: selectedItem.variance },
        ] : []}
        summary={selectedItem?.summary ?? null}
        detailPoints={selectedItem?.detail_points ?? null}
        prompt={selectedItem?.prompt ?? null}
      />
    </>
  );
}
