export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface AgentLog {
  type: "progress" | "agent" | "tool" | "response" | "error" | "warning";
  heading?: string;
  content?: string;
  kvps?: {
    step?: string;
    tool_name?: string;
    _tool_name?: string;
    [key: string]: string | undefined;
  };
}

export interface StatusPayload {
  state: "thinking" | "waiting" | "error";
  text: string;
  role: string;
}

/**
 * Strip internal Agent Zero language from display text.
 */
export function cleanOperationalCopy(value: string): string {
  return String(value ?? "")
    .replace(/^Using\s+/i, "")
    .replace(/^Writing\s+/i, "")
    .replace(/code_execution_tool/gi, "operational workflow")
    .replace(/browser_agent/gi, "vendor workflow")
    .replace(/document_query/gi, "document review")
    .replace(/restaurant_ops/gi, "restaurant ops")
    .trim();
}

/**
 * Extended cleanup: also removes internal agent references.
 */
export function cleanVisibleActivityText(value: string): string {
  let cleaned = cleanOperationalCopy(value);
  cleaned = cleaned
    .replace(/\bA[0-9]\b/g, "")
    .replace(/\bagent\b/gi, "")
    .replace(/\bsubagent\b/gi, "")
    .replace(/\bsubordinate\b/gi, "")
    .replace(/\bsuperior\b/gi, "")
    .replace(/\bthinking\b/gi, "")
    .replace(/\bGEN\b/g, "")
    .replace(/\bRES\b/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned;
}

/**
 * Derive restaurant role from agent log content by keyword matching.
 */
export function mapInternalAgentToRestaurantRole(log: AgentLog): string {
  const source = `${log?.heading || ""} ${log?.content || ""} ${log?.kvps?.step || ""} ${log?.kvps?.tool_name || ""}`.toLowerCase();

  if (/(recipe|prep|menu|food.?cost|kitchen|chef)/.test(source)) return "Head Chef";
  if (/(invoice|accounting|ap\s|accounts.?payable|reconciliation|bill.?pay)/.test(source)) return "Senior Accountant";
  if (/(marketing|campaign|launch|research|social|promo)/.test(source)) return "Marketing Specialist";
  if (/(inventory|ordering|vendor|provider|purchase|procurement)/.test(source)) return "Assistant GM";
  return "GM";
}

/**
 * Convert agent log or status_update event to a UI-friendly status payload.
 */
export function deriveConversationStatus(data: {
  status?: string;
  detail?: string;
  log?: AgentLog;
}): StatusPayload | null {
  // Handle status_update events from Socket.IO
  if (data.status) {
    if (data.status === "waiting") {
      return { state: "waiting", text: "Waiting for input", role: "GM" };
    }
    if (data.status === "error") {
      return { state: "error", text: data.detail || "Something went wrong", role: "GM" };
    }
    if (data.status === "thinking") {
      const text = data.detail ? cleanVisibleActivityText(data.detail) : "Thinking";
      return { state: "thinking", text, role: "GM" };
    }
  }

  // Handle raw agent logs
  const log = data.log;
  if (!log || typeof log !== "object") return null;

  const role = mapInternalAgentToRestaurantRole(log);

  if (log.type === "progress" && String(log.content ?? "").trim()) {
    const cleaned = cleanVisibleActivityText(log.content!);
    if (cleaned.toLowerCase().includes("waiting for input")) {
      return { state: "waiting", text: "Waiting for input", role };
    }
    return { state: "thinking", text: cleaned || "Thinking", role };
  }

  if (log.type === "agent") {
    const step = cleanVisibleActivityText(log.kvps?.step || log.heading || "");
    if (!step) return null;
    return { state: "thinking", text: step, role };
  }

  if (log.type === "tool") {
    const label = cleanVisibleActivityText(log.heading || log.kvps?._tool_name || "");
    if (!label) return null;
    return { state: "thinking", text: label, role };
  }

  if (log.type === "response") {
    return { state: "waiting", text: "Waiting for input", role };
  }

  if (log.type === "error" || log.type === "warning") {
    return {
      state: "error",
      text: cleanVisibleActivityText(log.heading || log.content || "") || "Needs attention",
      role,
    };
  }

  return null;
}

export const SUGGESTED_PROMPTS = [
  "Build today's produce order for River North using par levels and yesterday's sales mix.",
  "Review inventory shortages across all locations and generate an urgent prep list for dinner service.",
  "Calculate food cost pressure for the spring menu and suggest price updates that protect margin.",
  "Research three marketing campaign ideas for a new happy hour launch in West Loop.",
  "Summarize vendor issues from this week and draft follow-up actions by provider.",
  "Design a menu engineering brief showing stars, puzzles, plowhorses, and dogs.",
];

export function getModulePrompts(pathname: string): string[] {
  if (pathname.startsWith("/orders")) return [
    "Draft a produce order for this week based on par levels.",
    "Which orders are still pending approval?",
    "Compare this week's order totals to last week.",
  ];
  if (pathname.startsWith("/inventory")) return [
    "What items are below par right now?",
    "Show me the biggest price changes this month.",
    "Generate a count sheet for the walk-in cooler.",
  ];
  if (pathname.startsWith("/invoices")) return [
    "Reconcile today's invoices against purchase orders.",
    "Flag any invoices with price variances over 10%.",
    "What's our AP aging look like this week?",
  ];
  if (pathname.startsWith("/prep")) return [
    "Build tomorrow's prep list based on reservations.",
    "What items need to be prepped before dinner service?",
    "How does today's prep compare to last Saturday?",
  ];
  if (pathname.startsWith("/food-cost")) return [
    "What's driving food cost up this week?",
    "Show me the top 5 most expensive menu items by cost ratio.",
    "Compare theoretical vs actual food cost for this period.",
  ];
  if (pathname.startsWith("/menu")) return [
    "Which menu items have the best margin?",
    "Identify underperforming items — puzzles and dogs.",
    "Suggest price adjustments to hit 30% food cost target.",
  ];
  if (pathname.startsWith("/marketing")) return [
    "Draft a campaign idea for the upcoming holiday weekend.",
    "What promotions drove the most covers last month?",
    "Research three happy hour concepts for West Loop.",
  ];
  // Default — home page prompts
  return SUGGESTED_PROMPTS;
}
