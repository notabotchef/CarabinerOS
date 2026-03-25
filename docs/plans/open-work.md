# CarabinerOS — Open Work Items

Updated: 2026-03-24 (session 8)

## CRITICAL (Blocks core functionality)

- [x] ~~**MCP DATABASE_URL in Docker**~~ — Fixed: merged parent env into MCP subprocess via `mcp_handler.py`.
- [x] ~~**Bake Codex patch into Dockerfile**~~ — Fixed: Dockerfile.agent-zero runs `initialize.py` at container startup.
- [ ] **Run migration 009** — "cOS Test Kitchen" single-location consolidation. Migration file committed, fixed for asyncpg ARRAY(TEXT) format.
- [ ] **Action cards not reaching frontend** — Auto-emit extension fires server-side but cards don't appear in notification panel. Needs live debugging (Socket.IO namespace, tool_name prefix, or frontend listener issue).

## HIGH Priority (Demo Blockers)

- [x] ~~**UI/UX design refresh**~~ — Polaroid tactile cards, CarabinerOS design language applied to expanded cards, sidebar unified scroll. Google Stitch explored for design generation.
- [ ] **Daily Ops Briefing ("The Matrix")** — The #1 chef pain point (validated by Chef Danny feedback, 2026-03-24). A single daily dashboard/action-card that A0 generates each morning combining: (1) today's covers from reservations, (2) staff scheduled vs needed, (3) inventory check — what's low, what's overstocked, (4) revenue target per table given labor cost, (5) what to push today based on day-of-week sales patterns (e.g. steaks sell better on Saturdays, seafood on Fridays, 5pm crowd = burgers & salads), (6) wine/beverage push recommendations. This is the admin brain a solo chef doesn't have time to be. Could start as an A0 morning prompt that generates a briefing action card, then evolve into a dedicated dashboard page.
- [ ] **Smart Ordering Assistant** — Chef feedback: staff over-orders when panicking. A0 should cross-reference current inventory levels + upcoming covers + par levels + recent usage rates and either (a) flag over-orders before they go out, or (b) generate the order itself. Requires: inventory module with real data, reservation/covers data (OpenTable or manual), par level config per item.
- [ ] **Labor-to-Covers Intelligence** — When staff calls out sick or 30 reservations cancel, A0 should immediately recalculate: adjusted revenue target, menu push strategy, whether to call someone in or send someone home. Requires: labor schedule data (7shifts or manual), reservation feed, historical covers-to-revenue ratios.
- [ ] **Day-of-Week Sales Patterns** — Historical analysis: which proteins/categories sell best on which days, by daypart (lunch vs 5pm early bird vs 8pm dinner). A0 uses this to inform daily push recommendations and ordering. Requires: order history with timestamps, menu item categorization.
- [ ] **FOH Seating Intelligence** — Chef Danny feedback: FOH needs help setting up seating for the day — giving people enough time to eat, where to put VIPs in the dining room, predicting patterns of diners. A0 cross-references reservation times, party sizes, VIP flags, table turn targets, and historical dwell times to generate a seating plan. Pairs with OpenTable/Resy integration.
- [ ] **Expiring Inventory Alerts + "Home Dishes"** — A0 monitors shelf life / use-by dates and proactively sends action cards: (1) produce about to expire, (2) "home dishes ideas" — specials or family meal suggestions based on what needs to move. Prevents waste, creates value from surplus.
- [ ] **Third-party integrations architecture** — OAuth-based MCP servers for Toast, OpenTable, Square, Google Suite. Architecture doc written (`docs/plans/integration-architecture.md`). Needs: DB migration for `restaurant_integrations` table, OAuth callback routes, settings/integrations page, first MCP (Google or Square).
- [ ] **Functional module pages** — Orders, Inventory, Prep, Menu, Recipes, Invoices, Marketing, Reporting pages need real CRUD functionality. Menu page has live data + performance badges. Reporting has live charts. Others still need work.
- [ ] **Soft delete for orders** — A0 should set `deleted=true` instead of hard delete. Auto-purge after 30 days.
- [ ] **Daily Brief is hardcoded** — `home-view.tsx` has 3 static fake insights (Coastal Produce delivery, food cost 28.4%, Friday reservations). Should be a scheduled A0 task that runs at startup/morning, queries real data (DailyFoodCost, orders, inventory below par, prep status), and generates the briefing. Frontend reads live data instead of the `INSIGHTS` array. Ideally an A0 scheduled task that feeds action cards.
- [ ] **Expo filtering** — MCP tool calls invisible, "Calling LLM..." leaks through, raw tool names need kitchen-language mapping.
- [ ] **Action card auto-emit testing** — Extension upgraded but needs live Docker test to verify end-to-end.
- [ ] **A0 calls call_subordinate for card formatting** — System prompt should tell it the auto-emit extension handles this.
- [ ] **Docker image bloat** — agent-zero image is 15GB. `.dockerignore` missing `frontend/`, `rune-business/`, `rune-pro/`, `docs/`, `.claude/`. Should cut to ~2-3GB.

## MEDIUM Priority

- [ ] **5-min delay on first message** — VectorDB init + knowledge file processing. Needs profiling or lazy loading.
- [ ] **Closing pgAdmin stops cOS streaming** — Docker network dependency.
- [ ] **Tool-not-found dumps 750+ line catalog** — Wastes LLM context window.
- [ ] **Sparse seed data** — Migration 009 adds more. Also now have a realistic 1-month tapas restaurant seed script.
- [ ] **User messages stuck together after refresh** — Two messages sent before response render stuck.
- [ ] **Cloudflare tunnel cross-origin** — Needs nginx Host header passthrough and Next.js allowedDevOrigins.
- [ ] **Onboarding/setup flow** — New accounts need a setup wizard: connect tools (Toast, Google, OpenTable), set location, configure modules.

