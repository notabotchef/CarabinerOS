## Tool: marketing_tool

Manages marketing campaigns and promotional pipeline.

### Methods

**list** — List all campaigns
```json
{
  "method": "list",
  "location_id": "optional-uuid"
}
```
Returns: Array of campaigns with campaign_name, channel, stage, deliverable, summary.

**stage_summary** — Campaigns grouped by stage
```json
{
  "method": "stage_summary",
  "location_id": "optional-uuid"
}
```
Returns: Campaigns organized by lifecycle stage (Drafting, Research, Ready for review).

### Notes
- Stage values: "Drafting", "Research", "Ready for review"
- Channel describes the marketing channel (e.g., "Email + local social", "SMS + paid social")
- Deliverable is the expected output (e.g., "Audience brief", "Competitor scan")
