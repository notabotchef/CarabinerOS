"use client";

import { useState } from "react";
import { useMenu } from "@/hooks/use-api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceKPICards } from "@/components/workspace/workspace-kpi-cards";
import { WorkspaceTable } from "@/components/workspace/workspace-table";
import { WorkspaceDetailPanel } from "@/components/workspace/workspace-detail-panel";
import { menuColumns } from "@/components/workspace/columns/menu-columns";
import type { MenuItem } from "@/lib/api";

export default function MenuPage() {
  const locationId = useWorkspaceStore((s) => s.activeLocationId);
  const { data, isLoading } = useMenu(locationId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = data?.find((d) => d.id === selectedId);

  const items = data ?? [];
  const count = (perf: string) => items.filter((i) => i.performance.toLowerCase() === perf).length;
  const kpis = [
    { label: "Stars", value: count("star") },
    { label: "Puzzles", value: count("puzzle") },
    { label: "Plowhorses", value: count("plowhorse") },
    { label: "Dogs", value: count("dog") },
  ];

  return (
    <>
      <WorkspaceHeader title="Menu" subtitle="Menu engineering analysis" />
      <div className="p-6 space-y-6">
        <WorkspaceKPICards cards={kpis} />
        <WorkspaceTable
          columns={menuColumns}
          data={items}
          isLoading={isLoading}
          onRowClick={(item: MenuItem) => setSelectedId(item.id)}
        />
      </div>
      <WorkspaceDetailPanel
        open={!!selectedItem}
        onClose={() => setSelectedId(null)}
        title={selectedItem?.item_name ?? ""}
        statusBadge={selectedItem ? { label: selectedItem.performance } : undefined}
        fields={selectedItem ? [
          { label: "Item", value: selectedItem.item_name },
          { label: "Category", value: selectedItem.category },
          { label: "Performance", value: selectedItem.performance },
          { label: "Margin", value: selectedItem.margin_pct },
        ] : []}
        summary={selectedItem?.summary ?? null}
        detailPoints={selectedItem?.detail_points ?? null}
        prompt={selectedItem?.prompt ?? null}
      />
    </>
  );
}
