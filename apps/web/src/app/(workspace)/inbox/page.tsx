"use client";

import { useState } from "react";
import { useInbox } from "@/hooks/use-api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceKPICards } from "@/components/workspace/workspace-kpi-cards";
import { WorkspaceTable } from "@/components/workspace/workspace-table";
import { WorkspaceDetailPanel } from "@/components/workspace/workspace-detail-panel";
import { inboxColumns } from "@/components/workspace/columns/inbox-columns";
import type { InboxItem } from "@/lib/api";

export default function InboxPage() {
  const locationId = useWorkspaceStore((s) => s.activeLocationId);
  const { data, isLoading } = useInbox(locationId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = data?.find((d) => d.id === selectedId);

  const items = data ?? [];
  const kpis = [
    { label: "Total", value: items.length },
    { label: "High priority", value: items.filter((i) => i.priority.toLowerCase() === "high").length },
    { label: "Needs review", value: items.filter((i) => i.status.toLowerCase().includes("review")).length },
  ];

  return (
    <>
      <WorkspaceHeader title="Inbox" subtitle="Operational exceptions needing attention" />
      <div className="p-6 space-y-6">
        <WorkspaceKPICards cards={kpis} />
        <WorkspaceTable
          columns={inboxColumns}
          data={items}
          isLoading={isLoading}
          onRowClick={(item: InboxItem) => setSelectedId(item.id)}
        />
      </div>
      <WorkspaceDetailPanel
        open={!!selectedItem}
        onClose={() => setSelectedId(null)}
        title={selectedItem?.title ?? ""}
        statusBadge={selectedItem ? { label: selectedItem.priority } : undefined}
        metaLine={selectedItem ? `${selectedItem.status} · ${selectedItem.module}` : undefined}
        fields={selectedItem ? [
          { label: "Priority", value: selectedItem.priority },
          { label: "Owner", value: selectedItem.owner ?? "Unassigned" },
          { label: "Status", value: selectedItem.status },
          { label: "Module", value: selectedItem.module },
        ] : []}
        summary={selectedItem?.summary ?? null}
        detailPoints={selectedItem?.detail_points ?? null}
        prompt={selectedItem?.prompt ?? null}
      />
    </>
  );
}
