import type { ReactNode } from "react";
import { DemoBadge } from "@/components/demo/demo-badge";
import { DemoSimulatedDataDrawer } from "@/components/demo/demo-simulated-data-drawer";
import type { DemoRestaurantLanding } from "@/lib/types";

export function DemoPageShell({
  restaurant,
  title,
  description,
  children,
}: {
  restaurant: Pick<
    DemoRestaurantLanding,
    "name" | "public_sources" | "inferred_points" | "simulated_objects" | "onboarding_differences"
  >;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 justify-center bg-background px-4 py-6 text-foreground">
      <div className="flex w-full max-w-6xl flex-col gap-4">
        <header className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-4 py-3">
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">CarabinerOS</p>
              <p className="text-sm text-muted-foreground">Prepared for {restaurant.name}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DemoBadge />
              <DemoSimulatedDataDrawer
                restaurantName={restaurant.name}
                publicSources={restaurant.public_sources}
                inferredPoints={restaurant.inferred_points}
                simulatedObjects={restaurant.simulated_objects}
                onboardingDifferences={restaurant.onboarding_differences}
              />
            </div>
          </div>
          <div className="space-y-2 p-4">
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}
