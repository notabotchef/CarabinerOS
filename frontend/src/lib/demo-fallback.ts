import type { DemoRestaurantLanding } from "@/lib/types";

function slugToName(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ") || "Demo Restaurant";
}

export function buildFallbackDemoLanding(restaurantSlug: string): DemoRestaurantLanding {
  const name = slugToName(restaurantSlug);
  return {
    slug: restaurantSlug,
    name,
    concept_line: "Prepared CarabinerOS demo with restaurant-specific simulated workflows.",
    location_label: `Prepared for ${name}`,
    trust_line: "CarabinerOS prepared this demo from public restaurant information. Some details are inferred and simulated.",
    operational_read: "The demo highlights the first few workflows most likely to matter to this restaurant.",
    proof_tiles: [
      {
        title: "Prepared order proof",
        body: "A staged workflow shows how CarabinerOS would begin with a believable operational action.",
        metric_label: "Confidence",
        metric_value: "80%",
      },
      {
        title: "Notification example",
        body: "A simulated notification shows how the product would surface proactive restaurant pressure.",
        metric_label: "Prepared at",
        metric_value: "07:10",
      },
      {
        title: "Draft outreach",
        body: "A demo-safe draft reinforces that this is product behavior, not a marketing slide.",
        metric_label: "Drafts",
        metric_value: "01",
      },
    ],
    public_sources: ["Public restaurant website", "Published menu and visible concept cues"],
    inferred_points: ["Public signals informed the first demo workflows."],
    simulated_objects: ["Operational objects stay in demo mode until onboarding."],
    onboarding_differences: ["Real onboarding connects your actual restaurant data."],
  };
}
