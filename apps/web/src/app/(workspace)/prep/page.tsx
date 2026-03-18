"use client";

import { useState } from "react";
import { usePrep } from "@/hooks/use-api";
import { useUpdatePrep } from "@/hooks/use-mutations";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useToast } from "@/components/ui/toast";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceKPICards } from "@/components/workspace/workspace-kpi-cards";
import { WorkspaceBoard } from "@/components/workspace/workspace-board";
import { WorkspaceDetailPanel } from "@/components/workspace/workspace-detail-panel";
import type { PrepTask } from "@/lib/api";

export default function PrepPage() {
  const locationId = useWorkspaceStore((s) => s.activeLocationId);
  const { data, isLoading } = usePrep(locationId);
  const updatePrep = useUpdatePrep();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = data?.find((d) => d.id === selectedId);

  const items = data ?? [];
  const kpis = [
    {
      label: "Ready",
      value: items.filter((i) => i.readiness.toLowerCase() === "ready").length,
    },
    {
      label: "At risk",
      value: items.filter((i) => i.readiness.toLowerCase() === "at risk")
        .length,
    },
    {
      label: "Blocked",
      value: items.filter((i) => i.readiness.toLowerCase() === "blocked")
        .length,
    },
    {
      label: "Complete",
      value: items.filter((i) => i.readiness.toLowerCase() === "complete")
        .length,
    },
  ];

  function toggleReadiness(task: PrepTask) {
    const next =
      task.readiness.toLowerCase() === "ready"
        ? "Complete"
        : task.readiness.toLowerCase() === "blocked"
          ? "At Risk"
          : task.readiness.toLowerCase() === "at risk"
            ? "Ready"
            : "Ready";

    updatePrep.mutate(
      { id: task.id, readiness: next },
      {
        onSuccess: () =>
          toast({
            title: `${task.task}`,
            description: `Readiness set to ${next}`,
            variant: "success",
          }),
        onError: (err) =>
          toast({
            title: "Failed to update readiness",
            description: err.message,
            variant: "error",
          }),
      }
    );
  }

  function markComplete() {
    if (!selectedItem) return;
    updatePrep.mutate(
      { id: selectedItem.id, readiness: "Complete" },
      {
        onSuccess: () => {
          toast({
            title: "Task completed",
            description: selectedItem.task,
            variant: "success",
          });
          setSelectedId(null);
        },
        onError: (err) =>
          toast({
            title: "Failed to complete task",
            description: err.message,
            variant: "error",
          }),
      }
    );
  }

  return (
    <>
      <WorkspaceHeader title="Prep" subtitle="Prep tasks by service lane" />
      <div className="p-4 lg:p-6 space-y-6">
        <WorkspaceKPICards cards={kpis} />
        <WorkspaceBoard
          items={items}
          isLoading={isLoading}
          onCardClick={(item: PrepTask) => setSelectedId(item.id)}
          onToggleReadiness={toggleReadiness}
        />
      </div>
      <WorkspaceDetailPanel
        open={!!selectedItem}
        onClose={() => setSelectedId(null)}
        title={selectedItem?.task ?? ""}
        statusBadge={
          selectedItem ? { label: selectedItem.readiness } : undefined
        }
        fields={
          selectedItem
            ? [
                { label: "Lane", value: selectedItem.service_lane },
                { label: "Station", value: selectedItem.station },
                { label: "Readiness", value: selectedItem.readiness },
                { label: "Shortage", value: selectedItem.shortage ?? "None" },
              ]
            : []
        }
        summary={selectedItem?.summary ?? null}
        detailPoints={selectedItem?.detail_points ?? null}
        prompt={selectedItem?.prompt ?? null}
        actions={
          selectedItem &&
          selectedItem.readiness.toLowerCase() !== "complete"
            ? [
                {
                  label: "Mark Complete",
                  variant: "default" as const,
                  onClick: markComplete,
                },
                {
                  label: "Toggle Readiness",
                  variant: "secondary" as const,
                  onClick: () => toggleReadiness(selectedItem),
                },
              ]
            : undefined
        }
      />
    </>
  );
}
