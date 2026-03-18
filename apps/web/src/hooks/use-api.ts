"use client";

import { useQuery } from "@tanstack/react-query";
import type { HQPayload, Location, InboxItem, Order } from "@/lib/api";

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

interface InventoryItem {
  id: string;
  location_id: string;
  item_name: string;
  on_hand: string;
  par: string;
  variance: string;
  summary: string | null;
  detail_points: string[] | null;
  prompt: string | null;
}

export function useInventory(locationId?: string | null) {
  return useQuery<InventoryItem[]>({
    queryKey: ["inventory", locationId],
    queryFn: () =>
      apiFetch(`/api/inventory${locationId ? `?location_id=${locationId}` : ""}`),
  });
}

interface PrepTask {
  id: string;
  location_id: string;
  service_lane: string;
  task: string;
  station: string;
  readiness: string;
  shortage: string | null;
  summary: string | null;
  detail_points: string[] | null;
  prompt: string | null;
}

export function usePrep(locationId?: string | null) {
  return useQuery<PrepTask[]>({
    queryKey: ["prep", locationId],
    queryFn: () =>
      apiFetch(`/api/prep${locationId ? `?location_id=${locationId}` : ""}`),
  });
}

interface FoodCostItem {
  id: string;
  location_id: string;
  menu_item_name: string;
  pressure: string;
  current_cost_pct: string;
  action: string;
  summary: string | null;
  detail_points: string[] | null;
  prompt: string | null;
}

export function useFoodCost(locationId?: string | null) {
  return useQuery<FoodCostItem[]>({
    queryKey: ["food-cost", locationId],
    queryFn: () =>
      apiFetch(`/api/food-cost${locationId ? `?location_id=${locationId}` : ""}`),
  });
}

interface MenuItem {
  id: string;
  location_id: string;
  item_name: string;
  category: string;
  performance: string;
  margin_pct: string;
  recommendation: string;
  summary: string | null;
  detail_points: string[] | null;
  prompt: string | null;
}

export function useMenu(locationId?: string | null) {
  return useQuery<MenuItem[]>({
    queryKey: ["menu", locationId],
    queryFn: () =>
      apiFetch(`/api/menu${locationId ? `?location_id=${locationId}` : ""}`),
  });
}

interface Campaign {
  id: string;
  location_id: string;
  campaign_name: string;
  channel: string;
  stage: string;
  deliverable: string;
  summary: string | null;
  detail_points: string[] | null;
  prompt: string | null;
}

export function useMarketing(locationId?: string | null) {
  return useQuery<Campaign[]>({
    queryKey: ["marketing", locationId],
    queryFn: () =>
      apiFetch(`/api/marketing${locationId ? `?location_id=${locationId}` : ""}`),
  });
}
