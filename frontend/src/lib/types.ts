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
  no: number;
  id: string;
  type: string;
  priority: number;
  title: string;
  message: string;
  detail: string;
  timestamp: string;
  display_time: number;
  read: boolean;
  group: string;
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

// Orders module types

export type OrderStatus =
  | "Drafting"
  | "Ready to send"
  | "Awaiting approval"
  | "Submitted"
  | "Confirmed"
  | "Delivered";

export interface OrderLineItem {
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

export interface OrderDetail {
  id: string;
  location_id: string;
  vendor: string;
  channel: string;
  status: OrderStatus;
  total: string;
  eta: string | null;
  line_items: OrderLineItem[] | null;
  summary: string | null;
  detail_points: string[] | null;
  prompt: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorSummary {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  payment_terms: string | null;
}

// Marketing / Campaigns

export type CampaignStage = "Research" | "Drafting" | "Review" | "Live" | "Completed";

export type CampaignChannel = "Instagram" | "Facebook" | "Email" | "TikTok" | "Event" | string;

export interface Campaign {
  id: string;
  location_id: string;
  campaign_name: string;
  channel: string;
  stage: CampaignStage;
  deliverable: string;
  scheduled_at: string | null;
  end_date: string | null;
  budget_cents: number | null;
  media_urls: string[] | null;
  tags: string[] | null;
  summary: string | null;
  detail_points: string[] | null;
  prompt: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorSummary {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  payment_terms: string | null;
}

// Inventory module types

export interface InventoryCount {
  id: string;
  location_id: string;
  count_date: string;
  count_type: "full" | "spot" | "walk_in";
  status: "in_progress" | "completed";
  counted_by: string | null;
  notes: string | null;
  line_count: number;
  total_value: number | null;
}

export interface CountLine {
  id: string;
  count_id: string;
  item_id: string;
  item_name: string | null;
  quantity: number;
  unit_cost: number;
  storage_area: string | null;
}

export interface ParLevel {
  id: string;
  location_id: string;
  item_id: string;
  item_name: string | null;
  min_quantity: number;
  on_hand: string | null;
  shortfall: number | null;
  day_of_week: number | null;
}

export interface WasteLogEntry {
  id: string;
  location_id: string;
  item_id: string;
  item_name: string | null;
  quantity: number;
  unit: string;
  reason: "spoilage" | "overproduction" | "expired";
  notes: string | null;
  waste_date: string;
  estimated_cost: number | null;
}

// Recipe types (Modernist Cuisine format)

export type UnitSystem = "metric" | "us";

export interface RecipeStep {
  id: string;
  component_id: string;
  step_number: number;
  instruction: string;
  temperature?: string;
  duration?: string;
  technique?: string;
}

export interface RecipeIngredient {
  id: string;
  component_id: string;
  item_id?: string;
  name: string;
  weight_g: number;
  percentage?: number;
  unit_display: string;
  sort_order: number;
  notes?: string;
}

export interface RecipeComponent {
  id: string;
  recipe_id: string;
  name: string;
  sort_order: number;
  yield_quantity?: number;
  yield_unit?: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
}

export interface RecipeDetail {
  id: string;
  location_id: string;
  name: string;
  category: string;
  description?: string;
  status: string;
  yield_quantity?: number;
  yield_unit?: string;
  total_weight_g?: number;
  total_cost?: number;
  cost_per_serving?: number;
  image_url?: string;
  source?: string;
  equipment?: string[];
  notes?: string;
  tags?: string[];
  components: RecipeComponent[];
  created_at?: string;
  updated_at?: string;
}

export interface RecipeIngredientDraft {
  id: string;
  name: string;
  weight_g: number;
  unit_display: string;
  sort_order: number;
  notes?: string;
  percentage?: number;
}

export interface RecipeStepDraft {
  id: string;
  step_number: number;
  instruction: string;
  temperature?: string;
  duration?: string;
  technique?: string;
}

export interface RecipeComponentDraft {
  id: string;
  name: string;
  sort_order: number;
  yield_quantity?: number;
  yield_unit?: string;
  ingredients: RecipeIngredientDraft[];
  steps: RecipeStepDraft[];
}

// Invoices — Phase 1

export type InvoiceStatus =
  | "Uploaded"
  | "Processing"
  | "Extracted"
  | "Matched"
  | "Approved"
  | "Paid"
  | "Rejected";

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  gl_code?: string;
  flagged?: boolean;
  price_variance_pct?: number;
}

export interface InvoiceEvent {
  id: string;
  invoice_id: string;
  event_type: string;
  actor: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  location_id: string;
  vendor_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  status: InvoiceStatus;
  file_path: string | null;
  file_mime: string | null;
  source: string | null;
  subtotal: string | null;
  tax: string | null;
  total: string | null;
  line_items: InvoiceLineItem[] | null;
  gl_codes: Record<string, unknown> | null;
  extracted_data: Record<string, unknown> | null;
  summary: string | null;
  detail_points: string[] | null;
  purchase_order_id: string | null;
  match_status: string | null;
  approved_by: string | null;
  approved_at: string | null;
  ocr_confidence: number | null;
  created_at: string;
  updated_at: string;
  events?: InvoiceEvent[];
}
