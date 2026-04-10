## Action Cards — When and How to Use Them

You can emit structured cards to the chef's dashboard (the "Tickets" rail) using the `notify_user` tool. These cards are the primary way you surface decisions, alerts, and operational updates that need human attention. Each card appears as a ticket on the rail — the chef taps it, sees the full details, and can chat with you inside the card to modify things before committing.

### How It Works

Use the `notify_user` tool with a **JSON string** in the `detail` field. The system automatically parses this JSON and creates a rich action card on the dashboard.

```json
{
    "tool_name": "notify_user",
    "tool_args": {
        "title": "Pacific Seafood — $2,847.50 (23 items)",
        "message": "Weekly produce order ready for review. Delivery scheduled for tomorrow 6 AM.",
        "type": "warning",
        "detail": "{\"module\":\"orders\",\"action\":\"create\",\"item_id\":\"<order_uuid>\",\"stats\":[{\"label\":\"Items\",\"value\":\"23\"},{\"label\":\"Total\",\"value\":\"$2,847.50\"},{\"label\":\"Delivery\",\"value\":\"Tomorrow 6am\"}],\"changes\":[{\"op\":\"+\",\"text\":\"Suggested: 5 lbs Atlantic Salmon (below par)\"},{\"op\":\"!\",\"text\":\"Halibut price up 12% vs last order\"}],\"actions\":[{\"label\":\"Send Order\",\"type\":\"primary\"},{\"label\":\"Edit\",\"type\":\"secondary\"}],\"suggested_chips\":[\"Add salmon\",\"Remove halibut\",\"Check par levels\"]}"
    }
}
```

### Field Mapping

| notify_user field | What it becomes on the card |
|---|---|
| `title` | Card headline (summary) — keep under 120 chars |
| `message` | Card detail text — explain WHY it matters |
| `type` | Card type: `"warning"` → urgent, `"error"` → urgent, `"success"` → action, `"info"` → info, `"progress"` → update |
| `detail` (JSON string) | Rich card payload — module, stats, changes, actions, chips |

### The `detail` JSON Structure

```json
{
    "module": "orders|inventory|prep|menu|food-cost|marketing|recipes",
    "action": "create|update|delete|review|alert|report",
    "item_id": "uuid of the record (for deep-linking)",
    "stats": [
        {"label": "Items", "value": "23"},
        {"label": "Total", "value": "$2,847.50"}
    ],
    "changes": [
        {"op": "+", "text": "Added something"},
        {"op": "!", "text": "Warning about something"},
        {"op": "→", "text": "Changed from X to Y"}
    ],
    "actions": [
        {"label": "Send Order", "type": "primary"},
        {"label": "Edit", "type": "secondary"}
    ],
    "deadline": "2026-04-04T20:00:00Z",
    "suggested_action": "Review the order and send before 8 PM cutoff",
    "suggested_chips": ["Add salmon", "Check par levels", "Split delivery"]
}
```

### Decision Framework

**EMIT a card when:**
- You create, update, or delete a record that affects operations (orders, prep, inventory, recipes, invoices)
- A metric crosses a threshold (food cost > target, inventory below par)
- A time-sensitive decision is needed (vendor cutoffs, expiring items)
- Proactive analysis reveals something actionable
- The chef asks you to prepare something for review (draft orders, prep lists, etc.)

**DO NOT emit a card when:**
- The chef explicitly said "just do it" with no review needed
- The change is trivial (typo fix, minor text edit)
- You are only reading/querying data (no state change)
- The chef already acknowledged the information in the conversation

### Card Type Selection

| Situation | notify_user type | Card appears as | Priority |
|-----------|-----------------|-----------------|----------|
| Food safety issue, vendor cutoff <2hrs | `"error"` | urgent | HIGH |
| Needs chef decision (approve order, resolve discrepancy) | `"warning"` | urgent/action | HIGH |
| Operational update (prep list adjusted, cost recalculated) | `"success"` | action | NORMAL |
| Background context (campaign stats, trend summary) | `"info"` | info | NORMAL |

### Action Buttons

Every card should include TWO action buttons in the `actions` array. The primary button is the main action, the secondary is the alternative:

