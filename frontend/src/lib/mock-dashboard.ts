/**
 * Mock dashboard fallback values.
 *
 * Used by `frontend/src/components/solitaire-cards.tsx` when the live
 * summary endpoints return no usable data (null / undefined / empty array
 * / undefined fields). The shared helper keeps the four bottom KPI cards
 * rendering deterministically for the investor demo, without touching
 * the backend APIs or database.
 *
 * Rule: live data always wins. Mocks are only a fallback.
 */

import type { LucideIcon } from "lucide-react";
import {
  ShoppingCart,
  DollarSign,
  ChefHat,
  UtensilsCrossed,
} from "lucide-react";

export interface MockKpiCard {
  label: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  barWidth: string;
  details: { label: string; value: string }[];
}

export const MOCK_DASHBOARD: MockKpiCard[] = [
  {
    label: "Orders",
    value: "6",
    subtitle: "4 sent \u00b7 2 pending",
    icon: ShoppingCart,
    barWidth: "w-[67%]",
    details: [
      { label: "Sent", value: "4" },
      { label: "Pending", value: "2" },
      { label: "Drafts", value: "1" },
      { label: "Cancelled", value: "0" },
    ],
  },
  {
    label: "Food Cost",
    value: "28.4%",
    subtitle: "down 2.8% vs last week",
    icon: DollarSign,
    barWidth: "w-[71%]",
    details: [
      { label: "This week", value: "28.4%" },
      { label: "Last week", value: "31.2%" },
      { label: "Target", value: "27.0%" },
      { label: "Variance", value: "-2.8 pts" },
    ],
  },
  {
    label: "Prep",
    value: "87%",
    subtitle: "13 of 15 complete",
    icon: ChefHat,
    barWidth: "w-[87%]",
    details: [
      { label: "Complete", value: "13" },
      { label: "In progress", value: "2" },
      { label: "Blocked", value: "0" },
      { label: "Total", value: "15" },
    ],
  },
  {
    label: "Covers",
    value: "142",
    subtitle: "proj. 185",
    icon: UtensilsCrossed,
    barWidth: "w-[77%]",
    details: [
      { label: "Seated now", value: "142" },
      { label: "Projected", value: "185" },
      { label: "Walk-ins", value: "23" },
      { label: "Reservations", value: "8 remaining" },
    ],
  },
];

/**
 * Pick the mock card that matches `label` (case-insensitive). Used as a
 * one-shot fallback — never merged with live data.
 */
export function getMockCard(label: string): MockKpiCard | undefined {
  return MOCK_DASHBOARD.find(
    (c) => c.label.toLowerCase() === label.toLowerCase(),
  );
}