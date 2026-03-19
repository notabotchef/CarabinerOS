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
