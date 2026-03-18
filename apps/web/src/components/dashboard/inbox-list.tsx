import { Badge } from "@/components/ui/badge";
import type { InboxItem } from "@/lib/api";

const FALLBACK_INBOX = [
  { id: "1", title: "Avocado cost spike requires menu action", priority: "High", module: "food-cost" },
  { id: "2", title: "Bakery cutoff is approaching", priority: "Medium", module: "orders" },
  { id: "3", title: "Brunch prep counts are incomplete", priority: "Medium", module: "prep" },
];

function priorityVariant(priority: string) {
  return priority.toLowerCase() === "high" ? ("destructive" as const) : ("secondary" as const);
}

interface InboxListProps {
  items: InboxItem[] | null;
}

export function InboxList({ items }: InboxListProps) {
  const data = items ?? FALLBACK_INBOX;

  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.id} className="flex items-start gap-3">
          <span
            className={`mt-1.5 size-2 shrink-0 rounded-full ${
              item.priority.toLowerCase() === "high" ? "bg-destructive" : "bg-amber-500"
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
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
