"use client";

import { useState } from "react";
import { useMarketing } from "@/hooks/use-api";
import { useUpdateCampaign } from "@/hooks/use-mutations";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useToast } from "@/components/ui/toast";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceKPICards } from "@/components/workspace/workspace-kpi-cards";
import { WorkspaceTable } from "@/components/workspace/workspace-table";
import { WorkspaceDetailPanel } from "@/components/workspace/workspace-detail-panel";
import {
  getMarketingColumns,
  type MarketingAction,
} from "@/components/workspace/columns/marketing-columns";
import type { Campaign } from "@/lib/api";

const STAGE_ORDER = ["Research", "Drafting", "Review", "Live"];

function getNextStage(current: string): string | null {
  const idx = STAGE_ORDER.findIndex(
    (s) => s.toLowerCase() === current.toLowerCase()
  );
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

export default function MarketingPage() {
  const locationId = useWorkspaceStore((s) => s.activeLocationId);
  const { data, isLoading } = useMarketing(locationId);
  const updateCampaign = useUpdateCampaign();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = data?.find((d) => d.id === selectedId);

  const items = data ?? [];
  const count = (stage: string) =>
    items.filter((i) => i.stage.toLowerCase() === stage).length;
  const kpis = [
    { label: "Research", value: count("research") },
    { label: "Drafting", value: count("drafting") },
    { label: "Review", value: count("review") },
    { label: "Live", value: count("live") },
  ];

  function handleAction(action: MarketingAction) {
    updateCampaign.mutate(
      { id: action.item.id, stage: action.nextStage },
      {
        onSuccess: () =>
          toast({
            title: "Stage advanced",
            description: `${action.item.campaign_name} moved to ${action.nextStage}`,
            variant: "success",
          }),
        onError: (err) =>
          toast({
            title: "Failed to advance stage",
            description: err.message,
            variant: "error",
            action: {
              label: "Retry",
              onClick: () => handleAction(action),
            },
          }),
      }
    );
  }

  function handleDetailAdvance() {
    if (!selectedItem) return;
    const next = getNextStage(selectedItem.stage);
    if (next) {
      handleAction({
        type: "advance-stage",
        item: selectedItem,
        nextStage: next,
      });
    }
  }

  const columns = getMarketingColumns(handleAction);

  return (
    <>
      <WorkspaceHeader title="Marketing" subtitle="Campaign management" />
      <div className="p-6 space-y-6">
        <WorkspaceKPICards cards={kpis} />
        <WorkspaceTable
          columns={columns}
          data={items}
          isLoading={isLoading}
          onRowClick={(item: Campaign) => setSelectedId(item.id)}
          searchPlaceholder="Search campaigns..."
        />
      </div>
      <WorkspaceDetailPanel
        open={!!selectedItem}
        onClose={() => setSelectedId(null)}
        title={selectedItem?.campaign_name ?? ""}
        statusBadge={
          selectedItem ? { label: selectedItem.stage } : undefined
        }
        fields={
          selectedItem
            ? [
                { label: "Campaign", value: selectedItem.campaign_name },
                { label: "Channel", value: selectedItem.channel },
                { label: "Stage", value: selectedItem.stage },
                { label: "Deliverable", value: selectedItem.deliverable },
              ]
            : []
        }
        summary={selectedItem?.summary ?? null}
        detailPoints={selectedItem?.detail_points ?? null}
        prompt={selectedItem?.prompt ?? null}
        actions={
          selectedItem && getNextStage(selectedItem.stage)
            ? [
                {
                  label: `Advance to ${getNextStage(selectedItem.stage)}`,
                  variant: "default" as const,
                  onClick: handleDetailAdvance,
                },
              ]
            : undefined
        }
      />
    </>
  );
}
