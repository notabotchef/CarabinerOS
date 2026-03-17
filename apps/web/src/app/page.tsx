import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";

const METRICS = [
  { label: "Orders ready", value: "08", delta: "+3 today" },
  { label: "Inventory risks", value: "05", delta: "2 critical" },
  { label: "Food cost alerts", value: "03", delta: "1 new" },
  { label: "Campaign ideas", value: "12", delta: "for next launch" },
];

const SUGGESTED_PROMPTS = [
  "Build today's produce order for River North using par levels and yesterday's sales mix.",
  "Review inventory shortages across all locations and generate an urgent prep list for dinner service.",
  "Calculate food cost pressure for the spring menu and suggest price updates that protect margin.",
  "Research three marketing campaign ideas for a new happy hour launch in West Loop.",
  "Summarize vendor issues from this week and draft follow-up actions by provider.",
  "Design a menu engineering brief showing stars, puzzles, plowhorses, and dogs.",
];

const INBOX = [
  {
    id: "inbox-1",
    title: "River North avocados are 14% above target cost",
    priority: "high",
    module: "food-cost",
  },
  {
    id: "inbox-2",
    title: "West Loop needs tomorrow's bakery order by 4 PM",
    priority: "medium",
    module: "orders",
  },
  {
    id: "inbox-3",
    title: "Fulton Market prep plan is missing brunch counts",
    priority: "medium",
    module: "prep",
  },
];

function priorityColor(priority: string) {
  switch (priority) {
    case "high":
      return "destructive" as const;
    case "medium":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <div>
          <h1 className="text-2xl font-bold">Good morning</h1>
          <p className="text-sm text-muted-foreground">
            River North &middot; 3 locations monitored
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {METRICS.map((m) => (
          <Card key={m.label}>
            <CardHeader className="pb-2">
              <CardDescription>{m.label}</CardDescription>
              <CardTitle className="text-3xl">{m.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{m.delta}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Inbox */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Inbox</CardTitle>
          <CardDescription>Operational exceptions needing attention</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {INBOX.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <span className="text-sm">{item.title}</span>
              <div className="flex items-center gap-2">
                <Badge variant={priorityColor(item.priority)}>
                  {item.priority}
                </Badge>
                <Badge variant="outline">{item.module}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Suggested Prompts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ask CarabinerOS</CardTitle>
          <CardDescription>Suggested prompts for today</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                className="rounded-md border p-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {prompt}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
