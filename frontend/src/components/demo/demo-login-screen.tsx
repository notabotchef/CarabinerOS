"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DemoAuthCard } from "@/components/demo/demo-auth-card";
import { DemoPageShell } from "@/components/demo/demo-page-shell";
import { fetchDemoLanding, loginToDemo } from "@/lib/demo-client";
import { buildFallbackDemoLanding } from "@/lib/demo-fallback";
import type { DemoRestaurantLanding } from "@/lib/types";

export function DemoLoginScreen({ restaurantSlug }: { restaurantSlug: string }) {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<DemoRestaurantLanding>(buildFallbackDemoLanding(restaurantSlug));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    fetchDemoLanding(restaurantSlug)
      .then((payload) => {
        if (active) {
          setRestaurant(payload);
        }
      })
      .catch(() => {
        if (active) {
          setRestaurant(buildFallbackDemoLanding(restaurantSlug));
        }
      });

    return () => {
      active = false;
    };
  }, [restaurantSlug]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await loginToDemo({
        restaurantSlug,
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
      });
      router.push(`${response.nextPath}?restaurantSlug=${restaurantSlug}`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to log into the demo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DemoPageShell
      restaurant={restaurant}
      title="Log into your prepared demo"
      description="Returning prospects go back to the demo tutorial without entering real onboarding."
    >
      <DemoAuthCard
        title="Resume the demo"
        description="Log in with the demo account you created for this prepared CarabinerOS workspace."
        restaurantName={restaurant.name}
        restaurantSummary={restaurant.concept_line}
        fields={[
          { name: "email", label: "Work email", type: "email" },
          { name: "password", label: "Password", type: "password" },
        ]}
        submitLabel="Log in to demo"
        error={error}
        loading={loading}
        onSubmit={handleSubmit}
        footer={
          <p className="text-sm text-muted-foreground">
            Need a demo account first?{" "}
            <button className="text-primary" type="button" onClick={() => router.push(`/demo/create-account?restaurantSlug=${restaurantSlug}`)}>
              Create one
            </button>
          </p>
        }
      />
    </DemoPageShell>
  );
}