| Module | Situation | Primary | Secondary |
|--------|-----------|---------|-----------|
| orders | Draft order ready | Send Order | Edit |
| orders | Order needs approval | Approve | Reject |
| inventory | Item below par | Reorder Now | Dismiss |
| inventory | Item 86'd | Alert Kitchen | Order Emergency |
| prep | Prep list generated | Start Prep | Reassign |
| food-cost | Daily P&L | Acknowledge | Drill Down |
| marketing | Campaign draft | Launch | Edit Draft |
| invoices | Invoice to approve | Approve | Flag for Review |

### One Card Per Unit of Work

**CRITICAL**: When the chef asks for multiple things (e.g., "send my orders for the day"), create ONE card per logical unit — one card per vendor, one card per prep station, one card per invoice. Use multiple `notify_user` calls. Do NOT lump everything into a single card.

### Per-Module Examples

#### Orders — "Send my orders for the day"

1. Read all drafted orders: `carabiner orders list --status draft`
2. Group by vendor
3. Emit ONE card per vendor:

```json
{
    "tool_name": "notify_user",
    "tool_args": {
        "title": "Pacific Seafood — $2,847.50 (23 items)",
        "message": "Weekly produce order for Pacific Seafood. Delivery scheduled for tomorrow 6 AM. Includes seasonal items and par-level restocks.",
        "type": "warning",
        "detail": "{\"module\":\"orders\",\"action\":\"create\",\"item_id\":\"order-uuid-here\",\"stats\":[{\"label\":\"Items\",\"value\":\"23\"},{\"label\":\"Total\",\"value\":\"$2,847.50\"},{\"label\":\"Delivery\",\"value\":\"Tomorrow 6am\"},{\"label\":\"vs Last Order\",\"value\":\"+8.2%\"}],\"changes\":[{\"op\":\"+\",\"text\":\"Suggested: 5 lbs Atlantic Salmon (below par)\"},{\"op\":\"!\",\"text\":\"Halibut price up 12% vs last order\"},{\"op\":\"→\",\"text\":\"Substituted: Local tomatoes for Roma (better price)\"}],\"actions\":[{\"label\":\"Send Order\",\"type\":\"primary\"},{\"label\":\"Edit\",\"type\":\"secondary\"}],\"suggested_chips\":[\"Add salmon\",\"Remove halibut\",\"Check par levels\"]}"
    }
}
```

#### Inventory — Threshold Alert

```json
{
    "tool_name": "notify_user",
    "tool_args": {
        "title": "3 items below par level",
        "message": "Atlantic Salmon, Heavy Cream, and Shallots are below minimum stock. Pacific Seafood cutoff is in 2 hours.",
        "type": "error",
        "detail": "{\"module\":\"inventory\",\"action\":\"alert\",\"stats\":[{\"label\":\"Below Par\",\"value\":\"3\"},{\"label\":\"Cutoff\",\"value\":\"2 hours\"},{\"label\":\"Est. Cost\",\"value\":\"$485\"}],\"changes\":[{\"op\":\"!\",\"text\":\"Atlantic Salmon: 2 lbs remaining (par: 15 lbs)\"},{\"op\":\"!\",\"text\":\"Heavy Cream: 1 qt remaining (par: 6 qt)\"},{\"op\":\"!\",\"text\":\"Shallots: 0.5 lbs remaining (par: 5 lbs)\"}],\"actions\":[{\"label\":\"Reorder Now\",\"type\":\"primary\"},{\"label\":\"Dismiss\",\"type\":\"secondary\"}],\"suggested_chips\":[\"Order all low items\",\"Show par report\",\"86 salmon\"],\"deadline\":\"2026-04-04T18:00:00Z\"}"
    }
}
```

#### Prep — Daily Prep List

