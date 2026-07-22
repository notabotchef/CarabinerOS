import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SolitaireCards } from "@/components/solitaire-cards";

// Stub motion/react to render plain divs so animation side-effects
// don't break the jsdom test environment.
vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    span: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
      <span {...props}>{children}</span>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock fetch for useSummary
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([]),
  } as Response),
) as typeof fetch;

// Mock window.matchMedia for useReducedMotion hook
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe("SolitaireCards — dashboard interactions (UI-001)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all four KPI cards", () => {
    render(<SolitaireCards />);
    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(screen.getByText("Food Cost")).toBeInTheDocument();
    expect(screen.getByText("Prep")).toBeInTheDocument();
    expect(screen.getByText("Covers")).toBeInTheDocument();
  });

  it("expands a card on click and shows detail overlay", () => {
    render(<SolitaireCards />);
    const ordersCard = screen.getByText("Orders").closest('[role="button"]');
    expect(ordersCard).toBeTruthy();
    fireEvent.click(ordersCard!);
    expect(screen.getByText("tap to close")).toBeInTheDocument();
  });

  it("collapses an expanded card on second click", () => {
    render(<SolitaireCards />);
    const ordersCard = screen.getByText("Orders").closest('[role="button"]');
    fireEvent.click(ordersCard!);
    expect(screen.getByText("tap to close")).toBeInTheDocument();
    fireEvent.click(ordersCard!);
    expect(screen.queryByText("tap to close")).not.toBeInTheDocument();
  });

  it("has aria-expanded attribute reflecting expanded state", () => {
    render(<SolitaireCards />);
    const ordersCard = screen.getByText("Orders").closest('[role="button"]');
    expect(ordersCard).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(ordersCard!);
    expect(ordersCard).toHaveAttribute("aria-expanded", "true");
  });

  it("has role=button and tabIndex=0 for keyboard accessibility", () => {
    render(<SolitaireCards />);
    const cards = screen.getAllByRole("button");
    expect(cards.length).toBe(4);
    cards.forEach((card) => {
      expect(card).toHaveAttribute("tabindex", "0");
    });
  });

  it("expands card on Enter key", () => {
    render(<SolitaireCards />);
    const ordersCard = screen.getByText("Orders").closest('[role="button"]');
    ordersCard!.focus();
    fireEvent.keyDown(ordersCard!, { key: "Enter" });
    expect(screen.getByText("tap to close")).toBeInTheDocument();
  });

  it("expands card on Space key", () => {
    render(<SolitaireCards />);
    const ordersCard = screen.getByText("Orders").closest('[role="button"]');
    ordersCard!.focus();
    fireEvent.keyDown(ordersCard!, { key: " " });
    expect(screen.getByText("tap to close")).toBeInTheDocument();
  });

  it("collapses card on Enter when already expanded", () => {
    render(<SolitaireCards />);
    const ordersCard = screen.getByText("Orders").closest('[role="button"]');
    fireEvent.click(ordersCard!);
    expect(screen.getByText("tap to close")).toBeInTheDocument();
    fireEvent.keyDown(ordersCard!, { key: "Enter" });
    expect(screen.queryByText("tap to close")).not.toBeInTheDocument();
  });

  it("only one card expanded at a time", () => {
    render(<SolitaireCards />);
    const ordersCard = screen.getByText("Orders").closest('[role="button"]');
    const foodCostCard = screen.getByText("Food Cost").closest('[role="button"]');
    fireEvent.click(ordersCard!);
    expect(screen.getByText("tap to close")).toBeInTheDocument();
    fireEvent.click(foodCostCard!);
    expect(screen.getByText("tap to close")).toBeInTheDocument();
    expect(ordersCard).toHaveAttribute("aria-expanded", "false");
    expect(foodCostCard).toHaveAttribute("aria-expanded", "true");
  });

  it("renders detail values in expanded state", () => {
    render(<SolitaireCards />);
    const ordersCard = screen.getByText("Orders").closest('[role="button"]');
    fireEvent.click(ordersCard!);
    expect(screen.getAllByText(/Total orders|Needs approval|Submitted|Delivered/).length).toBeGreaterThan(0);
  });

  it("falls back to mock values when API returns empty", () => {
    render(<SolitaireCards />);
    // When API returns empty arrays, Orders shows "0" (live), but
    // Food Cost, Prep, and Covers have no live data and fall back to mocks.
    // Food Cost: avgCost=0 -> value "—" -> mock "28.4%"
    expect(screen.getAllByText("28.4%")[0]).toBeInTheDocument();
    // Prep: total=0 -> value "—" -> mock "87%"
    expect(screen.getAllByText("87%")[0]).toBeInTheDocument();
    // Covers: hardcoded "142" (no API source)
    expect(screen.getAllByText("142")[0]).toBeInTheDocument();
  });
});

