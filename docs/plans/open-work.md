# CarabinerOS — Open Work Items

Updated: 2026-03-22 (session 6)

## CRITICAL (Blocks core functionality)

- [x] ~~**MCP DATABASE_URL in Docker**~~ — Fixed: merged parent env into MCP subprocess via `mcp_handler.py`. MCP server now inherits DATABASE_URL from docker-compose.
- [x] ~~**Bake Codex patch into Dockerfile**~~ — Fixed: Dockerfile.agent-zero runs `initialize.py` at container startup (not build time, since usr/ is volume-mounted). chpasswd `check=False` fix applied.
- [ ] **Run migration 009** — "cOS Test Kitchen" single-location consolidation. Migration file committed but has known fix for ARRAY(TEXT) format (asyncpg needs Python lists, not PG string literals). Fixed version on worktree branch.

## HIGH Priority (Demo Blockers)

- [ ] **UI/UX design refresh** — CarabinerOS looks like "another Claude Code website." Needs restaurant-first visual identity: dashboards, KPI panels, prep boards. Chat should be one input mode, not the whole UI. Run `rune:design` audit. Explore Google Stitch for UI generation.
- [ ] **Functional module pages** — Orders, Inventory, Prep, Menu, Recipes, Invoices, Marketing, Reporting pages need real CRUD functionality (not just mock data). Each page should read from the real DB and support basic operations.
- [ ] **Soft delete for orders** — A0 should set `deleted=true` instead of hard delete. CarabinerOS auto-purges after 30 days. Useful for undo, repeat orders, and audit trail. Needs DB column + migration + UI section on orders page.
- [ ] **Expo filtering** — MCP tool calls invisible (add `"mcp"` to TICKET_LOG_TYPES), "Calling LLM..." leaks through (filter as filler), raw tool names need kitchen-language mapping, thoughts extracted but never rendered, warnings/errors invisible.
- [ ] **Action card auto-emit testing** — Extension upgraded to auto-emit cards on DB writes (zero extra tokens). Needs live Docker test to verify cards reach frontend. Also test `action_card` tool for proactive notifications (menu ideas, alerts).
- [ ] **Table data cards not rendering in Docker** — Changes on main but Docker needs rebuild. Tables should break out of chat bubble as standalone data cards.

## MEDIUM Priority

- [ ] **5-min delay on first message** — VectorDB init + knowledge file processing. Needs profiling or lazy loading.
- [ ] **Closing pgAdmin stops cOS streaming** — Docker network dependency investigation.
- [ ] **Tool-not-found dumps 750+ line catalog** — A0 core behavior. Wastes LLM context window. May need overlay-pattern-compatible fix.
- [ ] **Quirky loading notes while A0 thinks** — Expo should show personality while waiting.
- [ ] **Sparse seed data** — Only 5 inventory items in current DB. Migration 009 fixes this (16 items) once it runs.
- [ ] **User messages stuck together after refresh** — When two messages are sent before a response, they render stuck together on refresh.
- [ ] **Cloudflare tunnel cross-origin** — Quick tunnels work but need nginx Host header passthrough and Next.js allowedDevOrigins.

## LOW Priority

- [ ] **Welcome emoji** — Using shrimp emoji, should match CarabinerOS brand.
- [ ] **Chat naming** — Sidebar shows timestamps instead of descriptive names for some chats.
- [ ] **Named Cloudflare tunnel** — Set up persistent tunnel with custom domain.
- [ ] **Pydantic deprecation warnings** — Noisy in Docker logs. Suppress with warnings filter at startup.

## COMPLETED (2026-03-22)

### Session 6 (action cards + infrastructure)
- [x] MCP type coercion — Decimal/int/UUID from strings (asyncpg compatibility)
- [x] UUID double-wrapping fix — `_parse_uuid()` handles `UUID('...')` repr format
- [x] `action_card` tool — A0 can emit structured cards directly via Socket.IO
- [x] Tool prompt + system prompt extension teaching A0 when/how to use action cards
- [x] Module icons on cards — lucide icons matching sidebar nav (ShoppingCart, Warehouse, etc.)
- [x] Card-stack arrival animation — top-bar icon flips with type color on new card
- [x] Card list entry/exit animations — spring slide+fade in/out
- [x] Midnight Kitchen polish — glass header, stats tint, change borders, warm empty state
- [x] Card chat wired to A0 — card_message routes to agent via `AgentContext.communicate()`
- [x] Card context sent from frontend — summary/module/type/detail included in card_message
- [x] sessionStorage persistence — cards + chat threads survive page refresh, 24h auto-cleanup
- [x] Welcome message ordering fix — sort by timestamp prevents user msg above welcome
- [x] MCP DATABASE_URL fix — merged parent env into subprocess via mcp_handler.py
- [x] Codex plugin persistence — Dockerfile runs initializer at startup, token in volume-mounted usr/
- [x] chpasswd check=False — prevents container crash on startup
- [x] Action card sio hierarchy walk — subordinate agents (A1) find sio from root agent (A0)
- [x] Auto-emit extension — DB writes auto-generate action cards (zero extra tokens)
- [x] Architectural decision: two-path action cards (auto DB writes + proactive tool)

