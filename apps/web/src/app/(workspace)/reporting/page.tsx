"use client";

import { useState, useMemo } from "react";
import {
  useReportingPL,
  useReportingSummary,
  useReportingTrends,
  useReportingVariance,
} from "@/hooks/use-api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceKPICards } from "@/components/workspace/workspace-kpi-cards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import type { DailyPLRow, TrendPoint, BudgetVariance } from "@/lib/api";

// --- Date range presets ---
type DateRange = "7d" | "14d" | "30d";

function getDateRange(range: DateRange): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  switch (range) {
    case "7d":
      start.setDate(end.getDate() - 7);
      break;
    case "14d":
      start.setDate(end.getDate() - 14);
      break;
    case "30d":
      start.setDate(end.getDate() - 30);
      break;
  }
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

const rangeLabels: Record<DateRange, string> = {
  "7d": "Last 7 days",
  "14d": "Last 14 days",
  "30d": "Last 30 days",
};

// --- Chart configs ---
const trendChartConfig = {
  food_cost_pct: { label: "Food Cost %", color: "hsl(0 72% 51%)" },
  labor_pct: { label: "Labor %", color: "hsl(221 83% 53%)" },
};

const varianceChartConfig = {
  actual: { label: "Actual", color: "hsl(0 72% 51%)" },
  target: { label: "Target", color: "hsl(142 71% 45%)" },
};

// --- Formatters ---
function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "--";
  return `${n.toFixed(1)}%`;
}

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// --- Components ---

function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
}) {
  return (
    <div className="flex gap-1">
      {(["7d", "14d", "30d"] as DateRange[]).map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            value === r
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          {rangeLabels[r]}
        </button>
      ))}
    </div>
  );
}

function CostTrendChart({ data }: { data: TrendPoint[] }) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        date: fmtDate(d.date),
        food_cost_pct: d.food_cost_pct,
        labor_pct: d.labor_pct,
      })),
    [data],
  );

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
        No trend data available
      </div>
    );
  }

  return (
    <ChartContainer config={trendChartConfig} className="h-[300px] w-full">
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => `${v}%`}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          type="monotone"
          dataKey="food_cost_pct"
          stroke="var(--color-food_cost_pct)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="labor_pct"
          stroke="var(--color-labor_pct)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

