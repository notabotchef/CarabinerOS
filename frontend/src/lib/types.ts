// Agent Zero Socket.IO protocol types

export interface A0LogEntry {
  no: number;
  id: string;
  type: "user" | "agent" | "response" | "tool" | "code_exe" | "browser" |
        "progress" | "mcp" | "subagent" | "warning" | "rate_limit" |
        "error" | "info" | "util" | "hint";
  heading: string;
  content: string;
  kvps: Record<string, unknown>;
  timestamp: number;
  agentno: number;
}

export interface A0Context {
  id: string;
  name: string;
  last_message: string;
  log_version: number;
}

export interface A0Snapshot {
  deselect_chat: boolean;
  context: string;
  contexts: A0Context[];
  tasks: unknown[];
  logs: A0LogEntry[];
  log_guid: string;
  log_version: number;
  log_progress: string | number;
  log_progress_active: boolean;
  paused: boolean;
  notifications: A0Notification[];
  notifications_guid: string;
  notifications_version: number;
}

export interface A0Notification {
  id: string;
  type: string;
  message: string;
}

// WebSocketManager wraps all emitted payloads in an envelope
export interface A0StatePush {
  handlerId: string;
  eventId: string;
  correlationId: string;
  ts: string;
  data: {
    runtime_epoch: string;
    seq: number;
    snapshot: A0Snapshot;
  };
}

export interface A0StateRequestResponse {
  ok: boolean;
  data: {
    runtime_epoch: string;
    seq_base: number;
  };
  correlationId: string;
}

export type StepLabel = "GEN" | "USE" | "SUB" | "RES";

export interface InlineStep {
  type: "agent" | "tool" | "subagent" | "response";
  label: StepLabel;
  heading: string;
  isFiller: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  steps?: InlineStep[];
  stepTitle?: string;
  stepDuration?: number;
}

// Action Cards — expo window types

export interface ActionCardChange {
  op: "+" | "!" | "→";
  text: string;
}

export interface ActionCardStat {
  label: string;
  value: string;
}

export type ActionCardType = "urgent" | "action" | "update" | "info";
export type ActionCardStatus = "new" | "read" | "committed" | "dismissed";

export interface ActionCard {
  id: string;
  type: ActionCardType;
  module: string;
  action: "create" | "update" | "delete";
  summary: string;
  detail: string;
  itemId?: string;
  changes: ActionCardChange[];
  stats: ActionCardStat[];
  priority: 0 | 1 | 2;
  deadline?: string;
  status: ActionCardStatus;
  timestamp: number;
  source: "reactive" | "proactive";
  suggestedAction?: string;
  suggestedChips?: string[];
}

export interface CardChatMessage {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

export interface ChefStatus {
  status: "working" | "completed" | "idle";
  tool?: string;
  text: string;
  active: boolean;
}
