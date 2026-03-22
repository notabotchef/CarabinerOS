# Progress

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
