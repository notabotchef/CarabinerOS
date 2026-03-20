## Tool: menu_tool

Menu engineering analysis — categorizes items by performance and margin.

### Methods

**list** — List all menu items
```json
{
  "method": "list",
  "location_id": "optional-uuid"
}
```
Returns: Array of items with item_name, category, performance, margin %, recommendation.

**engineering_report** — Categorized performance report
```json
{
  "method": "engineering_report",
  "location_id": "optional-uuid"
}
```
Returns: Items grouped by performance category:
- **Star**: High margin + high volume — feature prominently
- **Puzzle**: High margin + low volume — reposition or rename
- **Plowhorse**: Low margin + high volume — lift price carefully
- **Dog**: Low margin + low volume — consider removing

### Notes
- Margin is shown as percentage (e.g., "72%")
- Omit location_id to see all locations

## Write Operations (via MCP)
To add, update, or remove menu items, use the carabiner-db MCP tools:
- `carabiner-db.menu_item_create` — Add a new menu item with pricing, category, and margin data
- `carabiner-db.menu_item_update` — Update price, category, performance classification, or other fields
- `carabiner-db.menu_item_delete` — Remove a menu item

Use these MCP tools whenever the user asks to add, edit, or remove menu items. The `menu_tool` above is read-only (analysis and reporting only).
