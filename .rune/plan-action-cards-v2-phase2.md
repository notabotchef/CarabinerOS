# Phase 2: Frontend Parsing — Rich Card Fields from notify_user

## Data Flow
```
state_push → snapshot.notifications[].detail (JSON string)
                    ↓
          notificationToCard() parses detail
                    ↓
          ActionCard with: module, actions, stats, changes, deadline, itemId,
                          suggestedAction, suggestedChips
                    ↓
          action-card.tsx renders contextual buttons
          action-card-expanded.tsx renders stats, changes, chips
```

## Code Contracts

### Updated notificationToCard (use-action-cards.ts)
```typescript
function notificationToCard(n: A0Notification): ActionCard {
  // Try parsing detail as JSON for rich card data
  let rich: RichCardPayload | null = null;
  if (n.detail) {
    try {
      const parsed = JSON.parse(n.detail.replace(/^```json?\n?|\n?```$/g, ""));
      if (typeof parsed === "object" && parsed !== null) rich = parsed;
    } catch { /* detail is plain text — fallback */ }
  }

  return {
    id: n.id,
    type: NOTIFICATION_TYPE_MAP[n.type] ?? "info",
    module: rich?.module ?? n.group ?? "general",
    action: rich?.action ?? "update",
    summary: n.title || n.message,
    detail: rich ? n.message : (n.detail || n.message),
    itemId: rich?.item_id ?? undefined,
    changes: rich?.changes ?? [],
    stats: rich?.stats ?? [],
    priority: n.priority >= 20 ? 1 : 0,
    deadline: rich?.deadline ?? null,
    status: "new",
    timestamp: n.timestamp ?? Date.now() / 1000,
    source: "reactive",
    suggestedAction: rich?.suggested_action ?? undefined,
    suggestedChips: rich?.suggested_chips ?? undefined,
  };
}
```

### RichCardPayload interface (types.ts)
```typescript
interface RichCardPayload {
  module?: string;
  action?: string;
  item_id?: string;
  stats?: ActionCardStat[];
  changes?: ActionCardChange[];
  actions?: Array<{ label: string; type: "primary" | "secondary" | "danger" }>;
  deadline?: string;
  suggested_action?: string;
  suggested_chips?: string[];
}
```

## Tasks

### Task 2a: Add RichCardPayload type
- **File**: `frontend/src/lib/types.ts`
- **Logic**: Add the RichCardPayload interface after ActionCard type.
  Also add `actions` field to ActionCard type:
  `actions?: Array<{ label: string; type: "primary" | "secondary" | "danger" }>`
- **touches**: [types.ts]
- **provides**: [RichCardPayload type, actions field on ActionCard]

### Task 2b: Update notificationToCard to parse rich detail
- **File**: `frontend/src/hooks/use-action-cards.ts`
- **Logic**: Modify `notificationToCard()` (line 64) to try parsing `n.detail` as JSON.
  If valid JSON with expected fields, populate the full ActionCard. If not, fallback
  to current flat behavior. Strip markdown code fences before parsing.
- **Edge cases**: detail may be plain text, JSON wrapped in code blocks, or malformed JSON
- **touches**: [use-action-cards.ts]
- **requires**: [RichCardPayload from task-2a]
- **depends_on**: [task-2a]

## Failure Scenarios

| When | Then | Error |
|------|------|-------|
| detail is plain text (not JSON) | JSON.parse fails, catch block, use flat fallback | Card shows as today — no regression |
| detail is JSON wrapped in ```json fences | Regex strips fences before parse | Correct rich card |
| detail has some fields missing | Nullish coalescing fills defaults | Partial rich card |
| detail is JSON but wrong schema | Fields ignored via ?? fallback | Card shows flat text |

## Rejection Criteria
- DO NOT break existing cards that have plain text detail
- DO NOT require detail to be JSON — MUST work with flat text
- DO NOT add new props to notification-panel or shell — card type changes are internal
- DO NOT parse detail on every render — parse once in notificationToCard

## Cross-Phase Context
- **Assumes Phase 1**: A0 sends JSON in notify_user detail field
- **Exports**: ActionCard now populated with module, actions, stats, changes, deadline, suggestedChips
- **Phase 3 needs**: actions array on ActionCard to render contextual buttons

## Acceptance Criteria
- [ ] notificationToCard parses JSON detail and populates rich fields
- [ ] Plain text detail still works (no regression)
- [ ] Module field populated from rich JSON (not "general")
- [ ] Stats, changes, chips populated when A0 sends them
- [ ] TypeScript compiles with no new errors
