"use client";

import { useState, useEffect, useCallback } from "react";
import { Flame } from "lucide-react";
import { MenuButton } from "@/components/menu-button";
import { useWorkspace } from "@/hooks/use-workspace";
import { useSocketContext } from "@/components/socket-provider";
import { useChat } from "@/hooks/use-chat";
import { ChatComposer } from "@/components/chat-composer";
import { KpiStrip } from "./_components/kpi-strip";
import { TrendChart } from "./_components/trend-chart";
import { BudgetCard } from "./_components/budget-card";
import { PressureTable, type FoodCostItem } from "./_components/pressure-table";

/* ------------------------------------------------------------------ */
/*  Types for API responses                                            */
/* ------------------------------------------------------------------ */

interface FoodCostSummary {
  today_food_cost_pct: number | null;
  today_sales: number | null;
  today_purchases: number | null;
  period_food_cost_pct: number | null;
  period_total_purchases: number;
  period_total_sales: number;
  budget_target_pct: number | null;
  budget_amount: number | null;
  budget_over_under: number | null;
  prime_cost_pct: number | null;
  period_start: string | null;
  period_end: string | null;
}

interface DailyFoodCostRow {
  id: string;
  cost_date: string;
  food_cost_pct: number | null;
  purchases: number;
  sales: number;
  actual_food_cost: number;
}

interface BudgetData {
  id: string | null;
  period_start: string | null;
  period_end: string | null;
  target_food_cost_pct: number | null;
  target_labor_pct: number | null;
  target_revenue: number | null;
  actual_purchases: number;
  actual_sales: number;
  actual_food_cost_pct: number | null;
  over_under: number | null;
  days_elapsed: number;
  days_total: number;
}

/* ------------------------------------------------------------------ */
/*  Custom hook for {ok, data} envelope endpoints                      */
/* ------------------------------------------------------------------ */

function useApiData<T>(endpoint: string): {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: true, error: null });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch(endpoint, { credentials: "include", signal: controller.signal })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.ok) {
          setState({ data: json.data, loading: false, error: null });
        } else {
          setState({ data: null, loading: false, error: json.error || "Unknown error" });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ data: null, loading: false, error: err.message });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [endpoint, refreshKey]);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    refresh: () => {
      setState((s) => ({ ...s, loading: true }));
      setRefreshKey((k) => k + 1);
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function FoodCostPage() {
  // --- Data hooks ---
  const summary = useApiData<FoodCostSummary>("/api/food-cost/summary");
  const daily = useApiData<DailyFoodCostRow[]>("/api/food-cost/daily");
  const budget = useApiData<BudgetData>("/api/food-cost/budget");
  const pressure = useWorkspace<FoodCostItem>("/api/food-cost");

  // --- Chat integration ---
  const { snapshot, subscribe } = useSocketContext();
  const { sendMessage, loading: chatLoading } = useChat(snapshot);

  // Unsubscribe on mount (module page, no specific context)
  useEffect(() => {
    subscribe(null);
  }, [subscribe]);

  const handleSend = useCallback(async (text: string) => {
    const newCtx = await sendMessage(text);
    if (newCtx) subscribe(newCtx);
    // Refresh data after chat message (agent may have created daily entries)
    setTimeout(() => {
      summary.refresh();
      daily.refresh();
      budget.refresh();
      pressure.refresh();
    }, 3000);
  }, [sendMessage, subscribe, summary, daily, budget, pressure]);

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/60 shrink-0 bg-card">
        <MenuButton />
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-8 rounded-lg bg-amber-500/10">
              <Flame className="size-4 text-amber-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground tracking-tight">Food Cost</h1>
              <p className="text-xs text-muted-foreground">Am I making money or losing money?</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 space-y-6 max-w-6xl mx-auto">
          {/* Hero KPI strip */}
          <KpiStrip
            summary={summary.data}
            loading={summary.loading}
          />

          {/* Trend chart + Budget — side by side on desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              <TrendChart
                data={daily.data ?? []}
                targetPct={summary.data?.budget_target_pct ?? null}
                loading={daily.loading}
              />
            </div>
            <div className="lg:col-span-2">
              <BudgetCard
                budget={budget.data}
                loading={budget.loading}
              />
            </div>
          </div>

          {/* Pressure table — AI commentary section */}
          <PressureTable
            data={pressure.data}
            loading={pressure.loading}
            error={pressure.error}
          />
        </div>
      </div>

      {/* Chat composer — pinned to bottom */}
      <div className="shrink-0 border-t border-border/60 bg-card">
        <ChatComposer
          onSend={handleSend}
          loading={chatLoading}
          placeholder="Today's spend: Sysco $2,100, revenue $8,200..."
          showSuggestions={false}
        />
      </div>
    </div>
  );
}
