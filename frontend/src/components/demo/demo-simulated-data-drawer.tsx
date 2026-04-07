"use client";

import type { ReactElement } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/demo/demo-badge";

function DemoDrawerSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <section className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </div>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="rounded-lg border border-border bg-background p-4 shadow-sm">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DemoSimulatedDataDrawer({
  restaurantName,
  publicSources,
  inferredPoints,
  simulatedObjects,
  onboardingDifferences,
  trigger,
}: {
  restaurantName: string;
  publicSources: string[];
  inferredPoints: string[];
  simulatedObjects: string[];
  onboardingDifferences: string[];
  trigger?: ReactElement;
}) {
  return (
    <Sheet>
      <SheetTrigger render={trigger || <Button variant="ghost">How this demo was prepared</Button>} />
      <SheetContent side="right" className="w-full border-border bg-background p-0 shadow-md sm:max-w-xl">
        <SheetHeader className="border-b border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <DemoBadge />
            <DemoBadge tone="public-info" />
          </div>
          <SheetTitle>How this demo was prepared</SheetTitle>
          <SheetDescription>
            CarabinerOS staged this workspace for {restaurantName} from public restaurant information. This is a demo, not onboarding.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 overflow-y-auto p-4">
          <DemoDrawerSection title="Public signals used" items={publicSources} />
          <DemoDrawerSection title="What CarabinerOS inferred" items={inferredPoints} />
          <DemoDrawerSection title="What stays simulated in the demo" items={simulatedObjects} />
          <DemoDrawerSection title="What becomes real during onboarding" items={onboardingDifferences} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
