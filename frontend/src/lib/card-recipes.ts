/**
 * Card Recipe Map — deterministic lookup for module x action -> card presentation.
 *
 * This is the core of Action Cards v2. Instead of relying on A0 to describe
 * what buttons/chips/titles to show, the frontend knows exactly what to render
 * for each module+action combination.
 *
 * Button action prefixes:
 *   "/"       -> navigate (router.push)
 *   "chat:"   -> send text to A0 via the card's chat thread
 *   "api:"    -> call API directly (future, not implemented)
 */

export interface CardRecipeButton {
  label: string;
  type: "primary" | "secondary" | "danger";
  action: string;
}

export interface CardRecipe {
  /** Title template — interpolated from fetched data at render time */
  titleTemplate: string;
  /** API endpoint to fetch detail data. {itemId} is replaced at runtime. */
  fetchUrl: string;
  /** Component key for the detail renderer */
  detailRenderer: "order" | "inventory" | "invoice" | "prep" | "briefing" | "generic";
  /** Smart action buttons */
  buttons: CardRecipeButton[];
  /** Quick-action chip labels */
  chips: string[];
}

type RecipeKey = `${string}:${string}`;

const RECIPE_MAP: Record<RecipeKey, CardRecipe> = {
  // --- Orders ---
  "orders:create": {
    titleTemplate: "Draft Order -- {vendor}",
    fetchUrl: "/api/orders/{itemId}",
    detailRenderer: "order",
    buttons: [
      { label: "Send to Vendor", type: "primary", action: "chat:Send this order to the vendor" },
      { label: "Edit Items", type: "secondary", action: "chat:I need to edit the items on this order" },
      { label: "Cancel", type: "danger", action: "chat:Cancel this order" },
    ],
    chips: ["Check prices", "Add items", "Show par levels"],
  },
  "orders:update": {
    titleTemplate: "Order Updated -- {vendor}",
    fetchUrl: "/api/orders/{itemId}",
    detailRenderer: "order",
    buttons: [
      { label: "Send to Vendor", type: "primary", action: "chat:Send this order to the vendor" },
      { label: "Edit Items", type: "secondary", action: "chat:I need to edit the items on this order" },
    ],
    chips: ["Check prices", "Compare to last order", "Show details"],
  },
  "orders:delete": {
    titleTemplate: "Order Cancelled",
    fetchUrl: "/api/orders/{itemId}",
    detailRenderer: "order",
    buttons: [],
    chips: ["Undo", "Show details"],
  },

  // --- Inventory ---
  "inventory:update": {
    titleTemplate: "Inventory Updated -- {item_name}",
    fetchUrl: "/api/inventory/{itemId}",
    detailRenderer: "inventory",
    buttons: [
      { label: "Confirm", type: "primary", action: "chat:Confirm this inventory update" },
      { label: "Add to Order", type: "secondary", action: "chat:Add this item to an order" },
      { label: "Discard", type: "danger", action: "chat:Discard this inventory change" },
    ],
    chips: ["Check par levels", "View history", "Show waste log"],
  },
  "inventory:create": {
    titleTemplate: "New Item -- {item_name}",
    fetchUrl: "/api/inventory/{itemId}",
    detailRenderer: "inventory",
    buttons: [
      { label: "Confirm", type: "primary", action: "chat:Confirm this new inventory item" },
      { label: "View Par Levels", type: "secondary", action: "chat:Show me par levels for this item" },
    ],
    chips: ["Set par level", "Add to order", "Show category"],
  },

  // --- Invoices ---
  "invoices:create": {
    titleTemplate: "Invoice -- {vendor_name}",
    fetchUrl: "/api/invoices/{itemId}",
    detailRenderer: "invoice",
    buttons: [
      { label: "Approve", type: "primary", action: "chat:Approve this invoice" },
      { label: "Flag Issue", type: "danger", action: "chat:Flag an issue with this invoice" },
      { label: "View PO", type: "secondary", action: "chat:Show me the matching purchase order" },
    ],
    chips: ["Compare to PO", "Check prices", "View vendor history"],
  },
  "invoices:update": {
    titleTemplate: "Invoice Updated -- {vendor_name}",
    fetchUrl: "/api/invoices/{itemId}",
    detailRenderer: "invoice",
    buttons: [
      { label: "Approve", type: "primary", action: "chat:Approve this invoice" },
      { label: "Flag Issue", type: "danger", action: "chat:Flag an issue with this invoice" },
    ],
    chips: ["Compare to PO", "Check line items", "View history"],
  },

  // --- Prep ---
  "prep:update": {
    titleTemplate: "Prep Updated",
    fetchUrl: "/api/prep/{itemId}",
    detailRenderer: "prep",
    buttons: [
      { label: "Mark Complete", type: "primary", action: "chat:Mark this prep task as complete" },
      { label: "Reassign", type: "secondary", action: "chat:Reassign this prep task" },
    ],
    chips: ["Show recipe", "Check inventory", "View schedule"],
  },

  // --- Briefing ---
  "briefing:review": {
    titleTemplate: "Daily Briefing",
    fetchUrl: "",
    detailRenderer: "briefing",
    buttons: [],
    chips: ["Show details", "Any concerns?", "Prep status"],
  },
};

/**
 * Look up a card recipe by module and action.
 * Returns undefined if no recipe exists for the combo (fallback to generic view).
 */
export function getCardRecipe(module: string, action: string): CardRecipe | undefined {
  const key: RecipeKey = `${module}:${action}`;
  return RECIPE_MAP[key];
}

/**
 * Interpolate a title template with data from the fetched detail object.
 * Replaces {key} placeholders with values from the data object.
 */
export function interpolateTitle(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = data[key];
    return val != null ? String(val) : "";
  });
}
