"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DemoPageShell } from "@/components/demo/demo-page-shell";
import { buildFallbackDemoLanding } from "@/lib/demo-fallback";
import { fetchDemoLanding } from "@/lib/demo-client";
import type { DemoRestaurantLanding } from "@/lib/types";

export default function DemoInvitePage({
  params,
}: {
  params: { restaurantSlug: string };
}) {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<DemoRestaurantLanding>(buildFallbackDemoLanding(params.restaurantSlug));

  useEffect(() => {
    let active = true;
    fetchDemoLanding(params.restaurantSlug)
      .then((payload) => {
        if (active) {
          setRestaurant(payload);
        }
      })
      .catch(() => {
        if (active) {
          setRestaurant(buildFallbackDemoLanding(params.restaurantSlug));
        }
      });

    return () => {
      active = false;
    };
  }, [params.restaurantSlug]);

  return (
    <DemoPageShell
      restaurant={restaurant}
      title={`${restaurant.name} prepared demo`}
      description="CarabinerOS staged this personalized preview from public restaurant information. The demo is separate from onboarding and stays HTTP-first."
    >
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {restaurant.location_label}
            </p>
            <h2 className="text-xl font-semibold text-foreground">{restaurant.concept_line}</h2>
            <p className="text-sm text-muted-foreground">{restaurant.trust_line}</p>
          </div>

          <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Operational read</p>
            <p className="mt-2 text-sm text-foreground">{restaurant.operational_read}</p>
          </div>

          <div className="flex flex-wrap gap-4">
            <Button onClick={() => router.push(`/demo/create-account?restaurantSlug=${restaurant.slug}`)}>
              Create account to enter demo
            </Button>
            <Button variant="outline" onClick={() => router.push(`/demo/login?restaurantSlug=${restaurant.slug}`)}>
              Return to demo login
            </Button>
          </div>
        </div>

        <aside className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-foreground">What you will see</h3>
            <p className="text-sm text-muted-foreground">
              Recognition first, believable operational proof second, onboarding only after the demo earns it.
            </p>
          </div>

          <div className="space-y-4">
            {restaurant.proof_tiles.map((tile) => (
              <article key={tile.title} className="rounded-xl border border-border bg-background p-4 shadow-sm">
                <div className="space-y-2">
                  <h4 className="text-base font-semibold text-foreground">{tile.title}</h4>
                  <p className="text-sm text-muted-foreground">{tile.body}</p>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-lg border border-border px-4 py-3">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {tile.metric_label}
                  </span>
                  <span className="font-mono text-sm text-foreground">{tile.metric_value}</span>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </DemoPageShell>
  );
}