## COMPLETED (2026-03-21)

### Session 5 (first real trial)
- [x] Hydration mismatch + script tag warnings fixed (chat-composer, theme-script)
- [x] Chat conversation loading confirmed working
- [x] Full system test — 5 prompts with live Docker log monitoring
- [x] Bug report: 16 bugs identified, cross-referenced with backend logs
- [x] C1: MCP env inheritance fix (removed hardcoded DATABASE_URL from settings)
- [x] C2: Action card emission pipeline (sio injection + JSON extraction + Expo prompt)
- [x] C3: invoice_tool schema fix (Alembic migration 008: vendor→vendor_name + 5 columns)
- [x] C4: Homepage always creates fresh chat context
- [x] H2: Expo whispering streams steps in real-time
- [x] H4: ipython installed in Docker for code_execution_tool
- [x] M2: Duplicate message guard (sendingRef + 2s dedup)
- [x] Table data cards — tables render as briefing-style standalone cards
- [x] "Daily Briefing" → "Daily Brief"
- [x] Grey bar removed from expo ticket
- [x] MCP location_id auto-resolve for all create tools
- [x] Codex proxy plugin installed — GPT-5.3 brain for A0
- [x] A0 stress test: watched 27B model install PostgreSQL from scratch (27+ LLM calls)
- [x] GPT-5.3 validated: proper delegation, data-first tool calling, operator-ready output
- [x] Architectural decision: notify_user → action cards bridge pattern
- [x] Rune kit framework research — full skill catalog, cook phases, quality gates documented

### Session 4
- [x] Chat bleeding between contexts — fixed seenUserMessage initialization in use-chat.ts (welcome message bleed bug)
- [x] Chat streaming fix — ref-based seenUserMessage handles both welcome bleed and incremental snapshot streaming
- [x] System theme — app now follows OS prefers-color-scheme with 3-way toggle (system/dark/light)
- [x] "+" button creates two chats — resolved
- [x] Home page chat sends to old context — resolved
- [x] Hamburger menu doesn't close on outside click — resolved

### Session 3 (audit + hardening)
- [x] Ollama keep_alive=-1 + num_ctx optimization (settings.json)
- [x] Reduced chat context from 100K→16K, util/browser to 8K (massive speed gain)
- [x] Design system generated (.rune/design-system.md) — Midnight Kitchen palette, OKLCH tokens, UX writing, a11y audit
- [x] Full 8-phase project audit (AUDIT-REPORT.md) — score 5.5/10
- [x] fix/api-auth — enabled requires_auth on all 9 Carabiner workspace endpoints
- [x] fix/patch-cves — patched 6 critical Python CVEs (pypdf, flask, simpleeval, mcp, lxml, markdown)
- [x] fix/path-traversal — added os.path.realpath() + boundary check on file API
- [x] fix/ci-cd — GitHub Actions test.yml (pytest + pnpm lint) and build.yml (Docker)
- [x] fix/error-tracking — logger.exception() on all flask_blueprint handlers + DB health check
- [x] Removed unused deps (flask-basicauth, newspaper3k), deduped crontab
- [x] Chat streaming fix — seenUserMessage dedup bug causing responses to not render
- [x] Response streaming — in-place content updates for typing effect (use-chat.ts)
- [x] Diagnosed qwen3.5:cloud reasoning channel issue (model puts JSON in <think> tags)

## COMPLETED (2026-03-20)

### Session 1 (overnight build)
- [x] ThoughtsStream — live reasoning above ExpoBar
- [x] ExpoBar shows real headlines, jokes as fallback
- [x] ExpoBar ticket — expandable step history per response
- [x] Inline tickets on past messages with contextual titles
- [x] Kitchen role names (GM/AGM) instead of A0/A1
- [x] Markdown rendering fixed (Tailwind v4)
- [x] Duplicate response fix (agentno===0 filter)
- [x] Welcome message hidden
- [x] Context bleeding fix (socket filter)
- [x] Ticket state bleeding fix (reset on context switch)
- [x] New chat uses A0's /chat_create
- [x] Socket subscribe race condition fix
- [x] Hamburger menu across all pages
- [x] Chat delete syncs with A0 + navigates to next chat
- [x] 65 rotating prompts, 43 kitchen jokes
- [x] MCP database server (40 CRUD tools)
- [x] System prompt: direct MCP writes, no delegation, hide agent names
- [x] All tool prompts updated with MCP write instructions
- [x] MCP DB connection fix (localhost → postgres)
- [x] Inventory unit column (migration)
- [x] Worktree isolation guard (pre-edit hook)
- [x] Blank page on refresh fix
- [x] .gitignore cleanup, 48+ stale branches deleted
- [x] 12 intelligence patterns stored in ruflo

### Session 2 (demo day)
- [x] Docker services startup
- [x] Ollama model warmup (keep_alive=-1)
- [x] Cloudflare tunnel with nginx Host passthrough
- [x] asyncpg runtime install (temp fix)
- [x] Double chat creation guard (creatingChatRef)
- [x] Empty chat loading state removed
