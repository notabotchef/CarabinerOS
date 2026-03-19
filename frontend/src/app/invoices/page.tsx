"use client";

import { useWorkspace } from "@/hooks/use-workspace";
import { WorkspaceTable } from "@/components/workspace-table";

interface Invoice {
  [key: string]: unknown;
  vendor: string;
  total: number;
  line_items: number;
  status: string;
  date: string;
  match_status: string;
}

const COLUMNS = [
  { key: "vendor" as const, label: "Vendor" },
  {
    key: "total" as const,
    label: "Total",
    render: (v: unknown) => (v != null ? `$${Number(v).toFixed(2)}` : "\u2014"),
  },
  { key: "line_items" as const, label: "Line Items" },
  { key: "status" as const, label: "Status" },
  { key: "date" as const, label: "Date" },
  { key: "match_status" as const, label: "Match" },
];

export default function InvoicesPage() {
  const { data, loading, error } = useWorkspace<Invoice>("/api/invoices");

  return (
    <div className="flex flex-col h-dvh">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-lg font-bold text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Invoice processing and vendor matching
          </p>
        </div>
      </header>
      <div className="flex-1 overflow-auto p-6">
        {error && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground mb-4">
            No data available — API endpoint not connected yet
          </div>
        )}
        <WorkspaceTable
          columns={COLUMNS}
          data={data}
          loading={loading}
          emptyMessage="No invoices yet"
        />
      </div>
    </div>
  );
}
