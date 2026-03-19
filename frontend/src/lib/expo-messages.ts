import type { A0LogEntry } from "@/lib/types";

const QUIRKY_MESSAGES: Record<string, string[]> = {
  food_cost_tool: [
    "Crunching the numbers on that produce order...",
    "Checking if the avocado market crashed yet...",
  ],
  inventory_tool: [
    "Checking the walk-in...",
    "Counting what's left after brunch service...",
  ],
  prep_tool: [
    "Asking the sous chef about tomorrow's prep...",
    "Making sure mise en place is actually en place...",
  ],
  order_tool: [
    "Drafting that PO, hang tight...",
    "Negotiating with the vendor rep...",
  ],
  recipe_tool: [
    "Pulling up the recipe book...",
    "Cross-referencing Chef's secret notes...",
  ],
  reporting_tool: [
    "Pulling last week's covers from the reservation book...",
    "Running the numbers for the morning briefing...",
  ],
  invoice_tool: [
    "Scanning that invoice...",
    "Making sure they didn't overcharge us again...",
  ],
  marketing_tool: [
    "Drafting something Instagram-worthy...",
    "Thinking about what would make foodies stop scrolling...",
  ],
  menu_tool: [
    "Checking the menu matrix...",
    "Looking at what's selling and what's sitting...",
  ],
  default: [
    "Working on it...",
    "One moment...",
    "On it, Chef...",
  ],
};

const COMPLETION_MESSAGES = [
  "Heard.",
  "Service.",
  "All set.",
  "Done, Chef.",
];

export function getExpoMessage(log: A0LogEntry): string | null {
  if (log.type === "tool" && log.heading) {
    const toolName = log.heading.replace("Using ", "").replace("...", "").trim();
    const messages = QUIRKY_MESSAGES[toolName] || QUIRKY_MESSAGES.default;
    return messages[Math.floor(Math.random() * messages.length)];
  }

  if (log.type === "agent" || log.type === "subagent") {
    return `Delegating to ${log.heading || "a specialist"}...`;
  }

  if (log.type === "progress" && log.content) {
    return log.content;
  }

  return null;
}

export function getCompletionMessage(): string {
  return COMPLETION_MESSAGES[Math.floor(Math.random() * COMPLETION_MESSAGES.length)];
}
