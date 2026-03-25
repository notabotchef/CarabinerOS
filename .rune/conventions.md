# Conventions

## Python (Backend)
- **Naming**: snake_case for functions/variables, PascalCase for classes and enums
- **Type hints**: Modern Python 3.10+ union syntax (`str | None`), full annotations on public APIs
- **Imports**: Absolute from project root (`from python.helpers import ...`, `from carabiner.db.models import ...`)
- **Async**: Uses `asyncio` + `nest_asyncio` for nested event loops; async throughout DB and API layers
- **API handlers**: Class-based, inheriting `ApiHandler`, with `async def process(...)` entry point
- **API responses**: Dict-based `{"ok": True, "data": ...}` or `{"ok": False, "error": "..."}`
- **ORM models**: SQLAlchemy 2.0 declarative with UUID primary keys, `TimestampMixin`, `LocationScopedMixin`
- **Serialization**: Pydantic v2 schemas in `carabiner/api/schemas.py` for API output
- **Error handling**: try/except in API handlers with explicit Exception raising
- **Extensions**: Add behavior via `usr/extensions/` (system_prompt, tool_execute_after, etc.) — never modify A0 core files

## TypeScript/React (Frontend)
- **Component naming**: PascalCase functions, kebab-case filenames (e.g., `action-card.tsx` -> `ActionCard`)
- **Imports**: ESM with path alias `@/*` -> `./src/*`
- **State management**: React Context + custom hooks (no Redux/Zustand)
- **Hooks pattern**: `use-[name].ts` files exporting a single hook
- **UI library**: shadcn/ui components in `components/ui/`, customized via `globals.css` CSS variables
- **Real-time**: Socket.IO client singleton in `lib/socket-client.ts`, consumed via `useSocket` hook
- **Types**: Centralized in `lib/types.ts`
- **Markdown**: ReactMarkdown with remark-gfm for GFM table support

## Testing
- **Framework**: pytest with `@pytest.mark.asyncio` for async tests
- **Structure**: Separate `tests/` directory (not co-located)
- **Naming**: `test_*.py` files with `test_` prefixed functions
- **Style**: Function-based (no test classes)
- **Frontend**: No frontend tests configured

## Git
- **Commit style**: Conventional commits (`feat(scope):`, `fix(scope):`, `chore:`)
- **Branching**: Agents use feature branches or worktrees; user works on main
- **Dependencies**: requirements2.txt has exact Docker pins; requirements.txt uses flexible pins

## Development
- **Local dev**: `pnpm dev` (frontend :3000) + `.venv/bin/python run_ui.py` (backend :5000)
- **Docker**: `docker compose -f docker-compose.dev.yml up` — serves on :8080 via nginx
- **Preferred**: Docker (port 8080) — handles all proxying correctly

## Action Cards
- **Delivery**: A0 calls `notify_user` directly after DB writes → `NotificationManager` → `state_push` → `snapshot.notifications` → frontend converts to `ActionCard`
- **No subordinate**: Expo agent is NOT used for reactive notifications. A0 handles urgency assessment inline. Expo reserved for scheduled proactive sweeps only.
- **No auto-emit**: `_30_action_card_emit.py` primary path disabled. Single notification path via `notify_user`.
- **Card types**: urgent (amber), action (blue), update (emerald), info (violet)
- **Type mapping**: A0 `notify_user` type → card type: warning→urgent, error→urgent, success→update, info→info, progress→info
- **Frontend**: `useActionCards` hook, sessionStorage persistence, 2-col grid with spring enter/exit animations
- **Visual identity**: Kitchen Display System aesthetic — monospace labels, "Tickets/FIRE/Cleared" vocabulary
- **Action buttons**: ✗ (red/dismiss) + ✓ (green/commit) + contextual action label per type+module (e.g., "86 It", "Order Now", "Approve")
- **Chat suggestions**: `getDefaultSuggestion(card)` + `getDefaultChips(card)` — type+module lookup map for pre-fill and quick-action chips
- **Completed cards**: Green-tinted "Cleared" section at bottom of panel, still expandable, hover to dismiss

## Module Chat (Context Piggybacking)
- **Pattern**: Detail panels (orders, inventory counts) have inline `<ModuleChat>` for A0 interaction
- **Lean context**: Only send `[module=X, record_id=Y]` — A0 reads full details from DB. Never send line items, totals, or vendor names in brackets.
- **Persistent conversations**: `moduleId` + localStorage map (`carabiner:module-chat-contexts`) — conversations survive navigation/refresh
- **Send-then-subscribe**: On first send: createNewChat → sendMessage → subscribe. Never subscribe before sending (causes race condition).
- **onMessageSent**: Fires when `loading` transitions true→false (A0 finished). Parent uses it to refetch data.
- **Expo whisper**: Mini-chat shows `snapshot.log_progress` during loading instead of static "Working..."
- **Welcome bleed filter**: Both mini-chat and main chat filter out A0 greetings ("Welcome to CarabinerOS") before first user message
- **Display filter**: Frontend strips `[...]` prefix from all rendered messages (both mini-chat and main chat)
- **No chat bar**: Chat does NOT live as a persistent bar on module pages. It lives in: detail panel slide-overs, home page, chat pages, action card panel, sidebar.

## Module Pages (Chat-First)
- **Default pattern**: Chat-first — tabs display data, inline chat modifies it. No forms, no inline editing.
- **Exception**: Recipes gets a full editor (Smart Add, scaling, method steps) — the ONE module that isn't chat-first
- **Checkboxes**: Prep items get tap-to-complete checkboxes — the ONE physical interaction that needs a tap, not chat
- **Three buttons**: Orders detail has Send / Draft / Cancel — the only structured actions
- **Vendor select**: New orders have a vendor dropdown — the ONE structured input to prevent A0 hallucinating vendors

## MCP Tools (Token Cost)
- **List tools**: Return summary-only fields via `_slim()` — strips line_items, detail_points, summary, prompt, extracted_data, etc.
- **Get tools**: Return full objects with all fields
- **Never dump full tables**: A0 should NOT call `*_list` before creating a new record. Lists are for browsing, not context-gathering.

## Design Philosophy
- **"Make It Nice"**: EMP/Guidara/Meyer hospitality philosophy applied to software (docs/research/make-it-nice-hospitality-philosophy-2026-03.md)
- **Useful = delicious**: Core function works. Data is accurate. Speed is there.
- **Welcoming = gracious**: Anticipates needs. Remembers. Gets out of the way. Shows up when needed.
- **Every pixel is a touchpoint**: Empty states, loading states, error messages — all hospitality moments
- **95/5 rule**: 95% operational excellence, 5% surprise and delight
- **Peak-End rule**: Design the "wow" moment and the exit. The ending matters as much as the beginning.
