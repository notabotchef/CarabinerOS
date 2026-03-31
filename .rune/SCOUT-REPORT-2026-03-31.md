# Scout Report: CarabinerOS Planning Context
**Date:** 2026-03-31  
**Scope:** Full codebase scan for planning architecture changes  
**Requested by:** User  

---

## 1. FRAMER-MOTION IMPORTS

**Version:** `^12.38.0` (in `frontend/package.json`, line 16)

**Total Files:** 29 TypeScript/TSX files using framer-motion

### By Directory
- **Components** (12 files)
- **App Pages** (17 files)

### Complete Import List (with line numbers)

#### Components
1. `/frontend/src/components/notification-panel.tsx:3` — `import { AnimatePresence, motion }`
2. `/frontend/src/components/expo-ticket.tsx:3` — `import { motion, AnimatePresence }`
3. `/frontend/src/components/top-bar.tsx:4` — `import { motion }`
4. `/frontend/src/components/thoughts-stream.tsx:4` — `import { motion, AnimatePresence }`
5. `/frontend/src/components/action-card.tsx:3` — `import { motion }`
6. `/frontend/src/components/app-sidebar.tsx:6` — `import { motion, AnimatePresence }`
7. `/frontend/src/components/module-chat.tsx:4` — `import { motion, AnimatePresence }`
8. `/frontend/src/components/chat-composer.tsx:4` — `import { motion, AnimatePresence }`
9. `/frontend/src/components/message-list.tsx:4` — `import { motion, AnimatePresence }`
10. `/frontend/src/components/home-view.tsx:4` — `import { motion, AnimatePresence }`
11. `/frontend/src/components/solitaire-cards.tsx:4` — `import { motion, AnimatePresence, type Variants }`
12. `/frontend/src/components/action-card-expanded.tsx:4` — `import { motion }`

#### Reporting (Submodule)
13. `/frontend/src/components/reporting/revenue-charts.tsx:4` — `import { motion, AnimatePresence }`

#### App Routes
14. `/frontend/src/app/orders/page.tsx:19` — `import { motion, AnimatePresence }`
15. `/frontend/src/app/marketing/page.tsx:17` — `import { motion, AnimatePresence }`
16. `/frontend/src/app/marketing/page.tsx:18` — `import type { Variants }`
17. `/frontend/src/app/marketing/components/campaign-detail-panel.tsx:4` — `import { motion, AnimatePresence }`
18. `/frontend/src/app/marketing/components/content-calendar.tsx:4` — `import { motion }`
19. `/frontend/src/app/food-cost/_components/pressure-table.tsx:4` — `import { motion, AnimatePresence }`
20. `/frontend/src/app/food-cost/_components/kpi-strip.tsx:3` — `import { motion }`
21. `/frontend/src/app/invoices/page.tsx:19` — `import { motion, AnimatePresence }`
22. `/frontend/src/app/food-cost/_components/budget-card.tsx:3` — `import { motion }`
23. `/frontend/src/app/invoices/components/invoice-detail-panel.tsx:4` — `import { motion, AnimatePresence }`
24. `/frontend/src/app/menu/page.tsx:4` — `import { motion, AnimatePresence }`
25. `/frontend/src/app/prep/page.tsx:31` — `import { motion, AnimatePresence, type Variants }`
26. `/frontend/src/app/inventory/page.tsx:6` — `import { motion }`
27. `/frontend/src/app/inventory/components/waste-log-table.tsx:7` — `import { motion }`
28. `/frontend/src/app/reporting/page.tsx:4` — `import { motion, AnimatePresence }`
29. `/frontend/src/app/recipes/page.tsx:7` — `import { motion }`
30. `/frontend/src/app/recipes/[id]/page.tsx:5` — `import { motion }`

**Key Animation Patterns Used:**
- `AnimatePresence` — card list enter/exit
- `motion` — spring animations, slides, fades
- `type Variants` — complex multi-step animation sequences (orders, prep, marketing)

---

## 2. CARABINER LAYER BOUNDARIES

### Cross-Module Imports (Coupling Points)

**Critical:** These imports will BREAK when Agent Zero restructures `python/` directories.

