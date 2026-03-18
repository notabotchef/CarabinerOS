"use client";

import { useState } from "react";
import { useMarketing } from "@/hooks/use-api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceKPICards } from "@/components/workspace/workspace-kpi-cards";
import { WorkspaceTable } from "@/components/workspace/workspace-table";
import { WorkspaceDetailPanel } from "@/components/workspace/workspace-detail-panel";
import { marketingColumns } from "@/components/workspace/columns/marketing-columns";
import type { Campaign } from "@/lib/api";

export default function MarketingPage() {
  const locationId = useWorkspaceStore((s) => s.activeLocationId);
  const { data, isLoading } = useMarketing(locationId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = data?.find((d) => d.id === selectedId);

  const items = data ?? [];
  const count = (stage: string) => items.filter((i) => i.stage.toLowerCase() === stage).length;
  const kpis = [
    { label: "Drafting", value: count("drafting") },
    { label: "Research", value: count("research") },
    { label: "Ready for review", value: count("ready for review") },
  ];

  return (
    <>
      <WorkspaceHeader title="Marketing" subtitle="Campaign management" />
      <div className="p-6 space-y-6">
        <WorkspaceKPICards cards={kpis} />
        <WorkspaceTable
          columns={marketingColumns}
          data={items}
          isLoading={isLoading}
          onRowClick={(item: Campaign) => setSelectedId(item.id)}
        />
      </div>
      <WorkspaceDetailPanel
        open={!!selectedItem}
        onClose={() => setSelectedId(null)}
        title={selectedItem?.campaign_name ?? ""}
        statusBadge={selectedItem ? { label: selectedItem.stage } : undefined}
        fields={selectedItem ? [
          { label: "Campaign", value: selectedItem.campaign_name },
          { label: "Channel", value: selectedItem.channel },
          { label: "Stage", value: selectedItem.stage },
          { label: "Deliverable", value: selectedItem.deliverable },
        ] : []}
        summary={selectedItem?.summary ?? null}
        detailPoints={selectedItem?.detail_points ?? null}
        prompt={selectedItem?.prompt ?? null}
      />
    </>
  );
}
