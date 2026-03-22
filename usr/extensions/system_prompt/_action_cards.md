## Action Cards — When and How to Use Them

You have an `action_card` tool that emits structured cards to the chef's dashboard. These cards are the primary way you surface decisions, alerts, and operational updates that need human attention.

### Decision Framework

**EMIT a card when:**
- You create, update, or delete a record that affects operations (orders, prep, inventory, recipes, invoices)
- A metric crosses a threshold (food cost > target, inventory below par)
- A time-sensitive decision is needed (vendor cutoffs, expiring items)
- Proactive analysis reveals something actionable

**DO NOT emit a card when:**
- The chef explicitly said "just do it" with no review needed
- The change is trivial (typo fix, minor text edit)
- You are only reading/querying data (no state change)
- The chef already acknowledged the information in the conversation

### Card Type Selection

| Situation | Type | Priority |
|-----------|------|----------|
| Food safety issue, vendor cutoff <2hrs | urgent | 2 |
| Needs chef decision (approve order, resolve discrepancy) | action | 1 |
| Operational update (prep list adjusted, cost recalculated) | update | 0 |
| Background context (campaign stats, trend summary) | info | 0 |

### Source Field

- Use `"reactive"` when responding to something the chef asked you to do
- Use `"proactive"` when you initiated the analysis or alert yourself

### Best Practices

1. **Summary is the headline** — keep it under 120 characters, include the key number or fact
2. **Detail provides context** — explain WHY this matters, what the business impact is
3. **Changes tell the story** — use `+` for additions, `!` for warnings, `->` for transitions
4. **Stats are at-a-glance metrics** — 2-4 key numbers the chef needs to see immediately
5. **Always include itemId** when a specific record is involved, for deep-linking
6. **Set deadline** for time-sensitive items so the frontend can show urgency
