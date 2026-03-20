## Tool: prep_tool

Manages prep plans, station readiness, and shortage tracking.

### Methods

**list** — List prep tasks grouped by service lane
```json
{
  "method": "list",
  "location_id": "optional-uuid"
}
```
Returns: Tasks organized by service lane (Brunch, Dinner, Happy hour) with task, station, readiness, shortage.

**check_readiness** — Summary of readiness status
```json
{
  "method": "check_readiness",
  "location_id": "optional-uuid"
}
```
Returns: Count of Ready, At risk, and Blocked tasks with details for any issues.

### Notes
- Readiness values: "Ready", "At risk", "Blocked"
- Shortage describes what's missing (e.g., "Cream cheese low", "Limes below par")
- "No shortage" means the task is unblocked

## Write Operations (via MCP)
To create, update, or remove prep tasks, use the carabiner-db MCP tools:
- `carabiner-db.prep_task_create` — Add a new prep task to a station or service lane
- `carabiner-db.prep_task_update` — Update readiness, shortage, station, or other task fields
- `carabiner-db.prep_task_delete` — Remove a prep task

Use these MCP tools whenever the user asks to add, edit, or delete prep tasks. The `prep_tool` above is read-only.
