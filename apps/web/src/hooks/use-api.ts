"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  HQPayload,
  Location,
  InboxItem,
  Order,
  InventoryItem,
  PrepTask,
  FoodCostItem,
  MenuItem,
  Campaign,
  DailyPLRow,
  PLSummary,
  TrendPoint,
  BudgetVariance,
} from "@/lib/api";

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || "http://localhost:8000";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${ENGINE_URL}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export function useHQ() {
  return useQuery<HQPayload>({
    queryKey: ["hq"],
    queryFn: () => apiFetch("/api/hq"),
  });
}

export function useLocations() {
  return useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: () => apiFetch("/api/locations"),
  });
}

export function useInbox(locationId?: string | null) {
  return useQuery<InboxItem[]>({
    queryKey: ["inbox", locationId],
    queryFn: () =>
      apiFetch(`/api/inbox${locationId ? `?location_id=${locationId}` : ""}`),
  });
}

export function useOrders(locationId?: string | null) {
  return useQuery<Order[]>({
    queryKey: ["orders", locationId],
    queryFn: () =>
      apiFetch(`/api/orders${locationId ? `?location_id=${locationId}` : ""}`),
  });
}

export function useInventory(locationId?: string | null) {
  return useQuery<InventoryItem[]>({
    queryKey: ["inventory", locationId],
    queryFn: () =>
      apiFetch(`/api/inventory${locationId ? `?location_id=${locationId}` : ""}`),
  });
}

export function usePrep(locationId?: string | null) {
  return useQuery<PrepTask[]>({
    queryKey: ["prep", locationId],
    queryFn: () =>
      apiFetch(`/api/prep${locationId ? `?location_id=${locationId}` : ""}`),
  });
}

export function useFoodCost(locationId?: string | null) {
  return useQuery<FoodCostItem[]>({
    queryKey: ["food-cost", locationId],
    queryFn: () =>
      apiFetch(`/api/food-cost${locationId ? `?location_id=${locationId}` : ""}`),
  });
}

export function useMenu(locationId?: string | null) {
  return useQuery<MenuItem[]>({
    queryKey: ["menu", locationId],
    queryFn: () =>
      apiFetch(`/api/menu${locationId ? `?location_id=${locationId}` : ""}`),
  });
}

export function useMarketing(locationId?: string | null) {
  return useQuery<Campaign[]>({
    queryKey: ["marketing", locationId],
    queryFn: () =>
      apiFetch(`/api/marketing${locationId ? `?location_id=${locationId}` : ""}`),
  });
}

// --- Reporting ---

function buildReportingParams(
  locationId?: string | null,
  startDate?: string | null,
  endDate?: string | null,
): string {
  const params = new URLSearchParams();
  if (locationId) params.set("location_id", locationId);
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useReportingPL(
  locationId?: string | null,
  startDate?: string | null,
  endDate?: string | null,
) {
  return useQuery<DailyPLRow[]>({
    queryKey: ["reporting-pl", locationId, startDate, endDate],
    queryFn: () =>
      apiFetch(`/api/reporting/pl${buildReportingParams(locationId, startDate, endDate)}`),
  });
}

export function useReportingSummary(
  locationId?: string | null,
  startDate?: string | null,
  endDate?: string | null,
) {
  return useQuery<PLSummary>({
    queryKey: ["reporting-summary", locationId, startDate, endDate],
    queryFn: () =>
      apiFetch(`/api/reporting/pl/summary${buildReportingParams(locationId, startDate, endDate)}`),
  });
}

export function useReportingTrends(
  locationId?: string | null,
  startDate?: string | null,
  endDate?: string | null,
) {
  return useQuery<TrendPoint[]>({
    queryKey: ["reporting-trends", locationId, startDate, endDate],
    queryFn: () =>
      apiFetch(`/api/reporting/trends${buildReportingParams(locationId, startDate, endDate)}`),
  });
}

export function useReportingVariance(
  locationId?: string | null,
  startDate?: string | null,
  endDate?: string | null,
) {
  return useQuery<BudgetVariance[]>({
    queryKey: ["reporting-variance", locationId, startDate, endDate],
    queryFn: () =>
      apiFetch(`/api/reporting/variance${buildReportingParams(locationId, startDate, endDate)}`),
  });
}
