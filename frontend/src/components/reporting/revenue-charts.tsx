"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  type TooltipContentProps,
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
  displayDate: string;
  revenue: number;
  cogs: number;
  netProfit: number;
  foodCostPct: number;
}

interface FoodCostChartDatum {
  date: string;
  displayDate: string;
  foodCostPct: number;
}

interface DowChartDatum {
  day: string;
  revenue: number;
}

type ChartTab = "revenue" | "foodcost" | "byday";

/* ------------------------------------------------------------------ */
/*  Constants — hex for Recharts SVG                                  */
/* ------------------------------------------------------------------ */

const DAILY_BUDGET = 5000;
const FOOD_COST_TARGET_LOW = 28;
const FOOD_COST_TARGET_HIGH = 32;

const EMERALD   = "#34d399";
const TEAL_300  = "#5eead4";
const AMBER     = "#f59e0b";
const RED       = "#ef4444";
const BLUE      = "#3b82f6";
// Theme-aware colors — resolved via hook at render time
function useChartTheme() {
  // Check if dark mode by reading the DOM (class="dark" on html)
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  return {
    grid:       isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)",
    axisText:   isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.40)",
    budgetLine: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
    tooltipBg:  isDark ? "#141b27" : "#ffffff",
    tooltipBorder: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)",
    tooltipShadow: isDark ? "0 8px 32px rgba(0,0,0,0.5)" : "0 8px 32px rgba(0,0,0,0.12)",
    tooltipText: isDark ? "rgba(255,255,255,0.90)" : "rgba(0,0,0,0.85)",
    tooltipMuted: isDark ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.50)",
    tooltipDate: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
    cursorFill: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)",
    refLabel:   isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.35)",
  };
}
// Recharts SVG requires inline font — see DESIGN_TOKENS.md Charts section.
const MONO = "var(--font-geist-mono, ui-monospace, monospace)";
const SANS = "var(--font-geist, var(--font-sans), system-ui, sans-serif)";

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ------------------------------------------------------------------ */
/*  Date formatting                                                    */
/* ------------------------------------------------------------------ */

const MONTH_SHORT = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function formatTooltipDate(mmdd: string): string {
  // mmdd is "MM-DD"
  const parts = mmdd.split("-");
  if (parts.length !== 2) return mmdd;
  const month = parseInt(parts[0], 10) - 1;
  const day   = parseInt(parts[1], 10);
  return `${MONTH_SHORT[month] ?? "???"} ${day}`;
}

/* ------------------------------------------------------------------ */
/*  Custom Tooltip — Revenue / Food Cost                               */
/* ------------------------------------------------------------------ */

function RevenueCustomTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  const t = useChartTheme();
  if (!active || !payload || payload.length === 0) return null;
  const datum = (payload[0]?.payload ?? {}) as RevenueChartDatum;
  const displayDate = datum?.displayDate ?? (typeof label === "string" ? formatTooltipDate(label) : String(label ?? ""));

  const rows: { label: string; value: string }[] = [];
  for (const item of payload) {
    const name = item.name as string;
    const value = (item.value as number) ?? 0;
    if (name === "revenue") {
      rows.push({ label: "Revenue", value: `$${value.toLocaleString()}` });
    } else if (name === "cogs") {
      rows.push({ label: "COGS", value: `$${value.toLocaleString()}` });
    } else if (name === "netProfit") {
      rows.push({ label: "Net Profit", value: `$${value.toLocaleString()}` });
    }
  }

  const foodCostPct = datum?.foodCostPct ?? 0;
  const dotColor = foodCostPct >= FOOD_COST_TARGET_LOW && foodCostPct <= FOOD_COST_TARGET_HIGH
    ? EMERALD
    : foodCostPct > FOOD_COST_TARGET_HIGH
    ? RED
    : BLUE;

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
        {displayDate}
      </div>
      {rows.map((row) => (
        <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 3 }}>
          <span style={{ fontFamily: SANS, fontSize: 10, color: t.tooltipMuted, fontWeight: 400 }}>
            {row.label}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: t.tooltipText, fontVariantNumeric: "tabular-nums" }}>
            {row.value}
          </span>
        </div>
      ))}
      {foodCostPct > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
          <span style={{ fontFamily: SANS, fontSize: 10, color: t.tooltipMuted }}>
            {foodCostPct.toFixed(1)}% food cost
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom Tooltip — Food Cost %                                       */
/* ------------------------------------------------------------------ */

function FoodCostCustomTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  const t = useChartTheme();
  if (!active || !payload || payload.length === 0) return null;
  const datum = (payload[0]?.payload ?? {}) as FoodCostChartDatum;
  const displayDate = datum?.displayDate ?? (typeof label === "string" ? formatTooltipDate(label) : String(label ?? ""));
  const pct = (payload[0]?.value as number) ?? 0;
  const dotColor = pct >= FOOD_COST_TARGET_LOW && pct <= FOOD_COST_TARGET_HIGH
    ? EMERALD
    : pct > FOOD_COST_TARGET_HIGH
    ? RED
    : BLUE;

  return (
    <div
      style={{
        background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`,
        borderRadius: 10, boxShadow: t.tooltipShadow,
        padding: "12px 16px", maxWidth: 200, fontFamily: MONO,
      }}
    >
      <div style={{ color: t.tooltipDate, fontSize: 10, fontWeight: 500, marginBottom: 8 }}>
        {displayDate}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
          <span style={{ fontFamily: SANS, fontSize: 10, color: t.tooltipMuted, fontWeight: 400 }}>
            Food Cost
          </span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: t.tooltipText, fontVariantNumeric: "tabular-nums" }}>
          {pct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom Tooltip — Bar (Revenue by Day)                              */
/* ------------------------------------------------------------------ */

function DowCustomTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  const t = useChartTheme();
  if (!active || !payload || payload.length === 0) return null;
  const value = (payload[0]?.value as number) ?? 0;

  return (
    <div
      style={{
        background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`,
        borderRadius: 10, boxShadow: t.tooltipShadow,
        padding: "12px 16px", maxWidth: 200, fontFamily: MONO,
      }}
    >
      <div style={{ color: t.tooltipDate, fontSize: 10, fontWeight: 500, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <span style={{ fontFamily: SANS, fontSize: 10, color: t.tooltipMuted, fontWeight: 400 }}>
          Revenue
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: t.tooltipText, fontVariantNumeric: "tabular-nums" }}>
          ${value.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Axis tick style (shared)                                           */
/* ------------------------------------------------------------------ */

function useAxisTick() {
  const t = useChartTheme();
  return { fill: t.axisText, fontSize: 10, fontFamily: MONO };
}

/* ------------------------------------------------------------------ */
/*  Revenue Area Chart                                                 */
/* ------------------------------------------------------------------ */

function RevenueAreaChart({ data }: { data: RevenueChartDatum[] }) {
  const t = useChartTheme();
  const tick = useAxisTick();

  if (data.length === 0) {
    return <ChartEmptyState />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={EMERALD} stopOpacity={0.25} />
            <stop offset="100%" stopColor={EMERALD} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={t.grid} strokeDasharray="0" vertical={false} />
        <XAxis dataKey="date" tick={tick} axisLine={false} tickLine={false} interval={2} />
        <YAxis
          tick={tick} axisLine={false} tickLine={false}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          width={40} domain={[0, "auto"]}
        />
        <Tooltip content={(props) => <RevenueCustomTooltip {...(props as TooltipContentProps<number, string>)} />} />
        <ReferenceLine
          y={DAILY_BUDGET} stroke={t.budgetLine} strokeDasharray="6 4" strokeWidth={1}
          label={{ value: "Target", position: "right", fill: t.refLabel, fontSize: 9, fontFamily: MONO }}
        />
        <Area
          type="natural" dataKey="revenue" stroke={EMERALD} strokeWidth={2}
          fill="url(#revGradient)" dot={false}
          activeDot={{ r: 5, fill: EMERALD, stroke: "#fff", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  Food Cost % Line Chart                                             */
/* ------------------------------------------------------------------ */

function FoodCostLineChart({ data }: { data: FoodCostChartDatum[] }) {
  const t = useChartTheme();
  const tick = useAxisTick();

  if (data.length === 0) {
    return <ChartEmptyState />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={t.grid} strokeDasharray="0" vertical={false} />
        <ReferenceArea
          y1={FOOD_COST_TARGET_LOW}
          y2={FOOD_COST_TARGET_HIGH}
          fill={EMERALD}
          fillOpacity={0.05}
        />
        <XAxis dataKey="date" tick={tick} axisLine={false} tickLine={false} interval={2} />
        <YAxis
          tick={tick} axisLine={false} tickLine={false}
          tickFormatter={(v: number) => `${v}%`} domain={[24, 38]} width={36}
        />
        <Tooltip content={(props) => <FoodCostCustomTooltip {...(props as TooltipContentProps<number, string>)} />} />
        <ReferenceLine
          y={FOOD_COST_TARGET_LOW}
          stroke={EMERALD}
          strokeDasharray="4 4"
          strokeOpacity={0.25}
          strokeWidth={1}
        />
        <ReferenceLine
          y={FOOD_COST_TARGET_HIGH}
          stroke={EMERALD}
          strokeDasharray="4 4"
          strokeOpacity={0.25}
          strokeWidth={1}
          label={{
            value: "Target 28–32%",
            position: "right",
            fill: EMERALD,
            fontSize: 9,
            fontFamily: MONO,
            opacity: 0.40,
          }}
        />
        <Line
          type="linear"
          dataKey="foodCostPct"
          stroke={AMBER}
          strokeWidth={2.5}
          dot={(props) => {
            const { cx, cy, payload } = props as { cx: number; cy: number; payload: FoodCostChartDatum };
            const pct = payload.foodCostPct;
            const color = pct >= FOOD_COST_TARGET_LOW && pct <= FOOD_COST_TARGET_HIGH
              ? EMERALD
              : pct > FOOD_COST_TARGET_HIGH
              ? RED
              : BLUE;
            return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={color} stroke="none" />;
          }}
          activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  Revenue by Day of Week — Bar Chart                                 */
/* ------------------------------------------------------------------ */

function DowBarChart({ data }: { data: DowChartDatum[] }) {
  const t = useChartTheme();
  const tick = useAxisTick();

  if (data.length === 0) {
    return <ChartEmptyState />;
  }

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        barCategoryGap="35%"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <XAxis
          dataKey="day"
          tick={tick}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={tick}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          width={40}
        />
        <Tooltip
          content={(props) => <DowCustomTooltip {...(props as TooltipContentProps<number, string>)} />}
          cursor={{ fill: t.cursorFill }}
        />
        <Bar dataKey="revenue" radius={[6, 6, 0, 0]} isAnimationActive={false}>
          {data.map((_, index) => (
            <Cell
              key={`dow-${index}`}
              fill={hoveredIndex === index ? TEAL_300 : EMERALD}
              style={{ cursor: "pointer", transition: "fill 150ms" }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary Bar                                                        */
/* ------------------------------------------------------------------ */

interface SummaryItem {
  label: string;
  value: string;
}

function SummaryBar({ items }: { items: SummaryItem[] }) {
  return (
    <div className="flex border-t border-border/30 divide-x divide-border/30">
      {items.map((item, i) => (
        <div key={i} className="flex-1 px-5 py-3">
          <div
            className="text-[10px] uppercase tracking-wider text-muted-foreground/60"
            style={{ fontFamily: MONO }}
          >
            {item.label}
          </div>
          <div
            className="text-[12px] font-medium tabular-nums mt-0.5 text-foreground/85"
            style={{ fontFamily: MONO }}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */

function ChartEmptyState() {
  return (
    <div className="flex items-center justify-center" style={{ height: 280 }}>
      <span
        className="tracking-wide text-muted-foreground/40"
        style={{ fontSize: 11, fontFamily: MONO }}
      >
        No data for this period
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab pill button                                                    */
/* ------------------------------------------------------------------ */

function TabPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150 ${
        active
          ? "bg-primary/15 text-primary"
          : "bg-secondary/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export: HeroChartSection                                      */
/* ------------------------------------------------------------------ */

interface HeroChartSectionProps {
  rows: DailyPLRow[];
}

export function HeroChartSection({ rows }: HeroChartSectionProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>("revenue");

  // Revenue data
  const revenueData: RevenueChartDatum[] = useMemo(() => {
    return [...rows]
      .sort((a, b) => a.pl_date.localeCompare(b.pl_date))
      .map((r) => {
        const pct = r.food_cost_pct != null
          ? r.food_cost_pct
          : r.revenue > 0
          ? parseFloat(((r.cogs / r.revenue) * 100).toFixed(2))
          : 0;
        return {
          date: r.pl_date.slice(5), // "MM-DD"
          displayDate: formatTooltipDate(r.pl_date.slice(5)),
          revenue: Math.round(r.revenue),
          cogs: Math.round(r.cogs),
          netProfit: Math.round(r.revenue - r.cogs - r.labor_cost),
          foodCostPct: pct,
        };
      });
  }, [rows]);

  // Food cost data
  const foodCostData: FoodCostChartDatum[] = useMemo(() => {
    return [...rows]
      .sort((a, b) => a.pl_date.localeCompare(b.pl_date))
      .map((r) => {
        const pct = r.food_cost_pct != null
          ? r.food_cost_pct
          : r.revenue > 0
          ? parseFloat(((r.cogs / r.revenue) * 100).toFixed(2))
          : 0;
        return {
          date: r.pl_date.slice(5),
          displayDate: formatTooltipDate(r.pl_date.slice(5)),
          foodCostPct: pct,
        };
      });
  }, [rows]);

  // Day-of-week data
  const dowData: DowChartDatum[] = useMemo(() => {
    const totals: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    for (const r of rows) {
      const d = new Date(r.pl_date);
      const dow = (d.getDay() + 6) % 7; // Mon=0..Sun=6
      totals[dow] += r.revenue;
    }
    return DOW_LABELS.map((day, i) => ({
      day,
      revenue: Math.round(totals[i]),
    }));
  }, [rows]);

  // Summary bar stats
  const summaryItems: SummaryItem[] = useMemo(() => {
    if (activeTab === "revenue") {
      const total = revenueData.reduce((s, d) => s + d.revenue, 0);
      const avg = revenueData.length > 0 ? total / revenueData.length : 0;
      const peak = revenueData.reduce(
        (best, d) => (d.revenue > best.revenue ? d : best),
        revenueData[0] ?? { revenue: 0, displayDate: "—" }
      );
      return [
        { label: "TOTAL", value: total > 0 ? `$${total.toLocaleString()}` : "—" },
        { label: "AVG/DAY", value: avg > 0 ? `$${Math.round(avg).toLocaleString()}` : "—" },
        { label: "PEAK", value: peak ? peak.displayDate : "—" },
      ];
    }

    if (activeTab === "foodcost") {
      const valid = foodCostData.filter((d) => d.foodCostPct > 0);
      const avg = valid.length > 0
        ? valid.reduce((s, d) => s + d.foodCostPct, 0) / valid.length
        : 0;
      const best = valid.reduce(
        (b, d) => (Math.abs(d.foodCostPct - 30) < Math.abs(b.foodCostPct - 30) ? d : b),
        valid[0] ?? { foodCostPct: 0, displayDate: "—" }
      );
      const worst = valid.reduce(
        (w, d) => (d.foodCostPct > w.foodCostPct ? d : w),
        valid[0] ?? { foodCostPct: 0, displayDate: "—" }
      );
      return [
        { label: "AVG %", value: avg > 0 ? `${avg.toFixed(1)}%` : "—" },
        { label: "BEST", value: best ? `${best.foodCostPct.toFixed(1)}%` : "—" },
        { label: "WORST", value: worst ? `${worst.foodCostPct.toFixed(1)}%` : "—" },
      ];
    }

    // byday
    const busiest = [...dowData].sort((a, b) => b.revenue - a.revenue)[0];
    const slowest = [...dowData].filter((d) => d.revenue > 0).sort((a, b) => a.revenue - b.revenue)[0];
    const weekendRev = (dowData[5]?.revenue ?? 0) + (dowData[6]?.revenue ?? 0);
    const weekdayRev = dowData.slice(0, 5).reduce((s, d) => s + d.revenue, 0);
    const wkdAvg = weekdayRev > 0 ? weekdayRev / 5 : 0;
    const weAvg  = weekendRev > 0 ? weekendRev / 2 : 0;
    const ratio  = wkdAvg > 0 ? `${(weAvg / wkdAvg).toFixed(1)}x` : "—";

    return [
      { label: "BUSIEST", value: busiest?.day ?? "—" },
      { label: "SLOWEST", value: slowest?.day ?? "—" },
      { label: "WKD vs WKN", value: ratio },
    ];
  }, [activeTab, revenueData, foodCostData, dowData]);

  const tabs: { key: ChartTab; label: string }[] = [
    { key: "revenue",  label: "Revenue" },
    { key: "foodcost", label: "Food Cost %" },
    { key: "byday",    label: "By Day" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="rounded-xl border border-border/40 bg-transparent overflow-hidden"
    >
      {/* Card header: tab pills */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        {tabs.map((tab) => (
          <TabPill
            key={tab.key}
            label={tab.label}
            active={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          />
        ))}
      </div>

      {/* Chart body — AnimatePresence cross-fade */}
      <div className="px-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === "revenue" && <RevenueAreaChart data={revenueData} />}
            {activeTab === "foodcost" && <FoodCostLineChart data={foodCostData} />}
            {activeTab === "byday" && <DowBarChart data={dowData} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Summary bar */}
      <SummaryBar items={summaryItems} />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Legacy named exports — kept for page.tsx import compatibility      */
/* ------------------------------------------------------------------ */

export function RevenueTrendChart({ rows }: { rows: DailyPLRow[] }) {
  // Redirect: the hero section now owns all charts
  return <HeroChartSection rows={rows} />;
}

// These are no longer standalone; page.tsx will be updated to use HeroChartSection
export function FoodCostTrendChart(_: { rows: DailyPLRow[] }) { return null; }
export function RevenueByDowChart(_: { rows: DailyPLRow[] }) { return null; }

/* ------------------------------------------------------------------ */
/*  ChartCard — kept for any residual usage                            */
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.1 + index * 0.06, ease: "easeOut" }}
      className="rounded-xl border border-border/40 bg-transparent overflow-hidden"
    >
      <div className="px-5 pt-5 pb-2">
        <h3
          className="font-semibold text-foreground/85 tracking-wide"
          style={{ fontSize: 13, fontFamily: SANS }}
        >
          {title}
        </h3>
        {subtitle && (
          <p
            className="mt-0.5 tracking-wide text-muted-foreground/45"
            style={{ fontSize: 10, fontFamily: MONO }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <div>{children}</div>
    </motion.div>
  );
}
