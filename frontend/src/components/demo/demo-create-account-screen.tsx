"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DemoPageShell } from "@/components/demo/demo-page-shell";
import { DemoAuthCard } from "@/components/demo/demo-auth-card";
import { buildFallbackDemoLanding } from "@/lib/demo-fallback";
import { createDemoAccount, fetchDemoLanding } from "@/lib/demo-client";
import type { DemoRestaurantLanding } from "@/lib/types";

export function DemoCreateAccountScreen({ restaurantSlug }: { restaurantSlug: string }) {
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
      const response = await createDemoAccount({
        restaurantSlug,
        name: String(formData.get("name") || ""),
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
        mobile: String(formData.get("mobile") || ""),
      });
      router.push(`${response.nextPath}?restaurantSlug=${restaurantSlug}`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to create demo account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DemoPageShell
      restaurant={restaurant}
      title="Create your demo account"
      description="Account creation opens the tutorial immediately. This demo uses an HTTP-only session cookie and stays separate from live onboarding."
    >
      <DemoAuthCard
        title="Enter the prepared demo"
        description="Create a lightweight demo account so CarabinerOS can keep your tutorial progress in a secure HTTP-only session."
        restaurantName={restaurant.name}
        restaurantSummary={restaurant.concept_line}
        fields={[
          { name: "name", label: "Name" },
          { name: "email", label: "Work email", type: "email" },
          { name: "password", label: "Password", type: "password" },
          { name: "mobile", label: "Mobile number", type: "tel", optional: true },
        ]}
        submitLabel="Create account and start tutorial"
        error={error}
        loading={loading}
        onSubmit={handleSubmit}
        footer={
          <p className="text-sm text-muted-foreground">
            Already entered the demo?{" "}
            <button className="text-primary" type="button" onClick={() => router.push(`/demo/login?restaurantSlug=${restaurantSlug}`)}>
              Log in
            </button>
          </p>
        }
      />
    </DemoPageShell>
  );
}
