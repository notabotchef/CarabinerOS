"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Cell,
} from "recharts";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface DailyPLRow {
  id: string;
  location_id: string;
  location_name: string;
  pl_date: string;
  beginning_inventory: number;
  purchases: number;
  ending_inventory: number;
  cogs: number;
  revenue: number;
  food_cost_pct: number | null;
  labor_cost: number;
  labor_pct: number | null;
  notes: string | null;
}

interface RevenueChartDatum {
  date: string;
  revenue: number;
  cogs: number;
  netProfit: number;
}

interface FoodCostChartDatum {
  date: string;
  foodCostPct: number;
}

interface DowChartDatum {
  day: string;
  revenue: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DAILY_BUDGET = 5000;
const FOOD_COST_TARGET_LOW = 28;
const FOOD_COST_TARGET_HIGH = 32;

// Midnight Kitchen palette — hex equivalents of the oklch vars for Recharts
const TEAL   = "#3dd68c"; // roughly oklch(0.72 0.22 160)
const AMBER  = "#f59e0b";
const EMERALD = "#10b981";
const GRID_COLOR = "rgba(255,255,255,0.05)";
const AXIS_COLOR = "rgba(255,255,255,0.35)";
const TOOLTIP_BG = "#1e2535"; // oklch(0.20 0.025 250) approximate
const TOOLTIP_BORDER = "rgba(255,255,255,0.08)";

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ------------------------------------------------------------------ */
/*  Shared tooltip style                                               */
/* ------------------------------------------------------------------ */

const tooltipStyle: React.CSSProperties = {
  backgroundColor: TOOLTIP_BG,
  border: `1px solid ${TOOLTIP_BORDER}`,
  borderRadius: "8px",
  fontSize: "11px",
  fontFamily: "var(--font-geist-mono, monospace)",
  color: "rgba(255,255,255,0.85)",
  padding: "8px 12px",
};

/* ------------------------------------------------------------------ */
/*  Chart 1: Daily Revenue Trend                                       */
/* ------------------------------------------------------------------ */

interface RevenueTrendChartProps {
  rows: DailyPLRow[];
}

export function RevenueTrendChart({ rows }: RevenueTrendChartProps) {
  const data: RevenueChartDatum[] = useMemo(() => {
    return [...rows]
      .sort((a, b) => a.pl_date.localeCompare(b.pl_date))
      .map((r) => ({
        date: r.pl_date.slice(5), // "MM-DD"
        revenue: Math.round(r.revenue),
        cogs: Math.round(r.cogs),
        netProfit: Math.round(r.revenue - r.cogs - r.labor_cost),
      }));
  }, [rows]);

  if (data.length === 0) {
    return <ChartEmptyState label="No revenue data available" />;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={TEAL} stopOpacity={0.35} />
            <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={GRID_COLOR}
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: AXIS_COLOR, fontSize: 10, fontFamily: "var(--font-geist-mono, monospace)" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: AXIS_COLOR, fontSize: 10, fontFamily: "var(--font-geist-mono, monospace)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          width={40}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: "rgba(255,255,255,0.55)", marginBottom: 6 }}
          formatter={(value, name) => {
            const labels: Record<string, string> = {
              revenue: "Revenue",
              cogs: "COGS",
              netProfit: "Net Profit",
            };
            const numVal = typeof value === "number" ? value : 0;
            const nameStr = typeof name === "string" ? name : String(name);
            return [
              `$${numVal.toLocaleString()}`,
              labels[nameStr] ?? nameStr,
            ];
          }}
        />
        <ReferenceLine
          y={DAILY_BUDGET}
          stroke={TEAL}
          strokeDasharray="4 4"
          strokeOpacity={0.4}
          strokeWidth={1}
          label={{
            value: "Budget",
            position: "right",
            fill: TEAL,
            fontSize: 9,
            fontFamily: "var(--font-geist-mono, monospace)",
            opacity: 0.6,
          }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke={TEAL}
          strokeWidth={2}
          fill="url(#revGradient)"
          dot={false}
          activeDot={{ r: 4, fill: TEAL, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  Chart 2: Food Cost % Trend                                         */
/* ------------------------------------------------------------------ */

interface FoodCostTrendChartProps {
  rows: DailyPLRow[];
}

export function FoodCostTrendChart({ rows }: FoodCostTrendChartProps) {
  const data: FoodCostChartDatum[] = useMemo(() => {
    return [...rows]
      .sort((a, b) => a.pl_date.localeCompare(b.pl_date))
      .map((r) => {
        const pct =
          r.food_cost_pct != null
            ? r.food_cost_pct
            : r.revenue > 0
              ? parseFloat(((r.cogs / r.revenue) * 100).toFixed(2))
              : 0;
        return {
          date: r.pl_date.slice(5),
          foodCostPct: pct,
        };
      });
  }, [rows]);

  if (data.length === 0) {
    return <ChartEmptyState label="No food cost data available" />;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={GRID_COLOR}
          vertical={false}
        />
        {/* Target zone band */}
        <ReferenceArea
          y1={FOOD_COST_TARGET_LOW}
          y2={FOOD_COST_TARGET_HIGH}
          fill={EMERALD}
          fillOpacity={0.07}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: AXIS_COLOR, fontSize: 10, fontFamily: "var(--font-geist-mono, monospace)" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: AXIS_COLOR, fontSize: 10, fontFamily: "var(--font-geist-mono, monospace)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v}%`}
          domain={["auto", "auto"]}
          width={36}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: "rgba(255,255,255,0.55)", marginBottom: 6 }}
          formatter={(value) => {
            const v = typeof value === "number" ? value : 0;
            return [`${v.toFixed(1)}%`, "Food Cost"];
          }}
        />
        <ReferenceLine
          y={FOOD_COST_TARGET_LOW}
          stroke={EMERALD}
          strokeDasharray="4 4"
          strokeOpacity={0.35}
          strokeWidth={1}
        />
        <ReferenceLine
          y={FOOD_COST_TARGET_HIGH}
          stroke={EMERALD}
          strokeDasharray="4 4"
          strokeOpacity={0.35}
          strokeWidth={1}
          label={{
            value: "Target 28–32%",
            position: "right",
            fill: EMERALD,
            fontSize: 9,
            fontFamily: "var(--font-geist-mono, monospace)",
            opacity: 0.7,
          }}
        />
        <Line
          type="monotone"
          dataKey="foodCostPct"
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
          stroke={AMBER} // will be overridden per-point via Cell — use base amber
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  Chart 3: Revenue by Day of Week                                    */
/* ------------------------------------------------------------------ */

interface DowChartProps {
  rows: DailyPLRow[];
}

export function RevenueByDowChart({ rows }: DowChartProps) {
  const data: DowChartDatum[] = useMemo(() => {
    const totals: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    for (const r of rows) {
      const d = new Date(r.pl_date);
      // JS getDay: 0=Sun. Map to Mon=0 .. Sun=6
      const dow = (d.getDay() + 6) % 7;
      totals[dow] += r.revenue;
    }
    const maxRev = Math.max(...Object.values(totals), 1);
    return DOW_LABELS.map((day, i) => ({
      day,
      revenue: Math.round(totals[i]),
      // normalised for coloring — not rendered
      _pct: totals[i] / maxRev,
    })) as DowChartDatum[];
  }, [rows]);

  if (rows.length === 0) {
    return <ChartEmptyState label="No day-of-week data available" />;
  }

  const maxRev = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={GRID_COLOR}
          horizontal={true}
          vertical={false}
        />
        <XAxis
          dataKey="day"
          tick={{ fill: AXIS_COLOR, fontSize: 10, fontFamily: "var(--font-geist-mono, monospace)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: AXIS_COLOR, fontSize: 10, fontFamily: "var(--font-geist-mono, monospace)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          width={40}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
          formatter={(value) => {
            const v = typeof value === "number" ? value : 0;
            return [`$${v.toLocaleString()}`, "Revenue"];
          }}
        />
        <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => {
            const intensity = entry.revenue / maxRev;
            const opacity = 0.4 + intensity * 0.6;
            return (
              <Cell
                key={`dow-${index}`}
                fill={TEAL}
                fillOpacity={opacity}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state helper                                                 */
/* ------------------------------------------------------------------ */

function ChartEmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-[220px]">
      <span className="text-[11px] text-muted-foreground/40 tracking-wide font-mono">
        {label}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Chart card wrapper                                                 */
/* ------------------------------------------------------------------ */

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  index?: number;
}

export function ChartCard({ title, subtitle, children, index = 0 }: ChartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15 + index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="rounded-xl border border-border/60 bg-card overflow-hidden"
    >
      <div className="px-5 pt-4 pb-1">
        <h3 className="text-[12px] font-semibold text-foreground/80 tracking-wide">
          {title}
        </h3>
        {subtitle && (
          <p className="text-[10px] text-muted-foreground/50 mt-0.5 tracking-wide">
            {subtitle}
          </p>
        )}
      </div>
      <div className="px-2 pb-3">
        {children}
      </div>
    </motion.div>
  );
}
