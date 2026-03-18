const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || "http://localhost:8000";

export async function fetchAPI<T>(path: string): Promise<T> {
  const res = await fetch(`${ENGINE_URL}${path}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// --- Types matching API response shapes ---

export interface Location {
  id: string;
  slug: string;
  name: string;
  city: string;
  status: string;
  sales_delta: string | null;
  labor_delta: string | null;
}

export interface InboxItem {
  id: string;
  location_id: string;
  title: string;
  priority: string;
  owner: string | null;
  status: string;
  module: string;
  summary: string | null;
  detail_points: string[] | null;
  prompt: string | null;
}

export interface Order {
  id: string;
  location_id: string;
  vendor: string;
  channel: string;
  status: string;
  total: string;
  eta: string | null;
  summary: string | null;
  detail_points: string[] | null;
  prompt: string | null;
}

export interface Metric {
  label: string;
  value: string;
  delta: string;
}

export interface Connector {
  provider_id: string;
  provider_name: string;
  channels: string[];
  default_channel: string;
  fallback_channel: string | null;
}

export interface InventoryItem {
  id: string;
  location_id: string;
  item_name: string;
  on_hand: string;
  par: string;
  variance: string;
  summary: string | null;
  detail_points: string[] | null;
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
  detail_points: string[] | null;
  prompt: string | null;
}

export interface FoodCostItem {
  id: string;
  location_id: string;
  menu_item_name: string;
  pressure: string;
  current_cost_pct: string;
  action: string;
  summary: string | null;
  detail_points: string[] | null;
  prompt: string | null;
}

export interface MenuItem {
  id: string;
  location_id: string;
  item_name: string;
  category: string;
  performance: string;
  margin_pct: string;
  recommendation: string;
  recipe: Record<string, unknown> | null;
  summary: string | null;
  detail_points: string[] | null;
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
  detail_points: string[] | null;
  prompt: string | null;
}

export interface InvoiceLineItem {
  description: string;
  qty: number;
  unit_price: number;
  total: number;
  gl_code: string;
}

export interface InvoiceGLCode {
  code: string;
  name: string;
  total: number;
}

export interface Invoice {
  id: string;
  location_id: string;
  vendor: string;
  invoice_number: string | null;
  invoice_date: string;
  due_date: string | null;
  status: string;
  total: string;
  line_items: InvoiceLineItem[] | null;
  gl_codes: InvoiceGLCode[] | null;
  po_match_id: string | null;
  variance_notes: string | null;
  file_path: string | null;
  summary: string | null;
  detail_points: string[] | null;
  prompt: string | null;
}

// --- Recipes (Modernist Cuisine) ---

export interface RecipeStep {
  id: string;
  component_id: string;
  step_number: number;
  instruction: string;
  temperature: string | null;
  duration: string | null;
  technique: string | null;
}

export interface RecipeComponentIngredient {
  id: string;
  component_id: string;
  item_id: string | null;
  name: string;
  weight_g: number;
  percentage: number | null;
  unit_display: string;
  sort_order: number;
  notes: string | null;
}

export interface RecipeComponent {
  id: string;
  recipe_id: string;
  name: string;
  sort_order: number;
  yield_quantity: number | null;
  yield_unit: string | null;
  ingredients: RecipeComponentIngredient[];
  steps: RecipeStep[];
}

export interface Recipe {
  id: string;
  location_id: string;
  name: string;
  category: string;
  description: string | null;
  status: string;
  yield_quantity: number | null;
  yield_unit: string | null;
  total_weight_g: number | null;
  total_cost: number | null;
  cost_per_serving: number | null;
  image_url: string | null;
  source: string | null;
  equipment: string[] | null;
  notes: string | null;
  tags: string[] | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface RecipeDetail extends Recipe {
  components: RecipeComponent[];
}

// --- Reporting ---

export interface DailyPLRow {
  id: string;
  location_id: string;
  location_name: string;
  pl_date: string;
  beginning_inventory: number;
  purchases: number;
  ending_inventory: number;
  cogs: number;
  revenue: number;
  food_cost_pct: number | null;
  labor_cost: number;
  labor_pct: number | null;
  notes: string | null;
}

export interface PLSummary {
  period_start: string;
  period_end: string;
  location_id: string | null;
  total_revenue: number;
  total_cogs: number;
  avg_food_cost_pct: number;
  total_labor: number;
  avg_labor_pct: number;
  total_purchases: number;
  days: number;
}

export interface TrendPoint {
  date: string;
  food_cost_pct: number;
  labor_pct: number;
  revenue: number;
  cogs: number;
}

export interface BudgetVariance {
  location_id: string;
  location_name: string;
  period_start: string;
  period_end: string;
  actual_revenue: number;
  actual_food_cost_pct: number;
  actual_labor_pct: number;
  target_revenue: number;
  target_food_cost_pct: number;
  target_labor_pct: number;
  revenue_variance: number;
  revenue_variance_pct: number;
  food_cost_variance_pct: number;
  labor_variance_pct: number;
}

export interface HQPayload {
  brand: { name: string; tagline: string; theme: string };
  organization: { id: string; name: string; slug: string } | null;
  active_location_id: string | null;
  locations: Location[];
  modules: { id: string; label: string; icon: string }[];
  suggested_prompts: string[];
  metrics: Metric[];
  inbox: InboxItem[];
  connectors: Connector[];
  execution_mode: { default: string; autonomous_enabled: boolean; policy: string };
}
