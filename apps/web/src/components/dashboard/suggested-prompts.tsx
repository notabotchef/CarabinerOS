import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sparkles } from "lucide-react";

const FALLBACK_PROMPTS = [
  "Build today's produce order for River North using par levels and yesterday's sales mix.",
  "Review inventory shortages across all locations and generate an urgent prep list for dinner service.",
  "Calculate food cost pressure for the spring menu and suggest price updates that protect margin.",
  "Research three marketing campaign ideas for a new happy hour launch in West Loop.",
  "Summarize vendor issues from this week and draft follow-up actions by provider.",
  "Design a menu engineering brief showing stars, puzzles, plowhorses, and dogs.",
];

interface SuggestedPromptsProps {
  prompts: string[] | null;
}

export function SuggestedPrompts({ prompts }: SuggestedPromptsProps) {
  const data = prompts ?? FALLBACK_PROMPTS;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-muted-foreground" />
          <CardTitle>Ask CarabinerOS</CardTitle>
        </div>
        <CardDescription>Suggested prompts for today</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((prompt) => (
            <button
              key={prompt}
              className="rounded-lg border p-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {prompt}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
