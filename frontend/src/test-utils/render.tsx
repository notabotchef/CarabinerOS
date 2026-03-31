import React, { type ReactElement } from "react";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { A0Snapshot, A0Notification, ChefStatus } from "@/lib/types";

// Minimal SocketContext value for tests — no live socket connection
const defaultSocketValue = {
  connected: false,
  snapshot: null as A0Snapshot | null,
  chefStatus: null as ChefStatus | null,
  notifications: [] as A0Notification[],
  subscribe: (_contextId: string | null) => {},
};

// We lazily import SocketContext to avoid circular deps in tests.
// Tests that need a real socket context value should call renderWithSocket().
function AllProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): RenderResult {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Re-export everything from @testing-library/react so tests only need one import
export * from "@testing-library/react";
export { customRender as render };
export { defaultSocketValue };
