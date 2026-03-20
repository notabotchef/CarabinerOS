## Tool: food_cost_tool

Analyzes food cost pressure and margin trends.

### Methods

**list** — List all food cost items
```json
{
  "method": "list",
  "location_id": "optional-uuid"
}
```
Returns: Array of items with menu_item_name, pressure, cost_pct, action, summary.

**analyze** — Full margin analysis
```json
{
  "method": "analyze",
  "location_id": "optional-uuid"
}
```
Returns: Average cost %, total items, count above target, and details for highest pressure items.

### Notes
- Pressure is shown as "+2.8 pts" (points above target)
- Cost % is the current food cost percentage (e.g., "34.1%")
- Action suggests what to do: "Reprice or source swap", "Tighten prep yield", etc.
- Omit location_id to analyze across all locations

## Write Operations (via MCP)
To create, update, or remove food cost records, use the carabiner_db MCP tools:
- `carabiner_db.food_cost_create` — Add a new food cost record for a menu item
- `carabiner_db.food_cost_update` — Update cost percentage, pressure rating, or action recommendation
- `carabiner_db.food_cost_delete` — Remove a food cost record

Use these MCP tools when the user asks to log or adjust food cost data. The `food_cost_tool` above is read-only (analysis only).
