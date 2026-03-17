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
} from "lucide-react";

const METRICS = [
  {
    label: "Orders Ready",
    value: "08",
    delta: "+3 today",
    trend: "up" as const,
    icon: ClipboardCheck,
  },
  {
    label: "Inventory Risks",
    value: "05",
    delta: "2 critical",
    trend: "down" as const,
    icon: PackageSearch,
  },
  {
    label: "Food Cost Alerts",
    value: "03",
    delta: "1 new",
    trend: "down" as const,
    icon: DollarSign,
  },
  {
    label: "Campaign Ideas",
    value: "12",
    delta: "for next launch",
    trend: "up" as const,
    icon: Lightbulb,
  },
];

export function MetricCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {METRICS.map((m) => (
        <Card key={m.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{m.label}</CardTitle>
            <m.icon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{m.value}</div>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              {m.trend === "up" ? (
                <TrendingUp className="size-3 text-emerald-500" />
              ) : (
                <TrendingDown className="size-3 text-amber-500" />
              )}
              {m.delta}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
