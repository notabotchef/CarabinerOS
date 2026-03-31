import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatComposer } from "@/components/chat-composer";

// Stub motion/react to avoid animation side effects in jsdom
vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    button: ({ children, disabled, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button disabled={disabled} onClick={onClick} {...props}>{children}</button>
    ),
    span: ({ children, onClick, ...props }: React.HTMLAttributes<HTMLSpanElement> & { onClick?: () => void }) => (
      <span onClick={onClick} {...props}>{children}</span>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChatComposer", () => {
  const onSend = vi.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the text input field", () => {
    render(<ChatComposer onSend={onSend} />);
    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
  });

  it("renders with default placeholder when no suggestions shown", () => {
    render(<ChatComposer onSend={onSend} showSuggestions={false} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("placeholder", expect.stringContaining("CarabinerOS"));
  });

  it("updates input value as user types", async () => {
    render(<ChatComposer onSend={onSend} />);
    const input = screen.getByRole("textbox");
    await user.type(input, "Hello chef");
    expect(input).toHaveValue("Hello chef");
  });

  it("calls onSend with trimmed text when Enter is pressed", async () => {
    render(<ChatComposer onSend={onSend} />);
    const input = screen.getByRole("textbox");
    await user.type(input, "How is inventory?");
    await user.keyboard("{Enter}");
    expect(onSend).toHaveBeenCalledWith("How is inventory?");
  });

  it("clears input after sending via Enter", async () => {
    render(<ChatComposer onSend={onSend} />);
    const input = screen.getByRole("textbox");
    await user.type(input, "Run prep list");
    await user.keyboard("{Enter}");
    expect(input).toHaveValue("");
  });

  it("does not send when only whitespace is entered", async () => {
    render(<ChatComposer onSend={onSend} />);
    const input = screen.getByRole("textbox");
    await user.type(input, "   ");
    await user.keyboard("{Enter}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not submit when Shift+Enter is pressed", async () => {
    render(<ChatComposer onSend={onSend} />);
    const input = screen.getByRole("textbox");
    await user.type(input, "Multi-line draft");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("shows queued message indicator when queueCount > 0", () => {
    render(<ChatComposer onSend={onSend} queueCount={2} />);
    expect(screen.getByText(/2 messages queued/)).toBeInTheDocument();
  });

  it("does not show queue indicator when queueCount is 0", () => {
    render(<ChatComposer onSend={onSend} queueCount={0} />);
    expect(screen.queryByText(/queued/)).not.toBeInTheDocument();
  });

  it("shows singular 'message' when queueCount is 1", () => {
    render(<ChatComposer onSend={onSend} queueCount={1} />);
    expect(screen.getByText(/1 message queued/)).toBeInTheDocument();
  });

  it("render attach button", () => {
    render(<ChatComposer onSend={onSend} />);
    expect(screen.getByTitle("Attach file")).toBeInTheDocument();
  });

  it("uses custom placeholder when provided", () => {
    render(
      <ChatComposer onSend={onSend} placeholder="Ask something..." showSuggestions={false} />,
    );
    expect(screen.getByPlaceholderText("Ask something...")).toBeInTheDocument();
  });

  it("shows loading placeholder when loading is true", () => {
    render(<ChatComposer onSend={onSend} loading={true} />);
    const input = screen.getByRole("textbox");
    // loading=true sets placeholder to "Type your next message…"
    expect(input.getAttribute("placeholder")).toMatch(/next message/i);
  });
});