function BudgetVarianceChart({ data }: { data: BudgetVariance[] }) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        location: d.location_name,
        actual: d.actual_food_cost_pct,
        target: d.target_food_cost_pct,
      })),
    [data],
  );

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
        No variance data available
      </div>
    );
  }

  return (
    <ChartContainer config={varianceChartConfig} className="h-[300px] w-full">
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="location" tick={{ fontSize: 11 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => `${v}%`}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="actual" fill="var(--color-actual)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="target" fill="var(--color-target)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function VarianceTable({ data }: { data: BudgetVariance[] }) {
  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Budget vs Actual Variance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Rev Var</TableHead>
                <TableHead className="text-right">Food Cost %</TableHead>
                <TableHead className="text-right">FC Target</TableHead>
                <TableHead className="text-right">FC Var</TableHead>
                <TableHead className="text-right">Labor %</TableHead>
                <TableHead className="text-right">Labor Target</TableHead>
                <TableHead className="text-right">Labor Var</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((v) => (
                <TableRow key={v.location_id}>
                  <TableCell className="font-medium">{v.location_name}</TableCell>
                  <TableCell className="text-right">{fmtCurrency(v.actual_revenue)}</TableCell>
                  <TableCell className="text-right">
                    <VarianceBadge value={v.revenue_variance_pct} suffix="%" positive />
                  </TableCell>
                  <TableCell className="text-right">{fmtPct(v.actual_food_cost_pct)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {fmtPct(v.target_food_cost_pct)}
                  </TableCell>
                  <TableCell className="text-right">
                    <VarianceBadge value={v.food_cost_variance_pct} suffix=" pts" />
                  </TableCell>
                  <TableCell className="text-right">{fmtPct(v.actual_labor_pct)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {fmtPct(v.target_labor_pct)}
                  </TableCell>
                  <TableCell className="text-right">
                    <VarianceBadge value={v.labor_variance_pct} suffix=" pts" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function VarianceBadge({
  value,
  suffix = "",
  positive = false,
}: {
  value: number;
  suffix?: string;
  positive?: boolean;
}) {
  // For costs, negative variance is good (under budget). For revenue, positive is good.
  const isGood = positive ? value >= 0 : value <= 0;
  return (
    <Badge
      variant="secondary"
      className={`text-xs font-mono ${
        isGood
          ? "bg-emerald-500/10 text-emerald-600"
          : "bg-red-500/10 text-red-600"
      }`}
    >
      {value >= 0 ? "+" : ""}
      {value.toFixed(1)}
      {suffix}
    </Badge>
  );
}

function PLDetailTable({
  data,
  isLoading,
}: {
  data: DailyPLRow[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Daily P&L Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Daily P&L Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No data available for this period
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Daily P&L Detail</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Beg Inv</TableHead>
                <TableHead className="text-right">Purchases</TableHead>
                <TableHead className="text-right">End Inv</TableHead>
                <TableHead className="text-right">COGS</TableHead>
                <TableHead className="text-right">Food %</TableHead>
                <TableHead className="text-right">Labor</TableHead>
                <TableHead className="text-right">Labor %</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {fmtDate(row.pl_date)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{row.location_name}</TableCell>
                  <TableCell className="text-right">{fmtCurrency(row.revenue)}</TableCell>
                  <TableCell className="text-right">{fmtCurrency(row.beginning_inventory)}</TableCell>
                  <TableCell className="text-right">{fmtCurrency(row.purchases)}</TableCell>
                  <TableCell className="text-right">{fmtCurrency(row.ending_inventory)}</TableCell>
                  <TableCell className="text-right">{fmtCurrency(row.cogs)}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        (row.food_cost_pct ?? 0) > 33
                          ? "text-red-600 font-medium"
                          : ""
                      }
                    >
                      {fmtPct(row.food_cost_pct)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{fmtCurrency(row.labor_cost)}</TableCell>
                  <TableCell className="text-right">{fmtPct(row.labor_pct)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                    {row.notes ?? ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Main Page ---

export default function ReportingPage() {
  const locationId = useWorkspaceStore((s) => s.activeLocationId);
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const { start, end } = getDateRange(dateRange);

  // Pass null for locationId to see all locations, or the active one
  const [filterByLocation, setFilterByLocation] = useState(false);
  const effectiveLocationId = filterByLocation ? locationId : null;

  const { data: summary, isLoading: summaryLoading } = useReportingSummary(
    effectiveLocationId,
    start,
    end,
  );
  const { data: plRows, isLoading: plLoading } = useReportingPL(
    effectiveLocationId,
    start,
    end,
  );
  const { data: trends, isLoading: trendsLoading } = useReportingTrends(
    effectiveLocationId,
    start,
    end,
  );
  const { data: variance, isLoading: varianceLoading } = useReportingVariance(
    effectiveLocationId,
    start,
    end,
  );

  const kpis = summary
    ? [
        {
          label: "Total Revenue",
          value: fmtCurrency(summary.total_revenue),
          delta: `${summary.days} days`,
        },
        {
          label: "Total COGS",
          value: fmtCurrency(summary.total_cogs),
        },
        {
          label: "Food Cost %",
          value: fmtPct(summary.avg_food_cost_pct),
          delta: summary.avg_food_cost_pct > 32 ? "Above target" : "On target",
        },
        {
          label: "Labor %",
          value: fmtPct(summary.avg_labor_pct),
          delta: summary.avg_labor_pct > 30 ? "Above target" : "On target",
        },
      ]
    : [
        { label: "Total Revenue", value: "--" },
        { label: "Total COGS", value: "--" },
        { label: "Food Cost %", value: "--" },
        { label: "Labor %", value: "--" },
      ];

  return (
    <>
      <WorkspaceHeader title="Reporting" subtitle="Daily P&L and cost analysis" />
      <div className="p-4 lg:p-6 space-y-6">
        {/* Filters */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <button
            onClick={() => setFilterByLocation((v) => !v)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filterByLocation
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {filterByLocation ? "Showing active location" : "All locations"}
          </button>
        </div>

        {/* KPI Summary Cards */}
        {summaryLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <WorkspaceKPICards cards={kpis} />
        )}

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Cost Trends</CardTitle>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <CostTrendChart data={trends ?? []} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Food Cost: Budget vs Actual
              </CardTitle>
            </CardHeader>
            <CardContent>
              {varianceLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <BudgetVarianceChart data={variance ?? []} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Variance Table */}
        {!varianceLoading && variance && variance.length > 0 && (
          <VarianceTable data={variance} />
        )}

        {/* Daily P&L Detail Table */}
        <PLDetailTable data={plRows ?? []} isLoading={plLoading} />
      </div>
    </>
  );
}
