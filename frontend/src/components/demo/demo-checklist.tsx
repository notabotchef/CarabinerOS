import type { DemoTutorialStep } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusStyles: Record<DemoTutorialStep["status"], string> = {
  complete: "border-emerald-400/20 bg-emerald-400/10 text-foreground",
  current: "border-primary/20 bg-primary/10 text-foreground",
  upcoming: "border-border bg-background text-muted-foreground",
};

export function DemoChecklist({ steps }: { steps: DemoTutorialStep[] }) {
  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <div
          key={step.id}
          className={cn(
            "rounded-xl border p-4 shadow-sm",
            statusStyles[step.status],
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="font-mono text-[11px] uppercase tracking-wide">
                {String(index + 1).padStart(2, "0")}
              </p>
              <p className="text-sm font-medium">{step.title}</p>
            </div>
            <span className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium capitalize text-foreground">
              {step.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