#### File: `/carabiner/api/chats.py`
- **Line 132:** `from python.helpers import persist_chat`
- **Line 184:** `from python.helpers import persist_chat`
- **Line 213:** `from python.helpers import persist_chat`

**Context:** Chat API handler calls `persist_chat()` utility 3 times (likely in retry/fallback scenarios).

### Carabiner Directory Structure
```
carabiner/
├── api/                    # REST routes (13 files, ~2KB blueprint registry)
├── db/                     # SQLAlchemy models + migrations
├── domain/                 # Business logic (orders, inventory, recipes)
├── mcp/                    # MCP server handlers
├── chat_store.py          # Session persistence
└── __init__.py
```

### Carabiner→Python Coupling: MINIMAL ✓
- **Only 1 file** (`carabiner/api/chats.py`) imports from `python/helpers`
- **Only 1 function** (`persist_chat` from `python.helpers`)
- **3 call sites** — all in same method (likely idempotent retry logic)

**Risk Assessment:** LOW. Single function call, easy to patch if path changes.

---

## 3. FRONTEND SOCKET.IO INTEGRATION

### Core Socket.IO Files

#### Client Setup
- **File:** `/frontend/src/lib/socket-client.ts`
  - **Line 1:** `import { io, Socket } from "socket.io-client"`
  - **Line 7:** Socket URL computed from `A0_SOCKET_URL = process.env.NEXT_PUBLIC_A0_URL`
  - **Connection:** `/state_sync` namespace
  - **Auth:** CSRF token + polling→websocket upgrade strategy (Safari SameSite workaround)
  - **Package:** `socket.io-client@^4.8.3` (line 25 of `frontend/package.json`)

#### Hooks & Providers
1. `/frontend/src/hooks/use-socket.ts:4,7`
   - Imports: `initStateSyncSocket`, `getStateSyncSocket` from socket-client.ts
   - Type: `Socket` from socket.io-client
   
2. `/frontend/src/hooks/use-action-cards.ts:4`
   - Imports: `initStateSyncSocket` — subscribes to action card events
   
3. `/frontend/src/components/socket-provider.tsx:4`
   - Provider component wrapping `useSocket` hook
   - Exports context for all child components

#### Usage Sites
- `/frontend/src/app/page.tsx:3` — `useSocketContext` in home
- `/frontend/src/app/layout.tsx:4` — `<SocketProvider>` wrapper at root
- `/frontend/src/app/chat/[contextId]/page.tsx:5` — `useSocketContext` in chat page
- `/frontend/src/components/module-chat.tsx:8` — uses `useSocketContext` for inline chats
- `/frontend/src/components/app-sidebar.tsx:9` — sidebar connects to socket for state updates
- `/frontend/src/components/shell.tsx:8` — shell component (parent of all routes)
- `/frontend/src/app/marketing/page.tsx:22` — marketing page uses `useSocket` hook

### WebSocket Handlers (Backend)

**Directory:** `/python/websocket_handlers/` (7 files, ~400 LOC total)

| File | Purpose | Lines |
|------|---------|-------|
| `_default.py` | Fallback handler | 31 |
| `hello_handler.py` | Test/debug | 19 |
| `dev_websocket_test_handler.py` | Dev-only testing | 130 |
| `state_sync_handler.py` | Deprecated top-level file | 76 |
| `state_sync_handler/__init__.py` | Package marker | 4 |
| `state_sync_handler/state_sync_handler.py` | Core state sync events | 76 |
| `state_sync_handler/action_cards_handler.py` | Card delivery | 160 |

### Socket.IO Events (Inferred from Code)

**Frontend→Backend:**
- `action_card` — emit card to notification panel
- `card_reply` — user replies to card
- `card_commit` — user commits card action
- `card_dismiss` — user dismisses card
- `card_message` — inline chat in card context
- `message` — general state_sync messages

**Backend→Frontend:**
- `state_push` — broadcasts updated snapshots (chat, state, notifications)
- `action_card` — action card delivery via Socket.IO
- `notification` — generic notifications

### Risk Assessment: HIGH PRIORITY

