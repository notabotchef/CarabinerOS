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
  Invoice,
  DailyPLRow,
  PLSummary,
  TrendPoint,
  BudgetVariance,
  Metric,
} from "@/lib/api";
import type { Conversation } from "@/stores/workspace-store";

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || "http://localhost:8000";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${ENGINE_URL}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

// --- Conversations ---

export function useConversations() {
  return useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: () => apiFetch("/api/chats"),
    refetchInterval: 30_000, // refresh every 30s as a fallback
  });
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export function useConversationMessages(contextId: string | null) {
  return useQuery<ConversationMessage[]>({
    queryKey: ["conversation-messages", contextId],
    queryFn: () => apiFetch(`/api/chats/${contextId}/messages`),
    enabled: !!contextId,
  });
}

export async function apiCreateChat(): Promise<Conversation> {
  const res = await fetch(`${ENGINE_URL}/api/chats`, { method: "POST" });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function apiDeleteChat(contextId: string): Promise<void> {
  const res = await fetch(`${ENGINE_URL}/api/chats/${contextId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
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

export function useInvoices(locationId?: string | null) {
  return useQuery<Invoice[]>({
    queryKey: ["invoices", locationId],
    queryFn: () =>
      apiFetch(`/api/invoices${locationId ? `?location_id=${locationId}` : ""}`),
  });
}

export function useMetrics(locationId?: string | null) {
  return useQuery<Metric[]>({
    queryKey: ["metrics", locationId],
    queryFn: () =>
      apiFetch(`/api/metrics${locationId ? `?location_id=${locationId}` : ""}`),
    retry: false,
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
