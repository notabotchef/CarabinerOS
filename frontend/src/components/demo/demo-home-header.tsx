import { DemoBadge } from "@/components/demo/demo-badge";
import type { DemoWorkspaceRestaurant } from "@/lib/types";

interface DemoHomeHeaderProps {
  restaurant: DemoWorkspaceRestaurant;
}

export function DemoHomeHeader({ restaurant }: DemoHomeHeaderProps) {
  return (
    <header className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <DemoBadge />
            <p className="text-xs font-medium text-muted-foreground">{restaurant.prepared_from}</p>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground md:text-3xl">{restaurant.name}</h1>
            <p className="text-sm text-foreground/80">{restaurant.identity} · {restaurant.location}</p>
          </div>
        </div>
        <div className="max-w-xl rounded-xl border border-border bg-background p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Morning brief</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{restaurant.brief}</p>
        </div>
      </div>
    </header>
  );
}
