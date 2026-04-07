"use client";

import { useEffect, useMemo, useState } from "react";
import { DemoPageShell } from "@/components/demo/demo-page-shell";
import { DemoTutorialShell } from "@/components/demo/demo-tutorial-shell";
import { buildFallbackDemoLanding } from "@/lib/demo-fallback";
import { completeDemoTutorialStep, fetchDemoLanding, fetchDemoTutorial } from "@/lib/demo-client";
import type { DemoRestaurantLanding, DemoTutorialPayload } from "@/lib/types";

export function DemoTutorialScreen({ restaurantSlug }: { restaurantSlug: string }) {
  const [restaurant, setRestaurant] = useState<DemoRestaurantLanding>(buildFallbackDemoLanding(restaurantSlug));
  const [payload, setPayload] = useState<DemoTutorialPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.allSettled([fetchDemoLanding(restaurantSlug), fetchDemoTutorial(restaurantSlug)]).then((results) => {
      if (!active) {
        return;
      }

      const [landingResult, tutorialResult] = results;

      if (landingResult.status === "fulfilled") {
        setRestaurant(landingResult.value);
      }

      if (tutorialResult.status === "fulfilled") {
        setPayload(tutorialResult.value);
        setError(null);
      } else {
        setError("Log in or create a demo account to continue the tutorial.");
      }

      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [restaurantSlug]);

  const shellRestaurant = useMemo(
    () =>
      payload
        ? {
            ...restaurant,
            name: payload.restaurant.name,
          }
        : restaurant,
    [payload, restaurant],
  );

  async function handleAdvance() {
    if (!payload || payload.allComplete) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const updatedPayload = await completeDemoTutorialStep({
        restaurantSlug,
        stepId: payload.currentStepId,
      });
      setPayload(updatedPayload);
    } catch (advanceError) {
      setError(advanceError instanceof Error ? advanceError.message : "Unable to update tutorial progress.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DemoPageShell
      restaurant={shellRestaurant}
      title="Guided demo tutorial"
      description="This is a short proof-oriented tutorial for the prepared demo. It is not the same as CarabinerOS onboarding."
    >
      <DemoTutorialShell payload={payload} loading={loading} error={error} onAdvance={handleAdvance} />
    </DemoPageShell>
  );
}