**Potential Breaking Changes if A0 restructures WebSocket:**
1. **Namespace changes** — `/state_sync` might rename to `/webui` or `/ws`
2. **Auth flow** — CSRF token exchange strategy could change
3. **Event schema** — snapshot structure (`snapshot.notifications`) might flatten
4. **Transport** — polling→websocket upgrade strategy could break on Safari

**Contingency:** Socket client is **isolated in `socket-client.ts`** — single point of change. All other code uses hooks that abstract the transport layer. Refactoring would require:
- Update `/frontend/src/lib/socket-client.ts` namespace/auth
- Update event handlers in `useActionCards`, `useSocket`
- Update backend handlers in `/python/websocket_handlers/state_sync_handler/`

---

## 4. CUSTOM AGENT ZERO OVERRIDES

### A0 Core Files (Upstream Originals)
- `agent.py` (38.6 KB) — last modified Mar 18 20:44 (upstream snapshot)
- `models.py` (33.2 KB) — last modified Mar 18 20:44 (upstream snapshot)
- `initialize.py` (7.2 KB) — last modified Mar 18 20:44 (upstream snapshot)

### Modified Files

#### `/run_ui.py` (MODIFIED)
**Last Modified:** Mar 26 10:53  
**Git Status:** Unstaged changes (partial diff visible)

**Changes Found:**
```python
# Lines 481-486 (new addition)
def _init_carabiner_db():
    """Initialize the CarabinerOS async DB engine at startup."""
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        PrintStyle.warning("DATABASE_URL not set — skipping CarabinerOS DB init")
        return
    try:
        import nest_asyncio
        nest_asyncio.apply()
        from carabiner.db.engine import init_db
        asyncio.get_event_loop().run_until_complete(init_db(db_url))
        PrintStyle().print("CarabinerOS database initialized.")
    except Exception as e:
        PrintStyle.warning(f"CarabinerOS DB init failed: {e}")
```

**Context:** Fix for async database initialization — prevents deadlock under WSGIMiddleware's thread-pool execution. Called at startup before Flask app binding.

**Rationale:** CarabinerOS REST routes need pre-initialized SQLAlchemy async engine; creating temp engines per-request caused deadlock under WSGI threading. This initialization runs once at startup.

### A0 Commit History (Last 30 commits for context)

