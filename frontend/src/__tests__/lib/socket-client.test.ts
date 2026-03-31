import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { csrfMock } from "@/test-utils/socket-mock";

// ---------------------------------------------------------------------------
// We mock socket.io-client at the module level so no real network connections
// are made in the test environment.
// ---------------------------------------------------------------------------

const mockSocketInstance = {
  on: vi.fn().mockReturnThis(),
  off: vi.fn().mockReturnThis(),
  emit: vi.fn().mockReturnThis(),
  connect: vi.fn().mockReturnThis(),
  disconnect: vi.fn().mockReturnThis(),
  connected: false,
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocketInstance),
}));

vi.mock("@/lib/csrf", () => csrfMock());

// Import after mocks are registered
const { io } = await import("socket.io-client");
const { getCsrfToken } = await import("@/lib/csrf");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("socket-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the singleton state between tests by re-importing a fresh module.
    // Vitest caches modules, so we use vi.resetModules() to force a fresh state.
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("creates socket with /ws namespace", async () => {
    // Re-mock after resetModules
    vi.mock("socket.io-client", () => ({
      io: vi.fn(() => mockSocketInstance),
    }));
    vi.mock("@/lib/csrf", () => csrfMock());

    const { initStateSyncSocket } = await import("@/lib/socket-client");
    initStateSyncSocket();

    expect(io).toHaveBeenCalledWith(
      expect.stringMatching(/\/ws$/),
      expect.objectContaining({
        withCredentials: true,
        transports: expect.arrayContaining(["polling", "websocket"]),
      }),
    );
  });

  it("returns the same socket instance on subsequent calls (singleton)", async () => {
    vi.mock("socket.io-client", () => ({
      io: vi.fn(() => mockSocketInstance),
    }));
    vi.mock("@/lib/csrf", () => csrfMock());

    const { initStateSyncSocket } = await import("@/lib/socket-client");

    const first = initStateSyncSocket();
    const second = initStateSyncSocket();

    expect(first).toBe(second);
    expect(io).toHaveBeenCalledTimes(1);
  });

  it("registers connect_error handler on init", async () => {
    vi.mock("socket.io-client", () => ({
      io: vi.fn(() => mockSocketInstance),
    }));
    vi.mock("@/lib/csrf", () => csrfMock());

    const { initStateSyncSocket } = await import("@/lib/socket-client");
    initStateSyncSocket();

    expect(mockSocketInstance.on).toHaveBeenCalledWith(
      "connect_error",
      expect.any(Function),
    );
  });

  it("disconnectAll clears the singleton", async () => {
    vi.mock("socket.io-client", () => ({
      io: vi.fn(() => mockSocketInstance),
    }));
    vi.mock("@/lib/csrf", () => csrfMock());

    const { initStateSyncSocket, getStateSyncSocket, disconnectAll } =
      await import("@/lib/socket-client");

    initStateSyncSocket();
    expect(getStateSyncSocket()).not.toBeNull();

    disconnectAll();
    expect(getStateSyncSocket()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getCsrfToken tests (via csrf.ts)
// ---------------------------------------------------------------------------

describe("getCsrfToken", () => {
  it("resolves with a token string", async () => {
    const token = await getCsrfToken();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });
});
