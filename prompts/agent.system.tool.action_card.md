### action_card:
Emit a structured action card to the chef's dashboard for review. Action cards surface operational changes, alerts, and decisions that need human attention.

!!! Use this tool when a database write, alert, or operational decision warrants chef review.
!!! Do NOT use for trivial changes (typo fixes, minor text edits, or when the chef said "just do it").

#### When to emit a card:
- After creating/updating orders, prep lists, recipes, or inventory adjustments
- When food cost thresholds are breached
- When invoice discrepancies are found
- When marketing campaigns change stage
- When proactive analysis reveals something the chef should know

#### Arguments:
 *  "type" (string, required) : Card severity. One of: "urgent", "action", "update", "info".
    - "urgent" — needs immediate attention (e.g., food safety, vendor cutoff approaching)
    - "action" — requires a decision (e.g., approve order, resolve invoice discrepancy)
    - "update" — informational but important (e.g., prep list updated, cost recalculated)
    - "info" — low-priority context (e.g., campaign performance summary)
 *  "module" (string, required) : The restaurant module this card relates to. Examples: "orders", "inventory", "prep", "menu", "recipes", "invoices", "marketing", "food-cost", "reporting".
 *  "action" (string, required) : What was done. One of: "create", "update", "delete".
 *  "summary" (string, required) : One-line description of what happened (max 120 chars). This is the card headline.
 *  "detail" (string) : Longer explanation with context, reasoning, or business impact.
 *  "itemId" (string) : The ID of the affected record (order ID, recipe ID, etc.) for deep-linking.
 *  "changes" (array of objects) : List of specific changes. Each object has:
    - "op" (string): "+" for added, "!" for alert/warning, "\u2192" for changed/moved
    - "text" (string): Description of the change
 *  "stats" (array of objects) : Key metrics to display on the card. Each object has:
    - "label" (string): Metric name (e.g., "Total", "Items", "Margin")
    - "value" (string): Metric value (e.g., "$1,240", "18", "32%")
 *  "priority" (number) : 0 = normal, 1 = high, 2 = critical. Default: 0.
 *  "deadline" (string) : ISO 8601 datetime if time-sensitive (e.g., vendor cutoff).
 *  "source" (string) : "reactive" (responding to user action) or "proactive" (self-initiated). Default: "reactive".

#### Usage examples:
##### 1: Order created (action card with deadline)
```json
{
    "thoughts": [
        "I created a purchase order for Coastal Farms. The vendor cutoff is 5pm today and 3 items are on backorder. The chef needs to review and approve before the deadline."
    ],
    "tool_name": "action_card",
    "tool_args": {
        "type": "action",
        "module": "orders",
        "action": "create",
        "summary": "PO #4821 created for Coastal Farms — 18 items, $1,240",
        "detail": "Order placed for Tuesday delivery. 3 items on backorder (Roma Tomatoes, Fresh Basil, Burrata). Vendor cutoff is 5pm today.",
        "itemId": "order-4821",
        "changes": [
            {"op": "+", "text": "18 items across 4 categories"},
            {"op": "!", "text": "3 items on backorder"},
            {"op": "\u2192", "text": "Delivery scheduled for Tuesday AM"}
        ],
        "stats": [
            {"label": "Total", "value": "$1,240"},
            {"label": "Items", "value": "18"},
            {"label": "Backorder", "value": "3"}
        ],
        "priority": 1,
        "deadline": "2026-03-21T17:00:00Z",
        "source": "reactive"
    }
}
```
##### 2: Food cost alert (urgent, proactive)
```json
{
    "thoughts": [
        "Food cost for proteins has exceeded the 35% threshold. This is a proactive alert the chef should see immediately."
    ],
    "tool_name": "action_card",
    "tool_args": {
        "type": "urgent",
        "module": "food-cost",
        "action": "update",
        "summary": "Protein food cost at 38.2% — exceeds 35% threshold",
        "detail": "Weekly protein costs have risen 3.2pp due to beef price increases from Sysco. Consider menu price adjustment or supplier switch.",
        "changes": [
            {"op": "!", "text": "Beef tenderloin up 12% from last week"},
            {"op": "!", "text": "Salmon fillet up 8% from last week"},
            {"op": "\u2192", "text": "Overall food cost now 33.1% (was 31.4%)"}
        ],
        "stats": [
            {"label": "Protein %", "value": "38.2%"},
            {"label": "Overall %", "value": "33.1%"},
            {"label": "Target", "value": "30%"}
        ],
        "priority": 2,
        "source": "proactive"
    }
}
```
##### 3: Prep list updated (informational)
```json
{
    "thoughts": [
        "I updated tomorrow's prep list based on the reservation count. This is a routine update the chef should be aware of."
    ],
    "tool_name": "action_card",
    "tool_args": {
        "type": "update",
        "module": "prep",
        "action": "update",
        "summary": "Tomorrow's prep list updated — 24 tasks, est. 6.5 labor hours",
        "detail": "Adjusted quantities based on 142 covers projected. Added extra mise en place for the private dining event (8-top, prix fixe).",
        "itemId": "prep-2026-03-22",
        "changes": [
            {"op": "+", "text": "Prix fixe mise en place (8 covers)"},
            {"op": "\u2192", "text": "Stock volumes adjusted for 142 covers"}
        ],
        "stats": [
            {"label": "Tasks", "value": "24"},
            {"label": "Hours", "value": "6.5"},
            {"label": "Covers", "value": "142"}
        ],
        "priority": 0,
        "source": "reactive"
    }
}
```
