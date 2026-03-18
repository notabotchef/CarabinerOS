"use client";

import { useState } from "react";
import { useOrders } from "@/hooks/use-api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceKPICards } from "@/components/workspace/workspace-kpi-cards";
import { WorkspaceTable } from "@/components/workspace/workspace-table";
import { WorkspaceDetailPanel } from "@/components/workspace/workspace-detail-panel";
import { ordersColumns } from "@/components/workspace/columns/orders-columns";
import type { Order } from "@/lib/api";

export default function OrdersPage() {
  const locationId = useWorkspaceStore((s) => s.activeLocationId);
  const { data, isLoading } = useOrders(locationId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = data?.find((d) => d.id === selectedId);

  const items = data ?? [];
  const kpis = [
    { label: "Ready to send", value: items.filter((i) => i.status.toLowerCase().includes("ready")).length },
    {
      label: "Total value",
      value: items
        .reduce((sum, i) => {
          const n = parseFloat(i.total.replace(/[$,]/g, ""));
          return sum + (isNaN(n) ? 0 : n);
        }, 0)
        .toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
    },
    { label: "Drafting", value: items.filter((i) => i.status.toLowerCase().includes("draft")).length },
  ];

  return (
    <>
      <WorkspaceHeader title="Orders" subtitle="Vendor orders and replenishment" />
      <div className="p-6 space-y-6">
        <WorkspaceKPICards cards={kpis} />
        <WorkspaceTable
          columns={ordersColumns}
          data={items}
          isLoading={isLoading}
          onRowClick={(item: Order) => setSelectedId(item.id)}
        />
      </div>
      <WorkspaceDetailPanel
        open={!!selectedItem}
        onClose={() => setSelectedId(null)}
        title={selectedItem?.vendor ?? ""}
        statusBadge={selectedItem ? { label: selectedItem.status } : undefined}
        metaLine={selectedItem ? `${selectedItem.channel} · ${selectedItem.total}` : undefined}
        fields={selectedItem ? [
          { label: "Vendor", value: selectedItem.vendor },
          { label: "Channel", value: selectedItem.channel },
          { label: "Total", value: selectedItem.total },
          { label: "ETA", value: selectedItem.eta ?? "—" },
        ] : []}
        summary={selectedItem?.summary ?? null}
        detailPoints={selectedItem?.detail_points ?? null}
        prompt={selectedItem?.prompt ?? null}
      />
    </>
  );
}
