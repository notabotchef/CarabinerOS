## Tool: reporting_tool

Retrieves P&L data, food cost trends, and budget variance reports.

### Methods

**summary** — Period P&L summary
```json
{
  "method": "summary",
  "period": "week",
  "location_id": "optional-uuid"
}
```
Returns: Total revenue, COGS, food cost %, labor cost, labor %, purchases for the period.

**food_cost** — Food cost trend data
```json
{
  "method": "food_cost",
  "period": "month",
  "location_id": "optional-uuid"
}
```
Returns: Overall food cost % plus daily trend data points.

**variance** — Budget vs actual comparison
```json
{
  "method": "variance",
  "period": "month",
  "location_id": "optional-uuid"
}
```
Returns: Per-location comparison of actual vs target food cost %, labor %, and revenue.

### Parameters
- `period`: "week" (7 days) or "month" (30 days). Default: "week"
- `location_id`: Optional UUID to filter to a single location. Omit for all locations.

### Notes
- COGS = Beginning Inventory + Purchases - Ending Inventory
- Food cost % = COGS / Revenue x 100
- Budget targets come from budget_periods table
- Use "What's my food cost this week?" -> method: food_cost, period: week
- Use "Show me the P&L" -> method: summary
- Use "How are we tracking against budget?" -> method: variance
