import type { DemoBadgeTone } from "@/lib/types";
import { cn } from "@/lib/utils";

const badgeCopy: Record<DemoBadgeTone, string> = {
  prepared: "Prepared demo",
  simulated: "Simulated data",
  "public-info": "Public-info based",
};

const badgeToneClasses: Record<DemoBadgeTone, string> = {
  prepared: "border-border bg-background text-foreground",
  simulated: "border-blue-500/20 bg-blue-500/10 text-foreground",
  "public-info": "border-emerald-400/20 bg-emerald-400/10 text-foreground",
};

export function DemoBadge({
  tone = "prepared",
  className,
  children,
}: {
  tone?: DemoBadgeTone;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-medium",
        badgeToneClasses[tone],
        className,
      )}
    >
      {children || badgeCopy[tone]}
    </span>
  );
}
