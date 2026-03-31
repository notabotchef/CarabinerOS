import { vi } from "vitest";

// ---------------------------------------------------------------------------
// Socket mock state
// ---------------------------------------------------------------------------

type EventHandler = (...args: unknown[]) => void;

interface MockSocket {
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  connected: boolean;
  _handlers: Map<string, EventHandler[]>;
}

let mockSocket: MockSocket | null = null;

function createMockSocket(): MockSocket {
  const handlers = new Map<string, EventHandler[]>();

  const socket: MockSocket = {
    connected: false,
    _handlers: handlers,
    on: vi.fn((event: string, handler: EventHandler) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
      return socket;
    }),
    off: vi.fn((event: string, handler: EventHandler) => {
      const list = handlers.get(event) ?? [];
      handlers.set(event, list.filter((h) => h !== handler));
      return socket;
    }),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  return socket;
}

// ---------------------------------------------------------------------------
// Module-level mock factory
// ---------------------------------------------------------------------------

/** Returns the current mock socket instance (or creates one). */
export function getMockSocket(): MockSocket {
  if (!mockSocket) {
    mockSocket = createMockSocket();
  }
  return mockSocket;
}

/** Simulate the socket emitting an event to registered listeners. */
export function mockSocketEmit(event: string, ...args: unknown[]): void {
  const socket = getMockSocket();
  const handlers = socket._handlers.get(event) ?? [];
  for (const handler of handlers) {
    handler(...args);
  }
}

/** Spy on emit calls — returns the mock emit fn for assertion. */
export function mockSocketOn(): ReturnType<typeof vi.fn> {
  return getMockSocket().on;
}

/** Reset the mock socket between tests. */
export function resetSocketMock(): void {
  mockSocket = createMockSocket();
}

// ---------------------------------------------------------------------------
// Vitest module mock helpers
// ---------------------------------------------------------------------------

/**
 * Call this at the top of test files that import socket-client.ts:
 *
 *   vi.mock("@/lib/socket-client", () => socketClientMock());
 *
 * initStateSyncSocket is lazy — it calls getMockSocket() at invocation time
 * so that resetSocketMock() between tests replaces the socket correctly.
 */
export function socketClientMock() {
  return {
    initStateSyncSocket: vi.fn(() => getMockSocket()),
    getStateSyncSocket: vi.fn(() => getMockSocket()),
    disconnectAll: vi.fn(),
  };
}

/**
 * Minimal csrf mock — getCsrfToken resolves immediately with a fake token.
 */
export function csrfMock() {
  return {
    getCsrfToken: vi.fn().mockResolvedValue("test-csrf-token"),
    clearCsrfToken: vi.fn(),
    getRuntimeId: vi.fn().mockReturnValue("test-runtime-id"),
  };
}
