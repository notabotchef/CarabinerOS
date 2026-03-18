"use client";

import { useState } from "react";
import { usePrep } from "@/hooks/use-api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceKPICards } from "@/components/workspace/workspace-kpi-cards";
import { WorkspaceBoard } from "@/components/workspace/workspace-board";
import { WorkspaceDetailPanel } from "@/components/workspace/workspace-detail-panel";
import type { PrepTask } from "@/lib/api";

export default function PrepPage() {
  const locationId = useWorkspaceStore((s) => s.activeLocationId);
  const { data, isLoading } = usePrep(locationId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = data?.find((d) => d.id === selectedId);

  const items = data ?? [];
  const kpis = [
    { label: "Ready", value: items.filter((i) => i.readiness.toLowerCase() === "ready").length },
    { label: "At risk", value: items.filter((i) => i.readiness.toLowerCase() === "at risk").length },
    { label: "Blocked", value: items.filter((i) => i.readiness.toLowerCase() === "blocked").length },
  ];

  return (
    <>
      <WorkspaceHeader title="Prep" subtitle="Prep tasks by service lane" />
      <div className="p-6 space-y-6">
        <WorkspaceKPICards cards={kpis} />
        <WorkspaceBoard
          items={items}
          isLoading={isLoading}
          onCardClick={(item: PrepTask) => setSelectedId(item.id)}
        />
      </div>
      <WorkspaceDetailPanel
        open={!!selectedItem}
        onClose={() => setSelectedId(null)}
        title={selectedItem?.task ?? ""}
        statusBadge={selectedItem ? { label: selectedItem.readiness } : undefined}
        fields={selectedItem ? [
          { label: "Lane", value: selectedItem.service_lane },
          { label: "Station", value: selectedItem.station },
          { label: "Readiness", value: selectedItem.readiness },
          { label: "Shortage", value: selectedItem.shortage ?? "None" },
        ] : []}
        summary={selectedItem?.summary ?? null}
        detailPoints={selectedItem?.detail_points ?? null}
        prompt={selectedItem?.prompt ?? null}
      />
    </>
  );
}