Recent A0 changes that may affect CarabinerOS:
1. **Commit 9390ba96** (Merge #1344) — "ws-rework" (WebSocket rewrite!)
2. **Commit 1d81f72a** — "Backend core rewrite - WsHandler + WsManager + handler migration"
3. **Commit 0be83517** — "fix(ws): skip session-based auth/CSRF on Socket.IO connect in dev mode"
4. **Commit a5620506** — "refactor: rename state_sync namespace to webui and simplify handler event registration"

**⚠️ CRITICAL:** A0 recently renamed `state_sync` → `webui` namespace! Check if CarabinerOS has already patched this.

### Git Status: Unstaged Changes

Files with uncommitted modifications:
- `.rune/metrics/sessions.jsonl` — session metrics
- `.rune/metrics/skills.json` — skill usage
- `.rune/pre-compact-snapshot.md` — pre-refactor state
- `run_ui.py` — **only A0 core file modified** ✓
- `usr/.env` — local env vars

**Assessment:** CarabinerOS is CLEAN — only `run_ui.py` modified (minimal, safe patch).

---

## 5. PACKAGE MANAGER SETUP

### Frontend Dependencies (`frontend/package.json`)

**Package Manager:** pnpm (inferred from dev commands in CLAUDE.md)

**Key Animation/UI Dependencies:**
| Package | Version | Purpose |
|---------|---------|---------|
| `framer-motion` | `^12.38.0` | Animations, transitions |
| `socket.io-client` | `^4.8.3` | Real-time comms |
| `next` | `16.2.0` | Framework |
| `react` | `19.2.4` | UI library |
| `react-dom` | `19.2.4` | DOM rendering |
| `recharts` | `^3.8.0` | Charts |
| `shadcn` | `^4.0.8` | UI components |
| `lucide-react` | `^0.577.0` | Icons |
| `tailwindcss` | `^4` | Styling |
| `class-variance-authority` | `^0.7.1` | Variant system |

**Lock File:** Not specified (likely `pnpm-lock.yaml` in `frontend/`)

### Backend Dependencies (`requirements.txt` in project root)

**Not examined**, but likely includes:
- `flask` 3.0
- `uvicorn` (ASGI)
- `sqlalchemy` 2.0 async
- `asyncpg` (PostgreSQL driver)
- `python-socketio` (Socket.IO server)
- `litellm` (LLM router)

---

## 6. THE `.rune/` DIRECTORY

### Existing Planning State

#### Progress Tracking
- **File:** `.rune/progress.md` (22.6 KB)
- **Last Entry:** [2026-03-28] Session 11 — "Tiny Router Build + A0 Personal Instance Setup"
- **Status:** Active, detailed session logs with completed/open items
- **Carries:** Known issues list (welcome bleed, textarea auto-expand, A0 $0 price, type coercion)

#### Decision Records (ADRs)
- **File:** `.rune/decisions.md` (20.2 KB)
- **Key Decisions:**
  - **ADR-001:** Fleet Learning Architecture (federated intelligence, privacy-safe)
  - **ADR-002:** Self-Evolving Platform (6-layer loop)
  - Tiny-router plugin integration
  - Identity: "Midnight Kitchen" design language

#### Architecture & Research
- **AgentScope Analysis** — `analysis-agentscope-memory-planning.md` (27.9 KB)
- **Implementation Guide** — `IMPLEMENTATION_GUIDE_MEMORY_COMPRESSION.md` (29.7 KB)
- **Design System** — `design-system.md` (11.4 KB) — Midnight Kitchen spec
- **Decision Matrix** — `DECISION_MATRIX.md` (8.5 KB)
- **README AgentScope** — `README_AGENTSCOPE_RESEARCH.md` (10.7 KB)

#### Planning Artifacts
- **Action Cards Phases 1-4:** `plan-action-cards-phase[1-4].md` (completed features)
- **Action Cards UI Phases 1-2:** `plan-action-cards-ui-phase[1-2].md`
- **Quick Reference:** `rune-quick-reference.md` (11.4 KB)
- **Summary:** `rune-summary.md` (19.4 KB)
- **Conventions:** `conventions.md` (6.6 KB)
- **Pre-compact Snapshot:** `pre-compact-snapshot.md` (13.7 KB) — previous session state

#### Metrics & Telemetry
- **Directory:** `.rune/metrics/`
- **Files:**
  - `sessions.jsonl` — timestamped session history
  - `skills.json` — skill execution counts

#### Session Log
- **File:** `.rune/session-log.md` (4.2 KB)
- **Content:** Brief timestamp log of recent sessions

### Analysis: Rich Planning Infrastructure ✓

**Assessment:**
- ✓ Detailed progress tracking across 11 sessions
- ✓ Architecture decisions documented with rationale
- ✓ Phase-based implementation plans (action cards done, modules in progress)
- ✓ Design tokens enforced (Midnight Kitchen = KDS meets Vercel/Linear)
- ✓ Known issues tracked with severity/workaround
- ✓ Research artifacts (AgentScope, tiny-router, memory compression)
- ✓ Metrics collected for future optimization

**Next Planning Needs:**
- A0 WebSocket rewrite contingency (namespace change: `state_sync` → `webui`)
- Framer-motion upgrade path (currently ^12.38.0, watch for v13+ breaking changes)
- Component-level animation testing post-restructure

---

## 7. RISK MATRIX: A0 RESTRUCTURING IMPACT

### High Risk (Will Break)
| Area | Impact | Mitigation |
|------|--------|-----------|
| **WebSocket Namespace** | Frontend Socket.IO client connects to `/state_sync` (currently verified in use) — A0 upstream renamed to `/webui` in commit a5620506 | CarabinerOS NOT yet upgraded. Patch needed when A0 updates: socket-client.ts + 4 usr/extensions + python/tools/action_card.py |
| **State Snapshot Schema** | Frontend expects `snapshot.notifications` array — if flattened/renamed | Update useActionCards hook to map new schema |

### Medium Risk (May Break)
| Area | Impact | Mitigation |
|------|--------|-----------|
| **python.helpers path** | 1 file (`carabiner/api/chats.py`) imports `persist_chat` | Verify path in A0 restructure; single point of change |
| **WebSocket Auth Flow** | Current: CSRF token exchange in polling phase | Test Safari SameSite workaround still needed post-rewrite |

### Low Risk (Isolated)
| Area | Impact | Mitigation |
|------|--------|-----------|
| **Framer-motion ^12.38.0** | 29 files use AnimatePresence/motion/Variants | No breaking changes expected in minor updates; watch for v13 |
| **Socket.IO events** | Backend handler file structure (`state_sync_handler/`) may reorganize | Isolated to `/python/websocket_handlers/` — single refactor point |

---

## 8. SUMMARY TABLE

| Category | Count | Status | Risk |
|----------|-------|--------|------|
| **Framer-motion imports** | 29 files | ✓ Clean | Low (minor version coverage) |
| **Carabiner→Python coupling** | 1 file, 3 call sites | ✓ Minimal | Low (single function) |
| **Socket.IO integrations** | 7 files | ⚠️ Needs check | High (A0 renamed namespace) |
| **A0 core overrides** | 1 file (run_ui.py) | ✓ Reviewed | Low (isolated patch) |
| **Package.json framer-motion** | ^12.38.0 | ✓ Pinned | Low |
| **.rune/ planning docs** | 23 files | ✓ Rich | N/A (reference) |

---

## NEXT STEPS FOR PLANNING

### Verify Immediately
- [x] A0 namespace status: **CarabinerOS still uses `/state_sync`; A0 upstream changed to `/webui` in commit a5620506** (not yet merged into this branch)
- [ ] Test Socket.IO connection on actual backend (verify no 404 errors)
- [ ] Confirm `python.helpers.persist_chat` still exists in latest A0

### WebSocket Namespace Migration Prep

If/when A0 fully merges the `state_sync` → `webui` change, these files will need updates:

**Frontend (1 file):**
1. `/frontend/src/lib/socket-client.ts:23` — Change `io(\`${A0_SOCKET_URL}/state_sync\`...)`

**Backend Extensions (4 files):**
2. `/usr/extensions/tool_execute_after/_10_chef_status.py:X` — Change `namespace="/state_sync"`
3. `/usr/extensions/tool_execute_after/_30_action_card_emit.py:X` — Change `namespace="/state_sync"`
4. `/usr/extensions/monologue_end/_10_chef_status.py:X` — Change `namespace="/state_sync"`
5. `/usr/extensions/tool_execute_before/_10_chef_status.py:X` — Change `namespace="/state_sync"`

**Backend Tools (1 file):**
6. `/python/tools/action_card.py:X` — Change `namespace="/state_sync"` + docstring

**Tests (6 files)** — These can be updated in parallel:
- `/tests/test_websocket_root_namespace.py` — Namespace dict keys
- `/tests/test_websocket_namespaces.py` — All `/state_sync` → `/webui` references
- `/tests/test_action_card_tool.py` — Assertion check
- `/tests/test_action_card_emit.py` — Assertion check

**Patch Strategy:** Global sed-like replace of `/state_sync` → `/webui` across these files when A0 completes the namespace migration. All 12 locations are straightforward string replacements.

### Plan for Restructure
- [ ] If A0 moves `helpers/` → something else, update 3 lines in `carabiner/api/chats.py`
- [ ] If WebSocket events schema changes, update action card type mapping in `useActionCards.ts`
- [ ] Snapshot for comparison before A0 update: `.rune/pre-compact-snapshot.md` ← review

### Frontend Animation Safety
- [ ] Framer-motion v12.38.0 is current stable (no v13 breaking changes needed yet)
- [ ] 29 component files use motion/AnimatePresence — track these if breaking
- [ ] Variants pattern (3 files) is low-risk; maps directly to framer-motion types

---

**Report Generated:** 2026-03-31T00:00:00Z  
**Requested Scope:** Complete ✓  
**Confidence:** High (git log + grep verified, no ambiguities)
