import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  getMockSocket,
  resetSocketMock,
  mockSocketEmit,
  socketClientMock,
} from "@/test-utils/socket-mock";
import type { ActionCard } from "@/lib/types";

// ---------------------------------------------------------------------------
// Module-level mocks — must be at top level before any imports of the module
// ---------------------------------------------------------------------------

vi.mock("@/lib/socket-client", () => socketClientMock());

// Import after mock registration
const { useActionCards } = await import("@/hooks/use-action-cards");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCard(overrides: Partial<ActionCard> = {}): ActionCard {
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
    timestamp: Math.floor(Date.now() / 1000),
    source: "reactive",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useActionCards", () => {
  beforeEach(() => {
    resetSocketMock();
    // Clear sessionStorage between tests
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with empty cards array", () => {
    const { result } = renderHook(() => useActionCards());
    expect(result.current.cards).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it("adds a card when action_card socket event fires", () => {
    const { result } = renderHook(() => useActionCards());

    act(() => {
      mockSocketEmit("action_card", { card: makeCard({ id: "new-card" }) });
    });

    expect(result.current.cards).toHaveLength(1);
    expect(result.current.cards[0].id).toBe("new-card");
  });

  it("updates existing card rather than duplicating on same id", () => {
    const { result } = renderHook(() => useActionCards());

    act(() => {
      mockSocketEmit("action_card", { card: makeCard({ id: "c1", summary: "Original" }) });
    });
    act(() => {
      mockSocketEmit("action_card", { card: makeCard({ id: "c1", summary: "Updated" }) });
    });

    expect(result.current.cards).toHaveLength(1);
    expect(result.current.cards[0].summary).toBe("Updated");
  });

  it("increments unreadCount for cards with status 'new'", () => {
    const { result } = renderHook(() => useActionCards());

    act(() => {
      mockSocketEmit("action_card", { card: makeCard({ id: "c1", status: "new" }) });
      mockSocketEmit("action_card", { card: makeCard({ id: "c2", status: "new" }) });
    });

    expect(result.current.unreadCount).toBe(2);
  });

  it("removes a card on dismissCard", () => {
    const { result } = renderHook(() => useActionCards());

    act(() => {
      mockSocketEmit("action_card", { card: makeCard({ id: "dismiss-me" }) });
    });
    expect(result.current.cards).toHaveLength(1);

    act(() => {
      result.current.dismissCard("dismiss-me");
    });

    expect(result.current.cards).toHaveLength(0);
  });

  it("emits card_dismiss event on dismissCard", () => {
    const { result } = renderHook(() => useActionCards());
    const socket = getMockSocket();

    act(() => {
      mockSocketEmit("action_card", { card: makeCard({ id: "c-dismiss" }) });
    });
    act(() => {
      result.current.dismissCard("c-dismiss");
    });

    expect(socket.emit).toHaveBeenCalledWith("card_dismiss", { cardId: "c-dismiss" });
  });

  it("sets card status to committed on commitCard", () => {
    const { result } = renderHook(() => useActionCards());

    act(() => {
      mockSocketEmit("action_card", { card: makeCard({ id: "commit-me" }) });
    });
    act(() => {
      result.current.commitCard("commit-me");
    });

    const card = result.current.cards.find((c) => c.id === "commit-me");
    expect(card?.status).toBe("committed");
  });

  it("emits card_commit event on commitCard", () => {
    const { result } = renderHook(() => useActionCards());
    const socket = getMockSocket();

    act(() => {
      mockSocketEmit("action_card", { card: makeCard({ id: "c-commit" }) });
    });
    act(() => {
      result.current.commitCard("c-commit");
    });

    expect(socket.emit).toHaveBeenCalledWith("card_commit", { cardId: "c-commit" });
  });

  it("returns sortedCards with committed cards last", () => {
    const { result } = renderHook(() => useActionCards());

    act(() => {
      mockSocketEmit("action_card", { card: makeCard({ id: "c1", status: "new", priority: 0 }) });
      mockSocketEmit("action_card", { card: makeCard({ id: "c2", status: "new", priority: 1 }) });
    });
    act(() => {
      result.current.commitCard("c2");
    });

    const ids = result.current.sortedCards.map((c) => c.id);
    expect(ids[ids.length - 1]).toBe("c2");
  });

  it("markAllRead sets all 'new' cards to 'read'", () => {
    const { result } = renderHook(() => useActionCards());

    act(() => {
      mockSocketEmit("action_card", { card: makeCard({ id: "r1", status: "new" }) });
      mockSocketEmit("action_card", { card: makeCard({ id: "r2", status: "new" }) });
    });
    act(() => {
      result.current.markAllRead();
    });

    expect(result.current.unreadCount).toBe(0);
    for (const card of result.current.cards) {
      expect(card.status).toBe("read");
    }
  });

  it("expandCard sets expandedCardId", () => {
    const { result } = renderHook(() => useActionCards());

    act(() => {
      result.current.expandCard("exp-id");
    });

    expect(result.current.expandedCardId).toBe("exp-id");
  });

  it("collapseCard clears expandedCardId", () => {
    const { result } = renderHook(() => useActionCards());

    act(() => {
      result.current.expandCard("exp-id");
    });
    act(() => {
      result.current.collapseCard();
    });

    expect(result.current.expandedCardId).toBeNull();
  });
});
