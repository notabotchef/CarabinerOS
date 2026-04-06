import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

let mockPathname = "/demo/test-restaurant";
const socketProviderSpy = vi.fn(({ children }: { children: React.ReactNode }) => <>{children}</>);
const shellSpy = vi.fn(({ children }: { children: React.ReactNode }) => (
  <div>
    <div>Conversations</div>
    <div>Main Kitchen</div>
    <div>Agent Zero Settings (dev)</div>
    <div>Tickets</div>
    <button title="New Chat">New Chat</button>
    <button title="Action Cards">Action Cards</button>
    <div>{children}</div>
  </div>
));
const initStateSyncSocket = vi.fn();
const getStateSyncSocket = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("@/components/socket-provider", () => ({
  SocketProvider: (props: { children: React.ReactNode }) => socketProviderSpy(props),
}));

vi.mock("@/components/shell", () => ({
  Shell: (props: { children: React.ReactNode }) => shellSpy(props),
}));

vi.mock("@/lib/socket-client", () => ({
  initStateSyncSocket: (...args: unknown[]) => initStateSyncSocket(...args),
  getStateSyncSocket: (...args: unknown[]) => getStateSyncSocket(...args),
}));

const { AppRouteShell } = await import("@/components/app-route-shell");
const { default: DemoTestRestaurantPage } = await import("@/app/(demo)/demo/test-restaurant/page");

function renderRoute(pathname: string, child: React.ReactNode) {
  mockPathname = pathname;
  return render(<AppRouteShell>{child}</AppRouteShell>);
}

describe("demo route isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/demo/test-restaurant";
  });

  it("renders the demo route without live shell chrome or socket bootstrap", () => {
    renderRoute("/demo/test-restaurant", <DemoTestRestaurantPage />);

    expect(screen.getByRole("heading", { name: "Targetrestaurant demo placeholder" })).toBeInTheDocument();
    expect(screen.queryByText("Conversations")).not.toBeInTheDocument();
    expect(screen.queryByText("Main Kitchen")).not.toBeInTheDocument();
    expect(screen.queryByText("Agent Zero Settings (dev)")).not.toBeInTheDocument();
    expect(screen.queryByText("Tickets")).not.toBeInTheDocument();
    expect(screen.queryByTitle("New Chat")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Action Cards")).not.toBeInTheDocument();
    expect(socketProviderSpy).not.toHaveBeenCalled();
    expect(shellSpy).not.toHaveBeenCalled();
    expect(initStateSyncSocket).not.toHaveBeenCalled();
    expect(getStateSyncSocket).not.toHaveBeenCalled();
  });

  it("keeps non-demo routes inside the live app shell", () => {
    renderRoute("/", <div>Live workspace child</div>);

    expect(socketProviderSpy).toHaveBeenCalledTimes(1);
    expect(shellSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Conversations")).toBeInTheDocument();
    expect(screen.getByText("Main Kitchen")).toBeInTheDocument();
    expect(screen.getByText("Agent Zero Settings (dev)")).toBeInTheDocument();
    expect(screen.getByText("Tickets")).toBeInTheDocument();
    expect(screen.getByText("Live workspace child")).toBeInTheDocument();
  });
});
