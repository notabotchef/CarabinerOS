# Tool Query Optimization — Token Efficiency at Scale

**Priority:** HIGH for production
**Status:** Future work
**Date:** 2026-03-19

## Problem

All restaurant tools (inventory_tool, order_tool, prep_tool, etc.) currently call `repo.list_inventory()` which does `SELECT * FROM workspace_inventory` — fetches ALL rows, returns them to the LLM context as JSON.

With 3 items this is fine. With a real restaurant (500+ SKUs, thousands of orders, hundreds of recipes), this dumps the entire table into the LLM context, burning tokens and slowing responses.

## Example

User asks: "How many avocados do we have?"

**Current behavior:**
1. Tool fetches ALL 500 inventory items
2. Full JSON array goes into agent context (~50K tokens)
3. LLM reads through everything to find avocados
4. Responds with avocado count

**Desired behavior:**
1. Tool accepts `search` parameter from LLM
2. SQL: `WHERE item_name ILIKE '%avocado%'`
3. Returns only 1-2 matching rows (~200 tokens)
4. LLM responds immediately

## Solution

### 1. Add filter parameters to tool prompts
```json
{
  "method": "search",
  "query": "avocados",
  "location_id": "optional-uuid"
}
```

### 2. Push filtering to SQL
```python
if method == "search":
    items = await repo.search_inventory(query=self.args.get("query"), location_id=location_id)
```

### 3. Add search repositories
```python
async def search_inventory(query: str, location_id=None):
    stmt = select(WorkspaceInventory).where(
        WorkspaceInventory.item_name.ilike(f"%{query}%")
    )
    ...
```

### 4. Update ALL tools
- inventory_tool: search by item name, category
- order_tool: search by vendor, status, date range
- recipe_tool: search by name, ingredient
- food_cost_tool: filter by category, pressure level
- prep_tool: filter by station, readiness
- menu_tool: filter by category, performance tier
- invoice_tool: filter by vendor, date range
- marketing_tool: filter by campaign status
- reporting_tool: filter by date range, metric

### 5. Pagination
For list operations, add `limit` and `offset` parameters. Default to 10-20 items max per response.

## Impact
- 10-100x token reduction per tool call at scale
- Faster response times (less context for LLM to process)
- Lower cost per query in production
- Better user experience (faster answers)
