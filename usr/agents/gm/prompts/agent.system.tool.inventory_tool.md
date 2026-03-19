## Tool: inventory_tool

Checks inventory levels and flags variances for the active location.

### Methods

**list** — List all inventory items
```json
{
  "method": "list",
  "location_id": "optional-uuid"
}
```
Returns: Array of items with item name, on_hand quantity, par level, variance, summary.

**check_variances** — Show only items below par
```json
{
  "method": "check_variances",
  "location_id": "optional-uuid"
}
```
Returns: Count of items below par with details for each.

### Notes
- Variance is a string like "-6" (below par) or "+3" (above par)
- Items below par need replenishment
- Use check_variances to quickly identify shortages
