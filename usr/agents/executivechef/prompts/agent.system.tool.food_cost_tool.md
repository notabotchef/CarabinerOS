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
