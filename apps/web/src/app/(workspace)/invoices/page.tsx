"use client";

import { useState } from "react";
import { useInvoices } from "@/hooks/use-api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceKPICards } from "@/components/workspace/workspace-kpi-cards";
import { WorkspaceTable } from "@/components/workspace/workspace-table";
import { WorkspaceDetailPanel } from "@/components/workspace/workspace-detail-panel";
import { invoicesColumns } from "@/components/workspace/columns/invoices-columns";
import type { Invoice } from "@/lib/api";

export default function InvoicesPage() {
  const locationId = useWorkspaceStore((s) => s.activeLocationId);
  const { data, isLoading } = useInvoices(locationId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = data?.find((d) => d.id === selectedId);

  const items = data ?? [];

  const totalValue = items.reduce((sum, i) => {
    const n = parseFloat(i.total.replace(/[$,]/g, ""));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  const kpis = [
    { label: "Total invoices", value: items.length },
    {
      label: "Total value",
      value: totalValue.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }),
    },
    {
      label: "Pending approval",
      value: items.filter((i) => i.status === "Matched").length,
    },
    {
      label: "Disputed",
      value: items.filter((i) => i.status === "Disputed").length,
    },
  ];

  // Build detail fields with extra invoice info
  const detailFields = selectedItem
    ? [
        { label: "Vendor", value: selectedItem.vendor },
        { label: "Invoice #", value: selectedItem.invoice_number ?? "---" },
        { label: "Date", value: selectedItem.invoice_date },
        { label: "Due Date", value: selectedItem.due_date ?? "---" },
        { label: "Total", value: selectedItem.total },
        { label: "PO Match", value: selectedItem.po_match_id ?? "No match" },
      ]
    : [];

  // Build extended detail points including line items and GL codes
  const extendedDetails: string[] = [];
  if (selectedItem?.detail_points) {
    extendedDetails.push(...selectedItem.detail_points);
  }
  if (selectedItem?.variance_notes) {
    extendedDetails.push(`Variance: ${selectedItem.variance_notes}`);
  }
  if (selectedItem?.line_items && selectedItem.line_items.length > 0) {
    extendedDetails.push(
      `Line items (${selectedItem.line_items.length}): ${selectedItem.line_items.map((li) => li.description).join(", ")}`
    );
  }
  if (selectedItem?.gl_codes && selectedItem.gl_codes.length > 0) {
    extendedDetails.push(
      `GL codes: ${selectedItem.gl_codes.map((gl) => `${gl.code} ${gl.name}`).join(", ")}`
    );
  }

  return (
    <>
      <WorkspaceHeader
        title="Invoices"
        subtitle="Invoice processing & accounts payable"
      />
      <div className="p-6 space-y-6">
        <WorkspaceKPICards cards={kpis} />
        <WorkspaceTable
          columns={invoicesColumns}
          data={items}
          isLoading={isLoading}
          onRowClick={(item: Invoice) => setSelectedId(item.id)}
        />
      </div>
      <WorkspaceDetailPanel
        open={!!selectedItem}
        onClose={() => setSelectedId(null)}
        title={selectedItem?.vendor ?? ""}
        statusBadge={
          selectedItem ? { label: selectedItem.status } : undefined
        }
        metaLine={
          selectedItem
            ? `${selectedItem.invoice_number ?? "No invoice #"} · ${selectedItem.total}`
            : undefined
        }
        fields={detailFields}
        summary={selectedItem?.summary ?? null}
        detailPoints={extendedDetails.length > 0 ? extendedDetails : null}
        prompt={selectedItem?.prompt ?? null}
      />
    </>
  );
}
