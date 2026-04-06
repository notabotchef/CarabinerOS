import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DemoActionCardSequence } from "@/components/demo/demo-action-card-sequence";
import { demoWorkspaceFixture } from "@/lib/demo-fixture";

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("DemoActionCardSequence", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        result: {
          cardId: "demo-order-draft",
          operation: "commit",
          title: "Sandbox result",
          detail: "Prepared action for 'Produce order draft is ready for tomorrow's brunch and dinner service' was recorded in demo mode. No live email or vendor send was triggered.",
          sandboxOnly: true,
          realSendAttempted: false,
          deliveryChannel: "http",
          timestamp: "2026-04-05T15:00:00Z",
        },
      }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens a demo card and shows the sandbox result after commit", async () => {
    const user = userEvent.setup();

    render(
      <DemoActionCardSequence
        initialCards={demoWorkspaceFixture.cards}
        actionEndpoint={demoWorkspaceFixture.actionEndpoint}
      />,
    );

    await user.click(screen.getByText("Draft a vendor note before avocado pricing locks higher"));
    expect(screen.getByText("Based on public menu and pricing assumptions")).toBeInTheDocument();

    await user.click(screen.getByTitle("Commit this card"));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/demo/card-action",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(await screen.findByTestId("demo-sandbox-result")).toBeInTheDocument();
    expect(screen.getByText("Sandbox result")).toBeInTheDocument();
    expect(screen.getByText(/No live email or vendor send was triggered/)).toBeInTheDocument();
  });
});
