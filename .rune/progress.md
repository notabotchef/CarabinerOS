# Progress

## [2026-03-24] Session 8 Summary — UI Polish + Integration Architecture

**Completed:**
- [x] Polaroid tactile card redesign — `rounded-[13px]`, shadow depth, module pill badges, no left-border KDS style
- [x] Card bottom spacing fix — removed `aspect-[4/5]` causing empty space below content
- [x] Send button consistency — gradient `ArrowUp` matching chatbot composer on collapsed cards
- [x] Expanded card redesign — matched CarabinerOS design language: glass input, gradient buttons, ChevronLeft back, no monospace
- [x] Sidebar unified scroll — moved `overflow-y-auto` to single wrapper around modules + conversations
- [x] Menu page runtime fix — guarded `PERF_CFG[performance]` with `?? PERF_CFG.Dog` fallback
- [x] Integration research — 15 restaurant platforms evaluated (Toast, OpenTable, Square, Google, 7shifts, Clover, DoorDash, Uber Eats, etc.)
- [x] Integration architecture doc — `docs/plans/integration-architecture.md`: OAuth flow, encrypted token storage, MCP server pattern, build order, legal considerations
- [x] Google Stitch explored — used for Polaroid Tactile action card design mockup, fetched via MCP
- [x] Roadmap refresh — `docs/plans/open-work.md` updated with all session 8 work + integration roadmap

**Key Architecture Decision:**
- Third-party integrations use OAuth-based MCP servers (one per platform)
- `restaurant_integrations` table stores AES-256 encrypted tokens per location per platform
- Build order: Google Suite → Square → 7shifts → Toast (after partner approval) → OpenTable
- Browser automation viable for dev/demos; official APIs for production
- Settings/integrations page needed for "Connect your Toast" onboarding flow

**Open Bug (carried from session 6):**
- [ ] Action cards not reaching frontend from A0 — auto-emit extension fires server-side but cards don't appear
- [ ] A0 still calls `call_subordinate` for card formatting — system prompt should tell it the extension handles this

**Still Open:**
- [ ] Migration 009 not yet run
- [ ] Expo filtering not started
- [ ] Docker image bloat (15GB) — needs .dockerignore additions

**Next Session Should:**
1. Fix Docker image bloat — add `frontend/`, `rune-business/`, `rune-pro/`, `docs/`, `.claude/` to `.dockerignore`
2. Debug action card frontend delivery — the original open bug from session 6
3. Start `restaurant_integrations` DB migration
4. Build settings/integrations page skeleton
5. Start Google Suite MCP (first integration — zero approval gate)
6. Run migration 009

## [2026-03-22 03:45] Session 6 Summary — Action Cards Infrastructure + Critical Fixes

**Completed:**
- [x] MCP type coercion — Decimal/int/UUID from strings (generic column inspection)
- [x] UUID double-wrapping fix — `_parse_uuid()` handles `UUID('...')` repr format
- [x] `action_card` tool — LLM-driven structured card emission via Socket.IO
- [x] Tool prompt (`agent.system.tool.action_card.md`) + system prompt extension
- [x] Module icons on cards — lucide icons matching sidebar nav
- [x] Card-stack arrival animation — top-bar icon flips with type color
- [x] Card list entry/exit animations (spring slide+fade)
- [x] Midnight Kitchen polish — glass header, stats tint, change borders, warm empty state
- [x] Card chat wired to A0 — `AgentContext.communicate()` with 30s timeout
- [x] Card context sent from frontend in card_message events
- [x] sessionStorage persistence — cards + threads survive refresh, 24h auto-cleanup
- [x] Welcome message ordering fix — timestamp sort
- [x] MCP DATABASE_URL fix — merged `os.environ` into subprocess env
- [x] Codex plugin startup persistence — Dockerfile runs initializer at CMD
- [x] chpasswd `check=False` — prevents container crash
- [x] Action card sio hierarchy walk — subordinates find sio from root agent
- [x] Auto-emit extension — DB writes auto-generate cards (zero tokens)

**Open Bug (not yet fixed):**
- [ ] Action cards not reaching frontend — auto-emit extension fires (new version confirmed in container), sio emit may succeed server-side but cards don't appear in notification panel. Possible issues: (a) extension logger output suppressed by A0 runtime, (b) sio.emit succeeds but frontend Socket.IO not connected to right namespace, (c) tool_name kwarg doesn't include `carabiner_db.` prefix. Needs live debugging with console logging.
- [ ] A0 still calls `call_subordinate` for card formatting after DB writes — system prompt should tell it the extension handles this automatically

**In Progress:**
- [ ] Migration 009 not yet run
- [ ] Expo filtering not started

## [2026-03-22 06:40] Session 7 Summary — Action Cards UI Overhaul

**Completed:**
- [x] Action cards UI audit — user tested with 6 fake cards, filed 10 issues with screenshots
- [x] Phase 1: Foundation fixes — badge z-index + type color, scroll overflow, button overlap (Agent A)
- [x] Phase 2: Solitaire card redesign — KDS aesthetic, 2-col grid, flip expand, action buttons, chat pre-fill, quick-action chips, completed cards section (Agent B)
- [x] Merged both agent branches to main, resolved conflicts (rewrite wins over patch)
- [x] Neural memory capture — 5 learnings saved (design, animation, merge strategy, chat UX, rune:team bug)

**Open Bug (carried from session 6):**
- [ ] Action cards not reaching frontend from A0 — auto-emit extension fires server-side but cards don't appear. Needs live debugging.
- [ ] A0 still calls `call_subordinate` for card formatting — system prompt should tell it the extension handles this

**In Progress (carried from session 6):**
- [ ] Migration 009 not yet run
- [ ] Expo filtering not started

**Next Session Should:**
1. Test the new solitaire card UI — load fake cards, verify 2-col grid, flip animation, action buttons, chat chips, completed section
2. Fix `bg-current/[0.08]` on action button if it doesn't render visually
3. Debug action card frontend delivery — the original open bug from session 6
4. Explore Google Stitch for UI generation
5. Consider soft delete for orders (deleted=true, 30-day auto-purge)
6. Run migration 009
