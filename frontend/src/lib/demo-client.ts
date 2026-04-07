import type {
  DemoAuthResponse,
  DemoRestaurantLanding,
  DemoTutorialPayload,
} from "@/lib/types";

interface DemoEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function readDemoEnvelope<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as DemoEnvelope<T>;
  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || "Demo request failed.");
  }
  return payload.data;
}

export async function fetchDemoLanding(restaurantSlug: string): Promise<DemoRestaurantLanding> {
  const response = await fetch(`/api/demo/${restaurantSlug}`, {
    credentials: "include",
  });
  return readDemoEnvelope<DemoRestaurantLanding>(response);
}

export async function createDemoAccount(input: {
  restaurantSlug: string;
  name: string;
  email: string;
  password: string;
  mobile?: string;
}): Promise<DemoAuthResponse> {
  const response = await fetch("/api/demo/account", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return readDemoEnvelope<DemoAuthResponse>(response);
}

export async function loginToDemo(input: {
  restaurantSlug: string;
  email: string;
  password: string;
}): Promise<DemoAuthResponse> {
  const response = await fetch("/api/demo/login", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return readDemoEnvelope<DemoAuthResponse>(response);
}

export async function fetchDemoTutorial(restaurantSlug: string): Promise<DemoTutorialPayload> {
  const response = await fetch(`/api/demo/tutorial?restaurantSlug=${encodeURIComponent(restaurantSlug)}`, {
    credentials: "include",
  });
  return readDemoEnvelope<DemoTutorialPayload>(response);
}

export async function completeDemoTutorialStep(input: {
  restaurantSlug: string;
  stepId: string;
}): Promise<DemoTutorialPayload> {
  const response = await fetch("/api/demo/tutorial/progress", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return readDemoEnvelope<DemoTutorialPayload>(response);
}
