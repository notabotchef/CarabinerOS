"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  type TooltipContentProps,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DailyFoodCostRow {
  id: string;
  cost_date: string;
  food_cost_pct: number | null;
  purchases: number;
  sales: number;
  actual_food_cost: number;
}

interface ChartDatum {
  date: string;
  displayDate: string;
  foodCostPct: number;
  purchases: number;
  sales: number;
}

interface TrendChartProps {
  data: DailyFoodCostRow[];
  targetPct: number | null;
  loading: boolean;
}

/* ------------------------------------------------------------------ */
/*  Theme hook (matches DESIGN_TOKENS.md)                              */
/* ------------------------------------------------------------------ */

function useChartTheme() {
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  return {
    grid: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)",
    axisText: isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.40)",
    budgetLine: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
    tooltipBg: isDark ? "#141b27" : "#ffffff",
    tooltipBorder: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)",
    tooltipShadow: isDark ? "0 8px 32px rgba(0,0,0,0.5)" : "0 8px 32px rgba(0,0,0,0.12)",
    tooltipText: isDark ? "rgba(255,255,255,0.90)" : "rgba(0,0,0,0.85)",
    tooltipMuted: isDark ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.50)",
    tooltipDate: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
    refLabel: isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.35)",
  };
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const AMBER = "#f59e0b";
const RED = "#ef4444";
const EMERALD = "#34d399";
const MONO = "var(--font-geist-mono, ui-monospace, monospace)";
const SANS = "var(--font-geist, var(--font-sans), system-ui, sans-serif)";

const MONTH_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function formatDisplay(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${MONTH_SHORT[month]} ${day}`;
}

/* ------------------------------------------------------------------ */
/*  Custom tooltip                                                     */
/* ------------------------------------------------------------------ */

function FoodCostTooltip({ active, payload }: TooltipContentProps<number, string>) {
  const t = useChartTheme();
  if (!active || !payload || payload.length === 0) return null;
  const datum = (payload[0]?.payload ?? {}) as ChartDatum;
  const pct = datum.foodCostPct ?? 0;

  return (
    <div
      style={{
        background: t.tooltipBg,
        border: `1px solid ${t.tooltipBorder}`,
        borderRadius: 10,
        boxShadow: t.tooltipShadow,
        padding: "12px 16px",
        maxWidth: 200,
        fontFamily: MONO,
      }}
    >
      <div style={{ color: t.tooltipDate, fontSize: 10, fontWeight: 500, marginBottom: 8 }}>
        {datum.displayDate}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 3 }}>
        <span style={{ fontFamily: SANS, fontSize: 10, color: t.tooltipMuted }}>Food Cost</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: t.tooltipText, fontVariantNumeric: "tabular-nums" }}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 3 }}>
        <span style={{ fontFamily: SANS, fontSize: 10, color: t.tooltipMuted }}>Purchases</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: t.tooltipText, fontVariantNumeric: "tabular-nums" }}>
          ${datum.purchases.toLocaleString()}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <span style={{ fontFamily: SANS, fontSize: 10, color: t.tooltipMuted }}>Sales</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: t.tooltipText, fontVariantNumeric: "tabular-nums" }}>
          ${datum.sales.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom dot — red if over target                                    */
/* ------------------------------------------------------------------ */

function DotRenderer(props: {
  cx?: number;
  cy?: number;
  payload?: ChartDatum;
  target: number;
}) {
  const { cx, cy, payload, target } = props;
  if (cx === undefined || cy === undefined || !payload) return null;
  const pct = payload.foodCostPct;
  const color = pct > target ? RED : EMERALD;
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={2} />;
}

/* ------------------------------------------------------------------ */
/*  Export                                                             */
/* ------------------------------------------------------------------ */

export function TrendChart({ data, targetPct, loading }: TrendChartProps) {
  const t = useChartTheme();
  const target = targetPct ?? 30;

  const chartData = useMemo<ChartDatum[]>(() => {
    return data
      .filter((r) => r.food_cost_pct !== null)
      .map((r) => ({
        date: r.cost_date.slice(5), // MM-DD
        displayDate: formatDisplay(r.cost_date),
        foodCostPct: r.food_cost_pct ?? 0,
        purchases: r.purchases,
        sales: r.sales,
      }));
  }, [data]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <Skeleton className="h-[260px] w-full rounded-lg" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center justify-center h-[260px]">
        <p className="text-sm text-muted-foreground">Your trend line starts here &mdash; log daily spend via the chat to see it come alive.</p>
      </div>
    );
  }

  const tick = { fill: t.axisText, fontSize: 10, fontFamily: MONO };

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">
        30-Day Food Cost Trend
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={t.grid} strokeDasharray="0" vertical={false} />
          <XAxis dataKey="date" tick={tick} axisLine={false} tickLine={false} interval={2} />
          <YAxis
            tick={tick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
            width={40}
            domain={["dataMin - 5", "dataMax + 5"]}
          />
          <Tooltip content={(props) => <FoodCostTooltip {...(props as TooltipContentProps<number, string>)} />} />
          <ReferenceLine
            y={target}
            stroke={t.budgetLine}
            strokeDasharray="6 4"
            strokeWidth={1}
            label={{
              value: `Target ${target}%`,
              position: "right",
              fill: t.refLabel,
              fontSize: 9,
              fontFamily: MONO,
            }}
          />
          <Line
            type="natural"
            dataKey="foodCostPct"
            stroke={AMBER}
            strokeWidth={2.5}
            dot={(props) => <DotRenderer key={props.cx} {...props} target={target} />}
            activeDot={{ r: 6, fill: AMBER, stroke: "#fff", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
