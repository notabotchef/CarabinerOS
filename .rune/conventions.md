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
- **Auto-emit**: DB write tools (`db_mutate`, `*_create`, `*_update`, `*_delete`) auto-generate cards via `_30_action_card_emit.py` extension — zero extra LLM tokens
- **Proactive**: A0 calls `action_card` tool for non-DB notifications (menu ideas, reminders, alerts)
- **sio access**: Always walk agent hierarchy to find sio — subordinates don't have it directly
- **Card types**: urgent (amber), action (blue), update (emerald), info (violet)
- **Frontend**: `useActionCards` hook, sessionStorage persistence, 2-col solitaire grid with flip expand
- **Visual identity**: Kitchen Display System aesthetic — left-border station colors, monospace labels, "Tickets/FIRE/Cleared" vocabulary
- **Action buttons**: ✗ (red/dismiss) + ✓ (green/commit) + contextual action label per type+module (e.g., "86 It", "Order Now", "Approve")
- **Chat suggestions**: `getDefaultSuggestion(card)` + `getDefaultChips(card)` — type+module lookup map for pre-fill and quick-action chips
- **Completed cards**: Green-tinted "Cleared" section at bottom of panel, still expandable, hover to dismiss

## Module Chat (Context Piggybacking)
- **Pattern**: Every module panel has an inline `<ModuleChat>` component for A0 interaction
- **Context piggybacking**: Module data prepended in brackets to every outgoing message: `[module=orders, vendor=X, order_id=Y, total=$Z] user message here`
- **A0 reads silently**: System prompt tells A0 to parse brackets and never repeat them
- **Display filter**: Frontend strips `[...]` prefix from all rendered messages (both mini-chat and main chat)
- **No hidden messages**: Context travels WITH each message, not as a pre-sent first message
- **Reusable**: One `ModuleChat` component used by all modules — Orders wired first, others pending

## Module Pages (Chat-First)
- **Default pattern**: Chat-first — tabs display data, inline chat modifies it. No forms, no inline editing.
- **Exception**: Recipes gets a full editor (Smart Add, scaling, method steps) — the ONE module that isn't chat-first
- **Checkboxes**: Prep items get tap-to-complete checkboxes — the ONE physical interaction that needs a tap, not chat
- **Three buttons**: Orders detail has Send / Draft / Cancel — the only structured actions
- **Vendor select**: New orders have a vendor dropdown — the ONE structured input to prevent A0 hallucinating vendors

## Design Philosophy
- **"Make It Nice"**: EMP/Guidara/Meyer hospitality philosophy applied to software (docs/research/make-it-nice-hospitality-philosophy-2026-03.md)
- **Useful = delicious**: Core function works. Data is accurate. Speed is there.
- **Welcoming = gracious**: Anticipates needs. Remembers. Gets out of the way. Shows up when needed.
- **Every pixel is a touchpoint**: Empty states, loading states, error messages — all hospitality moments
- **95/5 rule**: 95% operational excellence, 5% surprise and delight
- **Peak-End rule**: Design the "wow" moment and the exit. The ending matters as much as the beginning.
