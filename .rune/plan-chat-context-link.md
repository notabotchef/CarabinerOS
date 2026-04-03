# Plan: Record-Level Chat Association

## Goal
Every DB record remembers which chat conversation created/modified it. When the user
clicks a record on any module page, the side-chat shows that conversation.

## Architecture
- Add `chat_context_id` (nullable String(50)) to all workspace models via mixin
- System prompt injects the current context ID so A0 passes it via `--chat-context`
- CLI write commands accept `--chat-context` and store it in the record
- API responses include `chat_context_id`
- ModuleChat reads it from the record prop and subscribes to that context

## Phases

| # | Phase | Status | Files | Session |
|---|-------|--------|-------|---------|
| 1 | Backend: DB column + CLI flag + prompt injection | ✅ Done | 6 | 15 |
| 2 | Frontend: ModuleChat reads chat_context_id from record | ✅ Done | 3 | 15 |

## Key Decisions
- **D1**: Mixin approach — `ChatContextMixin` added to workspace models (not per-model columns)
- **D2**: System prompt injects `Current chat context: <id>` so A0 knows its context ID
- **D3**: CLI `--chat-context` is optional — A0 passes it, manual CLI use doesn't require it
- **D4**: `create_all()` handles schema update (no Alembic migration — dev mode)

## Risks
- A0 may forget to pass `--chat-context` → records have null → side-chat starts fresh (acceptable)
- Context IDs are ephemeral (8-char, per-session) → old contexts may not have chat history after restart

## Outcome
- [ ] DB records store chat_context_id when modified by A0
- [ ] API returns chat_context_id for each record
- [ ] Side-chat subscribes to the record's chat context
- [ ] Records without chat_context_id still work (null = fresh chat)
