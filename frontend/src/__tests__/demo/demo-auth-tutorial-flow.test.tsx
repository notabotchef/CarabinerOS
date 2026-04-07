import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let mockPathname = "/demo/targetrestaurant";
const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams("restaurantSlug=targetrestaurant");
let demoSessionActive = false;

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key),
  }),
}));

const { AppRouteShell } = await import("@/components/app-route-shell");
const { default: DemoInvitePage } = await import("@/app/(demo)/demo/[restaurantSlug]/page");
const { default: DemoCreateAccountPage } = await import("@/app/(demo)/demo/create-account/page");
const { default: DemoTutorialPage } = await import("@/app/(demo)/demo/tutorial/page");

const landingPayload = {
  slug: "targetrestaurant",
  name: "Targetrestaurant",
  concept_line: "Seafood-forward neighborhood dining with tight dinner turns and premium produce sensitivity.",
  location_label: "Prepared for the flagship dining room",
  trust_line: "CarabinerOS prepared this demo from public restaurant information. Some details are inferred and simulated for demo mode.",
  operational_read: "Weekend dinner pressure and premium produce swings are likely shaping your prep, ordering, and vendor communication.",
  proof_tiles: [
    {
      title: "Order draft prepared for your menu",
      body: "A draft order is staged around seafood, citrus, herbs, and the next service window.",
      metric_label: "Confidence",
      metric_value: "84%",
    },
  ],
  public_sources: ["Restaurant website"],
  inferred_points: ["Weekend dinner demand appears strongest."],
  simulated_objects: ["Order drafts and notifications"],
  onboarding_differences: ["Real onboarding connects actual restaurant data."],
};

const tutorialPayload = {
  restaurant: {
    name: "Targetrestaurant",
    slug: "targetrestaurant",
    conceptLine: landingPayload.concept_line,
    trustLine: landingPayload.trust_line,
    operationalRead: landingPayload.operational_read,
  },
  steps: [
    {
      id: "welcome",
      title: "Welcome to the prepared demo",
      description: "This tutorial shows a staged CarabinerOS workspace built from public restaurant information. It is not onboarding.",
      proof: "You are looking at a demo-specific workspace with simulated operational objects and demo-safe outcomes.",
      cta_label: "Show the restaurant-specific read",
      status: "current",
    },
    {
      id: "restaurant-read",
      title: "See the restaurant-specific read",
      description: "CarabinerOS reflects your menu language, service shape, and the pressures most likely to matter first.",
      proof: "The staged workspace assumes seafood-forward ordering pressure and heavy weekend dinner demand.",
      cta_label: "Show the first proof point",
      status: "upcoming",
    },
  ],
  currentStepId: "welcome",
  completedStepIds: [],
  allComplete: false,
  nextWorkspacePath: "/demo/home",
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function renderRoute(pathname: string, child: React.ReactNode) {
  mockPathname = pathname;
  return render(<AppRouteShell>{child}</AppRouteShell>);
}

describe("demo auth and tutorial flow", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    demoSessionActive = false;
    mockPathname = "/demo/targetrestaurant";
    mockSearchParams = new URLSearchParams("restaurantSlug=targetrestaurant");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/demo/targetrestaurant" && (!init || init.method === undefined)) {
          return jsonResponse({ ok: true, data: landingPayload });
        }

        if (url === "/api/demo/account" && init?.method === "POST") {
          demoSessionActive = true;
          return jsonResponse({
            ok: true,
            data: {
              user: {
                name: "Chef Demo",
                email: "chef@targetrestaurant.com",
                restaurantSlug: "targetrestaurant",
              },
              nextPath: "/demo/tutorial",
              sessionMode: "http-only-cookie",
            },
          });
        }

        if (url.startsWith("/api/demo/tutorial") && (!init || init.method === undefined)) {
          if (!demoSessionActive) {
            return jsonResponse({ ok: false, error: "Demo session required." }, false, 401);
          }
          return jsonResponse({ ok: true, data: tutorialPayload });
        }

        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );
  });

  it("moves from invite to account creation and into the tutorial without touching onboarding", async () => {
    const user = userEvent.setup();

    renderRoute(
      "/demo/targetrestaurant",
      <DemoInvitePage params={{ restaurantSlug: "targetrestaurant" }} />,
    );

    expect(await screen.findByRole("heading", { name: "Targetrestaurant prepared demo" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create account to enter demo" }));
    expect(mockPush).toHaveBeenCalledWith("/demo/create-account?restaurantSlug=targetrestaurant");

    cleanup();
    mockSearchParams = new URLSearchParams("restaurantSlug=targetrestaurant");

    renderRoute("/demo/create-account", <DemoCreateAccountPage />);

    await user.type(screen.getByLabelText("Name"), "Chef Demo");
    await user.type(screen.getByLabelText("Work email"), "chef@targetrestaurant.com");
    await user.type(screen.getByLabelText("Password"), "super-secret");
    await user.click(screen.getByRole("button", { name: "Create account and start tutorial" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/demo/tutorial?restaurantSlug=targetrestaurant");
    });

    cleanup();
    mockPathname = "/demo/tutorial";
    renderRoute("/demo/tutorial", <DemoTutorialPage />);

    expect(await screen.findByRole("heading", { name: "Demo tutorial" })).toBeInTheDocument();
    expect(screen.getByText("This tutorial is a guided preview of CarabinerOS for Targetrestaurant. It is separate from onboarding.")).toBeInTheDocument();
    expect(screen.queryByText(/Start real onboarding/i)).not.toBeInTheDocument();
  });
});
