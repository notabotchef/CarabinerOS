"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Sparkles } from "lucide-react";
import { DemoActionCardSequence } from "@/components/demo/demo-action-card-sequence";
import { DemoEmailPreviewCard } from "@/components/demo/demo-email-preview-card";
import { DemoHomeHeader } from "@/components/demo/demo-home-header";
import { demoWorkspaceFixture } from "@/lib/demo-fixture";
import type { DemoWorkspacePayload } from "@/lib/types";

function normalizePayload(payload: unknown): DemoWorkspacePayload {
  if (!payload || typeof payload !== "object") {
    return demoWorkspaceFixture;
  }

  const candidate = payload as Record<string, unknown>;
  return {
    restaurant: (candidate.restaurant as DemoWorkspacePayload["restaurant"]) ?? demoWorkspaceFixture.restaurant,
    notifications: (candidate.notifications as DemoWorkspacePayload["notifications"]) ?? demoWorkspaceFixture.notifications,
    cards: ((candidate.cards as DemoWorkspacePayload["cards"]) ?? demoWorkspaceFixture.cards).slice(0, 3),
    emailPreview: (candidate.emailPreview as DemoWorkspacePayload["emailPreview"]) ?? demoWorkspaceFixture.emailPreview,
    actionEndpoint: (candidate.actionEndpoint as string) ?? demoWorkspaceFixture.actionEndpoint,
    simulation: (candidate.simulation as DemoWorkspacePayload["simulation"]) ?? demoWorkspaceFixture.simulation,
  };
}

export default function DemoHomePage() {
  const [workspace, setWorkspace] = useState<DemoWorkspacePayload>(demoWorkspaceFixture);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadWorkspace = async () => {
      try {
        const response = await fetch("/api/demo/workspace", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Demo workspace failed with status ${response.status}`);
        }
        const payload = await response.json();
        if (!cancelled) {
          setWorkspace(normalizePayload(payload));
        }
      } catch {
        if (!cancelled) {
          setWorkspace(demoWorkspaceFixture);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex flex-1 bg-background px-4 py-6 md:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <DemoHomeHeader restaurant={workspace.restaurant} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
          <DemoActionCardSequence initialCards={workspace.cards} actionEndpoint={workspace.actionEndpoint} />

          <div className="space-y-6">
            <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Prepared notifications</p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">What CarabinerOS thinks matters today</h2>
                </div>
                <Sparkles className="size-4 text-primary" />
              </div>

              <div className="mt-4 space-y-3">
                {workspace.notifications.map((notification) => (
                  <div key={notification.id} className="rounded-xl border border-border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                      <span className="text-xs text-muted-foreground">{notification.timestamp}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{notification.detail}</p>
                  </div>
                ))}
              </div>
            </section>

            <DemoEmailPreviewCard email={workspace.emailPreview} />

            <section className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">HTTP-only demo workspace</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    This route loads over HTTP, caps action cards at three, and keeps every send inside the sandbox.
                    {loading ? " Loading the prepared payload..." : ""}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
