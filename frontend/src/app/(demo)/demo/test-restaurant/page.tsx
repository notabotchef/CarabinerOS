import { DemoPageShell } from "@/components/demo/demo-page-shell";

const placeholderRestaurant = {
  name: "Target Restaurant",
  public_sources: [
    "Public menu, hours, and reservation profile",
    "Yelp and Google reviews",
    "Instagram posts and press mentions",
  ],
  inferred_points: [
    "Lunch-to-dinner service rhythm with weekend covers spike",
    "Produce-forward menu with weekly vendor cycles",
    "Owner-operated kitchen with limited prep cover",
  ],
  simulated_objects: [
    "Order draft action card",
    "Vendor outreach email preview",
    "Coverage notification rail",
  ],
  onboarding_differences: [
    "Real Toast cover and sales data",
    "Live vendor catalog and pricing",
    "Operator-defined approval rules",
  ],
};

export default function DemoTestRestaurantPage() {
  return (
    <DemoPageShell
      restaurant={placeholderRestaurant}
      title="Targetrestaurant demo placeholder"
      description="Slice 0 isolation surface. This page renders without the live operator shell, socket bootstrap, or action-card rail."
    >
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-base font-semibold text-foreground">Demo-only surface</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Safe entry point for the targetrestaurant invite, tutorial, and workspace slices. The
            full prospect flow ships from <span className="font-mono">/demo/:restaurantSlug</span>.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-base font-semibold text-foreground">HTTP-first v1</p>
          <p className="mt-2 text-sm text-muted-foreground">
            No live sockets, no operator chrome, no Agent Zero dev framing. CarabinerOS-first copy
            only, calibrated against <span className="font-mono">DESIGN_TOKENS.md</span>.
          </p>
        </div>
      </section>
    </DemoPageShell>
  );
}