## LOW Priority

- [ ] **Welcome emoji** — Using shrimp emoji, should match CarabinerOS brand.
- [ ] **Chat naming** — Sidebar shows timestamps instead of descriptive names.
- [ ] **Named Cloudflare tunnel** — Persistent tunnel with custom domain.
- [ ] **Pydantic deprecation warnings** — Noisy in Docker logs.

## FUTURE — Integration Roadmap

### Phase 1 — No approval gates (build now)
- [ ] Google Suite MCP (Gmail + Drive + Calendar + Sheets)
- [ ] Square MCP (orders + menu + inventory + invoices + labor)
- [ ] 7shifts MCP (labor cost, schedules, timecards)
- [ ] Clover MCP (POS for SMB restaurants)

### Phase 2 — Apply now, build after approval
- [ ] Toast MCP (daily sales, product mix, labor — apply to partner program)
- [ ] OpenTable MCP (reservations, covers, guest notes — apply for partnership)

### Phase 3 — Strategic
- [ ] DoorDash MCP (delivery dispatch)
- [ ] Uber Eats MCP (delivery marketplace)
- [ ] Lightspeed MCP (POS, strong in Canada/Europe)

## COMPLETED (2026-03-24)

### Session 8 (UI polish + integration research)
- [x] Polaroid tactile card redesign — rounded-[13px], shadow depth, module pill badges, aspect ratio cards
- [x] Expanded card redesign — matched CarabinerOS design language (glass input, gradient buttons, no monospace)
- [x] Send button consistency — gradient ArrowUp matching chatbot composer on both card views
- [x] Card bottom spacing fix — removed aspect-[4/5] that caused empty space
- [x] Sidebar unified scroll — modules + conversations scroll as one unit (not two separate sections)
- [x] Menu page runtime fix — guard against undefined performance values in PERF_CFG lookup
- [x] Integration architecture research — 15 platforms evaluated (APIs, auth, sandbox, costs, legal)
- [x] Integration architecture doc — OAuth flow, token storage, MCP server pattern, build order
- [x] Google Stitch explored — used for Polaroid Tactile action card design mockup

### Session 7.5 (data + reporting)
- [x] Realistic seed script — 1-month tapas restaurant data (orders, inventory, invoices, etc.)
- [x] 27 menu items seeded as Modernist format workspace recipes
- [x] Reporting page — live data wiring + Recharts revenue charts
- [x] Reporting design — single hero chart with tab switcher per design-system spec
- [x] Theme-aware charts + today date fallback

## COMPLETED (2026-03-22)

### Session 7 (action cards UI overhaul)
- [x] Action cards UI audit — user tested with 6 fake cards, filed 10 issues with screenshots
- [x] Phase 1: Foundation fixes — badge z-index + type color, scroll overflow, button overlap
- [x] Phase 2: Solitaire card redesign — KDS aesthetic, 2-col grid, flip expand, action buttons, chat pre-fill, quick-action chips, completed cards section

### Session 6 (action cards + infrastructure)
- [x] MCP type coercion — Decimal/int/UUID from strings (asyncpg compatibility)
- [x] UUID double-wrapping fix — `_parse_uuid()` handles `UUID('...')` repr format
- [x] `action_card` tool — A0 can emit structured cards directly via Socket.IO
- [x] Tool prompt + system prompt extension teaching A0 when/how to use action cards
- [x] Module icons on cards — lucide icons matching sidebar nav
- [x] Card-stack arrival animation — top-bar icon flips with type color
- [x] Card list entry/exit animations — spring slide+fade
- [x] Midnight Kitchen polish — glass header, stats tint, change borders, warm empty state
- [x] Card chat wired to A0 — card_message routes to agent via `AgentContext.communicate()`
- [x] Card context sent from frontend — summary/module/type/detail in card_message
- [x] sessionStorage persistence — cards + chat threads survive page refresh, 24h auto-cleanup
- [x] Welcome message ordering fix — sort by timestamp
- [x] MCP DATABASE_URL fix — merged parent env into subprocess
- [x] Codex plugin persistence — Dockerfile runs initializer at startup
- [x] chpasswd check=False — prevents container crash
- [x] Action card sio hierarchy walk — subordinates find sio from root agent
- [x] Auto-emit extension — DB writes auto-generate cards (zero extra tokens)

## COMPLETED (2026-03-21)

### Session 5 (first real trial)
- [x] Hydration mismatch + script tag warnings fixed
- [x] Full system test — 5 prompts with live Docker log monitoring
- [x] Bug report: 16 bugs identified, cross-referenced with backend logs
- [x] C1-C4, H2, H4, M2 fixes (MCP env, action cards, invoice schema, fresh chat, whispering, ipython, dedup)
- [x] Table data cards — tables render as briefing-style standalone cards
- [x] MCP location_id auto-resolve for all create tools
- [x] Codex proxy plugin — GPT-5.3 brain for A0
- [x] Architectural decisions: notify_user → action cards bridge, two-path card architecture

### Session 4
- [x] Chat bleeding fix, system theme 3-way toggle, "+" button fix, hamburger close fix

### Session 3 (audit + hardening)
- [x] Ollama optimization, design system, 8-phase audit (5.5/10), auth/CVE/path-traversal fixes, CI/CD, error tracking

### Sessions 1-2 (overnight build + demo day)
- [x] Full frontend: ThoughtsStream, ExpoBar, ExpoTicket, chat system, sidebar, routing
- [x] MCP database server (40 CRUD tools), system prompts, tool prompts
- [x] Docker services, Ollama warmup, Cloudflare tunnel, streaming fixes
