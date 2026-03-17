import { Badge } from "@/components/ui/badge";

const INBOX = [
  {
    id: "inbox-1",
    title: "River North avocados are 14% above target cost",
    priority: "high" as const,
    module: "food-cost",
    time: "2h ago",
  },
  {
    id: "inbox-2",
    title: "West Loop needs tomorrow's bakery order by 4 PM",
    priority: "medium" as const,
    module: "orders",
    time: "3h ago",
  },
  {
    id: "inbox-3",
    title: "Fulton Market prep plan is missing brunch counts",
    priority: "medium" as const,
    module: "prep",
    time: "5h ago",
  },
  {
    id: "inbox-4",
    title: "River North wine inventory below par for weekend",
    priority: "high" as const,
    module: "inventory",
    time: "6h ago",
  },
  {
    id: "inbox-5",
    title: "West Loop labor schedule needs Thursday coverage",
    priority: "medium" as const,
    module: "admin",
    time: "8h ago",
  },
];

function priorityVariant(priority: string) {
  return priority === "high" ? ("destructive" as const) : ("secondary" as const);
}

export function InboxList() {
  return (
    <div className="space-y-4">
      {INBOX.map((item) => (
        <div key={item.id} className="flex items-start gap-3">
          <span
            className={`mt-1.5 size-2 shrink-0 rounded-full ${
              item.priority === "high" ? "bg-destructive" : "bg-amber-500"
            }`}
          />
          <div className="flex-1 space-y-1">
            <p className="text-sm leading-snug">{item.title}</p>
            <div className="flex items-center gap-2">
              <Badge variant={priorityVariant(item.priority)} className="text-[10px] px-1.5 py-0">
                {item.priority}
              </Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {item.module}
              </Badge>
              <span className="text-[10px] text-muted-foreground">{item.time}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
