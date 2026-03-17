// Shared TypeScript types for CarabinerOS
// These types are consumed by both the Next.js frontend and generated from FastAPI schemas

export type LocationStatus = "Stable" | "Attention" | "Launch week";

export interface Location {
  id: string;
  name: string;
  city: string;
  status: LocationStatus;
  sales_delta: string;
  labor_delta: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export type ConnectorChannel = "api" | "email" | "browser";
export type ConnectorStatus =
  | "drafted"
  | "ready"
  | "executing"
  | "sent"
  | "failed"
  | "fallback_used";

export interface Connector {
  id: string;
  provider_id: string;
  provider_name: string;
  channels: ConnectorChannel[];
  default_channel: ConnectorChannel;
  config: Record<string, unknown>;
}

export type ModuleId =
  | "home"
  | "inbox"
  | "orders"
  | "inventory"
  | "prep"
  | "food-cost"
  | "menu"
  | "marketing"
  | "locations"
  | "admin";

export interface Module {
  id: ModuleId;
  label: string;
  icon: string;
}

export type InboxPriority = "high" | "medium" | "low";

export interface InboxItem {
  id: string;
  location_id: string;
  title: string;
  priority: InboxPriority;
  owner: string | null;
  status: string;
  module: ModuleId;
  summary: string | null;
  detail_points: string[];
  prompt: string | null;
}

export interface Order {
  id: string;
  location_id: string;
  connector_id: string;
  vendor: string;
  channel: ConnectorChannel;
  status: ConnectorStatus;
  total: number;
  eta: string | null;
  line_items: Record<string, unknown>[];
  summary: string | null;
  detail_points: string[];
  prompt: string | null;
}

export interface InventoryItem {
  id: string;
  location_id: string;
  item_name: string;
  on_hand_qty: number;
  par_qty: number;
  variance: number;
  summary: string | null;
  detail_points: string[];
  prompt: string | null;
}

export interface PrepTask {
  id: string;
  location_id: string;
  service_lane: string;
  task: string;
  station: string;
  readiness: string;
  shortage: string | null;
  summary: string | null;
  detail_points: string[];
  prompt: string | null;
}

export interface FoodCostItem {
  id: string;
  location_id: string;
  menu_item_name: string;
  pressure: string;
  current_cost_pct: number;
  action: string;
  summary: string | null;
  detail_points: string[];
  prompt: string | null;
}

export interface MenuItem {
  id: string;
  location_id: string;
  item_name: string;
  category: string;
  performance: string;
  margin_pct: number;
  recommendation: string;
  recipe: Record<string, unknown> | null;
  summary: string | null;
  detail_points: string[];
  prompt: string | null;
}

export interface Campaign {
  id: string;
  location_id: string;
  campaign_name: string;
  channel: string;
  stage: string;
  deliverable: string;
  summary: string | null;
  detail_points: string[];
  prompt: string | null;
}

export interface Metric {
  label: string;
  value: string;
  delta: string;
}

// WebSocket event types
export interface ChatMessage {
  context_id: string;
  message: string;
  attachments?: string[];
}

export interface ResponseStream {
  context_id: string;
  chunk: string;
  full: string;
}

export interface StatusUpdate {
  context_id: string;
  status: string;
}

export interface WorkspaceUpdate {
  module: ModuleId;
  action: "create" | "update" | "delete";
  item: Record<string, unknown>;
}

export interface HQPayload {
  brand: {
    name: string;
    tagline: string;
    theme: string;
  };
  organization: Organization;
  active_location_id: string;
  locations: Location[];
  modules: Module[];
  suggested_prompts: string[];
  metrics: Metric[];
  connectors: Connector[];
  execution_mode: {
    default: string;
    autonomous_enabled: boolean;
    policy: string;
  };
}
