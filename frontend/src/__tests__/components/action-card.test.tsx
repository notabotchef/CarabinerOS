import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActionCard, TYPE_STYLES, getActionLabel } from "@/components/action-card";
import type { ActionCard as ActionCardType } from "@/lib/types";

// motion/react uses framer-motion animations that rely on DOM measurements.
// We stub the motion component to render a plain div so animation side-effects
// don't break the jsdom test environment.
vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button {...props}>{children}</button>
    ),
    span: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
      <span {...props}>{children}</span>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCard(overrides: Partial<ActionCardType> = {}): ActionCardType {
  return {
    id: "card-1",
    type: "action",
    module: "orders",
    action: "update",
    summary: "New produce order ready",
    detail: "Coastal Produce order needs review",
    changes: [],
    stats: [],
    priority: 0,
    status: "new",
    timestamp: 1711900000,
    source: "reactive",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ActionCard", () => {
  const onExpand = vi.fn();
  const onCommit = vi.fn();
  const onDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the summary text", () => {
    render(
      <ActionCard
        card={makeCard()}
        onExpand={onExpand}
      />,
    );
    expect(screen.getByText("New produce order ready")).toBeInTheDocument();
  });

  it("renders the module pill badge", () => {
    render(
      <ActionCard
        card={makeCard({ module: "inventory" })}
        onExpand={onExpand}
      />,
    );
    expect(screen.getByText("inventory")).toBeInTheDocument();
  });

  it("renders detail text when provided", () => {
    render(
      <ActionCard
        card={makeCard({ detail: "Sysco order confirmed for Monday delivery" })}
        onExpand={onExpand}
      />,
    );
    expect(screen.getByText("Sysco order confirmed for Monday delivery")).toBeInTheDocument();
  });

  it("calls onExpand when the card body is clicked", () => {
    render(
      <ActionCard
        card={makeCard({ id: "card-abc" })}
        onExpand={onExpand}
      />,
    );
    // Click the outer wrapper div — the one that calls onExpand
    const summary = screen.getByText("New produce order ready");
    fireEvent.click(summary);
    expect(onExpand).toHaveBeenCalledWith("card-abc");
  });

  it("calls onDismiss when the dismiss button is clicked", () => {
    render(
      <ActionCard
        card={makeCard({ id: "card-x" })}
        onExpand={onExpand}
        onDismiss={onDismiss}
      />,
    );
    const dismissBtn = screen.getByTitle("Dismiss");
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledWith("card-x");
  });

  it("calls onCommit when the send button is clicked", () => {
    render(
      <ActionCard
        card={makeCard({ id: "card-y" })}
        onExpand={onExpand}
        onCommit={onCommit}
      />,
    );
    const sendBtn = screen.getByTitle("Send");
    fireEvent.click(sendBtn);
    expect(onCommit).toHaveBeenCalledWith("card-y");
  });

  it("does not show dismiss/commit buttons when card is committed", () => {
    render(
      <ActionCard
        card={makeCard({ status: "committed" })}
        onExpand={onExpand}
        onDismiss={onDismiss}
        onCommit={onCommit}
      />,
    );
    expect(screen.queryByTitle("Dismiss")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Send")).not.toBeInTheDocument();
  });

  it("shows Done indicator when card is committed", () => {
    render(
      <ActionCard
        card={makeCard({ status: "committed" })}
        onExpand={onExpand}
      />,
    );
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  describe("card types", () => {
    const types: ActionCardType["type"][] = ["urgent", "action", "update", "info"];

    for (const type of types) {
      it(`renders ${type} card without crashing`, () => {
        const { container } = render(
          <ActionCard
            card={makeCard({ type })}
            onExpand={onExpand}
          />,
        );
        expect(container.firstChild).toBeTruthy();
      });
    }
  });
});

// ---------------------------------------------------------------------------
// TYPE_STYLES coverage
// ---------------------------------------------------------------------------

describe("TYPE_STYLES", () => {
  it("defines styles for all four card types", () => {
    const types: ActionCardType["type"][] = ["urgent", "action", "update", "info"];
    for (const type of types) {
      expect(TYPE_STYLES[type]).toBeDefined();
      expect(TYPE_STYLES[type].border).toBeTruthy();
      expect(TYPE_STYLES[type].pill).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// getActionLabel coverage
// ---------------------------------------------------------------------------

describe("getActionLabel", () => {
  it("returns 'Confirm' for urgent+orders", () => {
    expect(getActionLabel({ type: "urgent", module: "orders" })).toBe("Confirm");
  });

  it("returns '86 It' for urgent+inventory", () => {
    expect(getActionLabel({ type: "urgent", module: "inventory" })).toBe("86 It");
  });

  it("returns 'Got It' for info type (any module)", () => {
    expect(getActionLabel({ type: "info", module: "anything" })).toBe("Got It");
  });

  it("returns 'Review' as default fallback", () => {
    expect(getActionLabel({ type: "update", module: "unknownmodule" })).toBe("Review");
  });

  it("returns A0-specified action label when actions provided", () => {
    expect(getActionLabel({ type: "update", module: "orders", actions: [{ label: "Send Order", type: "primary" }] })).toBe("Send Order");
  });
});
