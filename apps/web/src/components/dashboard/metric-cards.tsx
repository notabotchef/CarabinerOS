import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ClipboardCheck,
  PackageSearch,
  DollarSign,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import type { Metric } from "@/lib/api";

const ICON_MAP: Record<string, LucideIcon> = {
  "Orders ready": ClipboardCheck,
  "Inventory risks": PackageSearch,
  "Food cost alerts": DollarSign,
  "Campaign ideas": Lightbulb,
};

const FALLBACK_METRICS = [
  { label: "Orders ready", value: "08", delta: "+3 today" },
  { label: "Inventory risks", value: "05", delta: "2 critical" },
  { label: "Food cost alerts", value: "03", delta: "1 new" },
  { label: "Campaign ideas", value: "12", delta: "for next launch" },
];

interface MetricCardsProps {
  metrics: Metric[] | null;
}

export function MetricCards({ metrics }: MetricCardsProps) {
  const data = metrics ?? FALLBACK_METRICS;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {data.map((m) => {
        const Icon = ICON_MAP[m.label] ?? Lightbulb;
        const isPositive = m.delta.startsWith("+") || m.delta.includes("launch");
        return (
          <Card key={m.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{m.label}</CardTitle>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{m.value}</div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                {isPositive ? (
                  <TrendingUp className="size-3 text-emerald-500" />
                ) : (
                  <TrendingDown className="size-3 text-amber-500" />
                )}
                {m.delta}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
