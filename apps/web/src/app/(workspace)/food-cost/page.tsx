"use client";

import { useState } from "react";
import { useFoodCost } from "@/hooks/use-api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceKPICards } from "@/components/workspace/workspace-kpi-cards";
import { WorkspaceTable } from "@/components/workspace/workspace-table";
import { WorkspaceDetailPanel } from "@/components/workspace/workspace-detail-panel";
import { foodCostColumns } from "@/components/workspace/columns/food-cost-columns";
import type { FoodCostItem } from "@/lib/api";

export default function FoodCostPage() {
  const locationId = useWorkspaceStore((s) => s.activeLocationId);
  const { data, isLoading } = useFoodCost(locationId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = data?.find((d) => d.id === selectedId);

  const items = data ?? [];
  const costValues = items.map((i) => parseFloat(i.current_cost_pct.replace("%", "")));
  const avgCost = costValues.length > 0 ? (costValues.reduce((a, b) => a + b, 0) / costValues.length).toFixed(1) + "%" : "—";

  const kpis = [
    { label: "Total alerts", value: items.length },
    { label: "Avg cost %", value: avgCost },
    { label: "Above target", value: items.filter((i) => i.pressure.includes("+")).length },
  ];

  return (
    <>
      <WorkspaceHeader title="Food Cost" subtitle="Margin pressure analysis" />
      <div className="p-6 space-y-6">
        <WorkspaceKPICards cards={kpis} />
        <WorkspaceTable
          columns={foodCostColumns}
          data={items}
          isLoading={isLoading}
          onRowClick={(item: FoodCostItem) => setSelectedId(item.id)}
        />
      </div>
      <WorkspaceDetailPanel
        open={!!selectedItem}
        onClose={() => setSelectedId(null)}
        title={selectedItem?.menu_item_name ?? ""}
        statusBadge={selectedItem ? { label: selectedItem.pressure } : undefined}
        fields={selectedItem ? [
          { label: "Menu Item", value: selectedItem.menu_item_name },
          { label: "Pressure", value: selectedItem.pressure },
          { label: "Cost %", value: selectedItem.current_cost_pct },
          { label: "Action", value: selectedItem.action },
        ] : []}
        summary={selectedItem?.summary ?? null}
        detailPoints={selectedItem?.detail_points ?? null}
        prompt={selectedItem?.prompt ?? null}
      />
    </>
  );
}
