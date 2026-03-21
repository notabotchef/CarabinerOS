## Tool: order_tool

Manages vendor orders for the active location.

### Methods

**list** — List all orders
```json
{
  "method": "list",
  "location_id": "optional-uuid"
}
```
Returns: Array of orders with vendor, channel, status, total, eta, summary.

**get** — Get a specific order
```json
{
  "method": "get",
  "order_id": "uuid-of-order"
}
```
Returns: Full order details including detail_points.

**update** — Update an order's status or details
```json
{
  "method": "update",
  "order_id": "uuid-of-order",
  "status": "Ready to send",
  "total": "$1,500"
}
```
Returns: Confirmation of update.

### Notes
- Always specify location_id when listing to get location-specific results
- Status values: "Drafting", "Ready to send", "Awaiting approval", "Sent"
- Channel indicates how the order is submitted: "API", "Email", "Browser fallback"

## Write Operations (via MCP)
To create new orders or delete existing ones, use the carabiner_db MCP tools:
- `carabiner_db.orders_create` — Create a new purchase order
- `carabiner_db.orders_update` — Update order fields (also available via the `order_tool` **update** method above)
- `carabiner_db.orders_delete` — Delete a draft order

Note: The `order_tool` **update** method can update an existing order's status and fields, but use `carabiner_db.orders_create` for creating brand-new orders. The `order_tool` cannot create orders on its own.
