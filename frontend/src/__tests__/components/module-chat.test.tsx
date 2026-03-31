import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ChatMessage, A0Snapshot } from "@/lib/types";

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    button: ({ children, disabled, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button disabled={disabled} onClick={onClick} {...props}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <span>{children}</span>,
}));

vi.mock("remark-gfm", () => ({ default: () => {} }));

// Controlled mock for useChat — we control messages and loading state
const mockSendMessage = vi.fn().mockResolvedValue("ctx-123");
const mockCreateNewChat = vi.fn().mockResolvedValue("ctx-new");
const mockResetChat = vi.fn();

let mockMessages: ChatMessage[] = [];
let mockLoading = false;

vi.mock("@/hooks/use-chat", () => ({
  useChat: () => ({
    messages: mockMessages,
    loading: mockLoading,
    sendMessage: mockSendMessage,
    createNewChat: mockCreateNewChat,
    resetChat: mockResetChat,
    contextId: "ctx-123",
    queuedMessages: [],
  }),
}));

// Controlled mock for useSocketContext
let mockSnapshot: A0Snapshot | null = null;
const mockSubscribe = vi.fn();

vi.mock("@/components/socket-provider", () => ({
  useSocketContext: () => ({
    connected: true,
    snapshot: mockSnapshot,
    chefStatus: null,
    notifications: [],
    subscribe: mockSubscribe,
  }),
}));

// Import after mocks
const { ModuleChat } = await import("@/components/module-chat");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "msg-1",
    role: "user",
    content: "Hello from user",
    timestamp: Date.now() / 1000,
    ...overrides,
  };
}

const noop = () => {};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ModuleChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMessages = [];
    mockLoading = false;
    mockSnapshot = null;
  });

  it("renders the input field", () => {
    render(
      <ModuleChat moduleId="orders" buildContext={() => ""} />,
    );
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders with custom placeholder", () => {
    render(
      <ModuleChat
        moduleId="orders"
        buildContext={() => ""}
        placeholder="Ask about orders..."
      />,
    );
    expect(screen.getByPlaceholderText("Ask about orders...")).toBeInTheDocument();
  });

  it("renders chip buttons when chips are provided", () => {
    render(
      <ModuleChat
        moduleId="orders"
        buildContext={() => ""}
        chips={["Pending orders", "Daily totals"]}
      />,
    );
    expect(screen.getByText("Pending orders")).toBeInTheDocument();
    expect(screen.getByText("Daily totals")).toBeInTheDocument();
  });

  it("does not render message list when messages are empty", () => {
    mockMessages = [];
    render(<ModuleChat moduleId="orders" buildContext={() => ""} />);
    // No scrollable message area should appear
    expect(screen.queryByRole("button", { name: /new conversation/i })).not.toBeInTheDocument();
  });

  it("renders message list when messages are present (after first user message)", () => {
    mockMessages = [
      makeMessage({ id: "u1", role: "user", content: "What orders are pending?" }),
      makeMessage({ id: "a1", role: "assistant", content: "There are 3 pending orders." }),
    ];
    render(<ModuleChat moduleId="orders" buildContext={() => ""} />);
    expect(screen.getByText("What orders are pending?")).toBeInTheDocument();
    expect(screen.getByText("There are 3 pending orders.")).toBeInTheDocument();
  });

  it("shows new conversation button when there are messages", () => {
    mockMessages = [
      makeMessage({ id: "u1", role: "user", content: "Any 86s?" }),
    ];
    render(<ModuleChat moduleId="orders" buildContext={() => ""} />);
    expect(screen.getByTitle("New conversation")).toBeInTheDocument();
  });

  it("displays progress indicator when loading is true", () => {
    mockMessages = [
      makeMessage({ id: "u1", role: "user", content: "Run prep list" }),
    ];
    mockLoading = true;
    mockSnapshot = {
      deselect_chat: false,
      context: "ctx-123",
      contexts: [],
      tasks: [],
      logs: [],
      log_guid: "guid",
      log_version: 1,
      log_progress: "Fetching prep data",
      log_progress_active: true,
      paused: false,
      notifications: [],
      notifications_guid: "nguid",
      notifications_version: 1,
    };
    render(<ModuleChat moduleId="orders" buildContext={() => ""} />);
    // Loading spinner should be visible
    // The component renders a Loader2 icon + expo status text
    // With our mocked snapshot, expoStatus will be "Fetching prep data"
    // but we need to look for something generic
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
  });

  it("formats progress text: String() wrap handles numeric log_progress", () => {
    // This is the fix we made — log_progress can be a number, not just a string
    // String(42) = "42" — should not throw
    mockMessages = [
      makeMessage({ id: "u1", role: "user", content: "P&L report" }),
    ];
    mockLoading = true;
    mockSnapshot = {
      deselect_chat: false,
      context: "ctx-123",
      contexts: [],
      tasks: [],
      logs: [],
      log_guid: "guid",
      log_version: 1,
      log_progress: 42, // numeric — the bug case
      log_progress_active: true,
      paused: false,
      notifications: [],
      notifications_guid: "nguid",
      notifications_version: 1,
    };

    // Should not throw when log_progress is a number
    expect(() =>
      render(<ModuleChat moduleId="reporting" buildContext={() => ""} />),
    ).not.toThrow();
  });

  it("strips [bracket context] prefix from displayed messages", () => {
    mockMessages = [
      makeMessage({
        id: "u1",
        role: "user",
        content: "[ORDERS_CONTEXT] What is low on inventory?",
      }),
    ];
    render(<ModuleChat moduleId="orders" buildContext={() => ""} />);
    // The stripped text should appear (without the bracket prefix)
    expect(screen.getByText("What is low on inventory?")).toBeInTheDocument();
  });

  it("filters welcome bleed: drops messages before first user message", () => {
    // Scenario: assistant message comes before first user message — should be hidden
    mockMessages = [
      makeMessage({
        id: "a0",
        role: "assistant",
        content: "Welcome to Carabiner! How can I help you today?",
      }),
      makeMessage({ id: "u1", role: "user", content: "Check inventory" }),
      makeMessage({ id: "a1", role: "assistant", content: "Sure, checking now." }),
    ];
    render(<ModuleChat moduleId="orders" buildContext={() => ""} />);
    // First assistant message (before user) should NOT appear
    expect(screen.queryByText(/Welcome to Carabiner/)).not.toBeInTheDocument();
    // The rest should be visible
    expect(screen.getByText("Check inventory")).toBeInTheDocument();
    expect(screen.getByText("Sure, checking now.")).toBeInTheDocument();
  });
});
