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
