"use client";

import type { DemoTutorialPayload } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/demo/demo-badge";
import { DemoChecklist } from "@/components/demo/demo-checklist";
import { DemoSimulatedDataDrawer } from "@/components/demo/demo-simulated-data-drawer";

export function DemoTutorialShell({
  payload,
  loading,
  error,
  onAdvance,
}: {
  payload: DemoTutorialPayload | null;
  loading: boolean;
  error: string | null;
  onAdvance: () => Promise<void> | void;
}) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Loading the prepared tutorial…</p>
        </div>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 shadow-sm">
          <p className="text-sm text-foreground">{error || "Unable to load the demo tutorial."}</p>
        </div>
      </div>
    );
  }

  const currentStep = payload.steps.find((step) => step.id === payload.currentStepId) || payload.steps[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <DemoBadge />
            <DemoBadge tone="simulated" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Demo tutorial</h1>
          <p className="text-sm text-muted-foreground">
            This tutorial is a guided preview of CarabinerOS for {payload.restaurant.name}. It is separate from onboarding.
          </p>
        </div>

        <DemoChecklist steps={payload.steps} />
      </aside>

      <section className="space-y-6 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-4 py-3">
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Prepared from public restaurant information
            </p>
            <h2 className="text-xl font-semibold text-foreground">{currentStep.title}</h2>
          </div>

          <DemoSimulatedDataDrawer
            restaurantName={payload.restaurant.name}
            publicSources={[payload.restaurant.trustLine]}
            inferredPoints={[payload.restaurant.operationalRead]}
            simulatedObjects={["Tutorial progress and object-level labels stay in demo mode until onboarding."]}
            onboardingDifferences={["Real onboarding replaces simulated workflows with connected operational data."]}
          />
        </div>

        <div className="space-y-6 p-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{currentStep.description}</p>
            <p className="rounded-xl border border-border bg-background p-4 text-sm text-foreground shadow-sm">
              {currentStep.proof}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Restaurant read</p>
              <p className="mt-2 text-base font-semibold text-foreground">{payload.restaurant.conceptLine}</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Operational read</p>
              <p className="mt-2 text-sm text-foreground">{payload.restaurant.operationalRead}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Tutorial complete leads into the demo workspace in the next slice. This branch intentionally stops before onboarding and before the live operator shell.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {payload.allComplete
              ? "Tutorial complete. Demo workspace follows in Slice 3."
              : "Advance one proof point at a time. Keep the demo distinct from onboarding."}
          </p>
          <Button onClick={onAdvance}>{payload.allComplete ? "Review tutorial" : currentStep.cta_label}</Button>
        </div>
      </section>
    </div>
  );
}
