"use client";

import { useWorkspace } from "@/hooks/use-workspace";
import { WorkspaceTable } from "@/components/workspace-table";

const FALLBACK_KPIS = [
  { label: "Revenue", value: "$12,450", delta: "+8.2% vs last week" },
  { label: "COGS", value: "$3,890", delta: "31.2% of revenue" },
  { label: "Labor", value: "$3,112", delta: "25.0% of revenue" },
  { label: "Net Profit", value: "$2,845", delta: "22.8% margin" },
];

const FALLBACK_LINE_ITEMS: PLLineItem[] = [
  { category: "Food Sales", amount: "$9,200", percentage: "73.9%", period: "Daily" },
  { category: "Beverage Sales", amount: "$3,250", percentage: "26.1%", period: "Daily" },
  { category: "Meat & Poultry", amount: "$1,420", percentage: "11.4%", period: "Daily" },
  { category: "Produce", amount: "$890", percentage: "7.1%", period: "Daily" },
  { category: "Dairy", amount: "$640", percentage: "5.1%", period: "Daily" },
  { category: "Dry Goods", amount: "$540", percentage: "4.3%", period: "Daily" },
  { category: "Beverages (cost)", amount: "$400", percentage: "3.2%", period: "Daily" },
  { category: "Front of House", amount: "$1,870", percentage: "15.0%", period: "Daily" },
  { category: "Back of House", amount: "$1,242", percentage: "10.0%", period: "Daily" },
  { category: "Rent", amount: "$580", percentage: "4.7%", period: "Daily" },
  { category: "Utilities", amount: "$210", percentage: "1.7%", period: "Daily" },
  { category: "Insurance", amount: "$95", percentage: "0.8%", period: "Daily" },
];

type PLLineItem = {
  category: string;
  amount: string;
  percentage: string;
  period: string;
  [key: string]: unknown;
};

const COLUMNS = [
  { key: "category" as const, label: "Category" },
  { key: "amount" as const, label: "Amount ($)" },
  { key: "percentage" as const, label: "% of Revenue" },
  { key: "period" as const, label: "Period" },
];

export default function ReportingPage() {
  const { data, loading, error } = useWorkspace<PLLineItem>("/api/reporting/daily-pl");

  const lineItems = data.length > 0 ? data : FALLBACK_LINE_ITEMS;
  const showFallback = error || data.length === 0;

  return (
    <div className="flex flex-col h-dvh">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-lg font-bold text-foreground">Reporting</h1>
          <p className="text-sm text-muted-foreground">P&L dashboard and financial reports</p>
        </div>
      </header>
      <div className="flex-1 overflow-auto p-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {FALLBACK_KPIS.map((kpi) => (
            <div
              key={kpi.label}
              className="bg-card border border-border rounded-xl p-5"
            >
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-2">{kpi.delta}</p>
            </div>
          ))}
        </div>

        {/* Line Items Table */}
        {showFallback && !loading && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground mb-4">
            Showing sample data — API endpoint not connected yet
          </div>
        )}
        <WorkspaceTable
          columns={COLUMNS}
          data={showFallback && !loading ? lineItems : data}
          loading={loading}
          emptyMessage="No P&L data yet"
        />
      </div>
    </div>
  );
}