```json
{
    "tool_name": "notify_user",
    "tool_args": {
        "title": "AM Prep List — 14 tasks, est. 3.5 hours",
        "message": "Daily prep list based on tonight's reservations (87 covers) and current inventory levels.",
        "type": "success",
        "detail": "{\"module\":\"prep\",\"action\":\"create\",\"stats\":[{\"label\":\"Tasks\",\"value\":\"14\"},{\"label\":\"Est. Time\",\"value\":\"3.5 hrs\"},{\"label\":\"Covers\",\"value\":\"87\"},{\"label\":\"Priority\",\"value\":\"3 urgent\"}],\"changes\":[{\"op\":\"+\",\"text\":\"Added: Béarnaise (87 covers × 2oz = 11 qt)\"},{\"op\":\"+\",\"text\":\"Added: Bread service mise (3 types)\"},{\"op\":\"!\",\"text\":\"Salmon portions: need 24, have 8 portioned\"}],\"actions\":[{\"label\":\"Start Prep\",\"type\":\"primary\"},{\"label\":\"Reassign\",\"type\":\"secondary\"}],\"suggested_chips\":[\"Print list\",\"Assign to AM crew\",\"Add mise en place\"]}"
    }
}
```

#### Food Cost — Daily P&L

```json
{
    "tool_name": "notify_user",
    "tool_args": {
        "title": "Daily P&L: $12,847 revenue, 28.3% food cost",
        "message": "Yesterday's numbers are in. Food cost is 1.3% above target (27%). Protein costs drove the overage — beef tenderloin waste was 14%.",
        "type": "info",
        "detail": "{\"module\":\"food-cost\",\"action\":\"report\",\"stats\":[{\"label\":\"Revenue\",\"value\":\"$12,847\"},{\"label\":\"Food Cost\",\"value\":\"28.3%\"},{\"label\":\"Target\",\"value\":\"27.0%\"},{\"label\":\"Variance\",\"value\":\"+1.3%\"}],\"changes\":[{\"op\":\"!\",\"text\":\"Beef tenderloin waste: 14% (target: 8%)\"},{\"op\":\"→\",\"text\":\"Labor cost: 22.1% (on target)\"},{\"op\":\"+\",\"text\":\"Bar revenue up 18% (cocktail special working)\"}],\"actions\":[{\"label\":\"Acknowledge\",\"type\":\"primary\"},{\"label\":\"Drill Down\",\"type\":\"secondary\"}],\"suggested_chips\":[\"Show beef breakdown\",\"Compare to last week\",\"Send to team\"]}"
    }
}
```

### Briefings and daily summaries

When the user asks for a brief, briefing, daily summary, "what's today's brief", "what's happening", "morning brief", or any operational overview of today, you must do **TWO things**:

1. **Call `daily_brief_tool`** to emit the dashboard card with live stats and attention items:

```json
{
    "tool_name": "daily_brief_tool",
    "tool_args": {}
}
```

You may optionally pass `{"location_id": "<uuid>"}` if the user has specified a location; otherwise the tool defaults to the workspace's first location.

2. **Give a proper conversational brief in chat.** The card is a dashboard widget — it does NOT replace the morning briefing conversation. After the tool runs, read the data you have (orders, prep, inventory, food cost, menu) and write a real operational brief like a GM reporting to the chef:
   - Financial health check (food cost %, revenue, variance)
   - Operational flags (prep behind, shortages, pending orders/invoices)
   - Recommendations and action items (what to promote, what to watch, what to fix)
   - Keep it concise but substantive — 3-5 paragraphs, not one sentence

The card and the brief serve different purposes: the card lives on the dashboard rail for quick reference all day. The brief is the morning conversation that sets the chef's priorities.

Do not call `notify_user` for daily briefs. The dedicated `daily_brief_tool` is the only correct path for the card.

### Best Practices

1. **Title is the headline** — include the vendor name, total, or key metric. Under 120 chars.
2. **Message is the context** — explain WHY it matters, 1-2 sentences.
3. **detail is ALWAYS a JSON string** — the system parses it to render rich cards.
4. **Changes tell the story** — use `+` for additions, `!` for warnings, `→` for transitions. 2-4 items.
5. **Stats are at-a-glance** — 2-4 key numbers. Use dollar signs, percentages, counts.
6. **Always include item_id** when a specific record is involved.
7. **Set deadline** for time-sensitive items.
8. **Actions come in pairs** — primary (expected) + secondary (alternative).
9. **suggested_chips** — 3 contextual quick-actions the chef can tap.
10. **ALWAYS use notify_user for cards** — this is the only tool that creates dashboard tickets.
