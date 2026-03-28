# Progress

## [2026-03-28] Session 11 — Tiny Router Build + A0 Personal Instance Setup

**Completed:**
- [x] Deleted OpenClaw — processes, launchd agent, npm package, `~/.openclaw/`, Docker images (~13GB reclaimed)
- [x] Home directory audit — identified ~72GB of stale files (a0/, a0backup/, a0dev/, agent-zero/, carabiner-os.zip, .ollama, .gemini, .codex, .antigravity)
- [x] Cleaned Docker images — removed old agent0ai/agent-zero (8.25GB), stale worktree build (4.74GB), curlimages/curl
- [x] Built `a0-tiny-router` plugin — full ONNX inference pipeline using upstream `tgupj/tiny-router` (DeBERTa-v3-small, 44M params)
- [x] Extracted inference-only functions into `tiny_router_helpers/upstream.py` — no torch/datasets dependency at runtime
- [x] Downloaded INT8 ONNX model (172MB) from HuggingFace, verified 6-7ms inference inside A0 container
- [x] 20/20 tests passing (12 routing logic + 8 smoke tests with real model)
- [x] Made plugin A0-spec-compliant: renamed to `tiny_router`, `usr.plugins.*` imports, Store Gate webui, LICENSE, execute.py
- [x] Installed in personal A0 at `/Users/estebannunez/agent-zero/a0/usr/plugins/tiny_router/`
- [x] Fixed codex-proxy `created_at` bug — ChatGPT backend omits it, LiteLLM requires it
- [x] Fixed codex-proxy startup race — new `monologue_start/_05_codex_proxy_boot.py` extension starts proxy before message loop
- [x] Added debug logging to codex-proxy extension for troubleshooting
- [x] Set up content pipeline — knowledge doc for X/Threads/NotebookLM publishing workflow in A0
- [x] Extracted browser cookies (X, Threads, NotebookLM) via Chrome DevTools CDP for A0 browser agent
- [x] Tuned A0 settings for local GLM — reduced context (16K/8K), concise behaviour rules, less workdir scanning
- [x] Fixed Ollama `num_ctx` memory explosion — 65K→8K via model config kwargs
- [x] Set HF_HUB_OFFLINE=1 in supervisor to prevent VectorDB init blocking on HuggingFace timeouts
- [x] Switched A0 between codex proxy and local Ollama GLM as needed

**Key Architecture Decisions:**
- tiny-router plugin uses `usr.plugins.tiny_router.*` import path (A0 spec, no sys.path hacks)
- Inference-only extraction from upstream package avoids torch dependency (~2GB) at runtime
- Codex proxy starts at `monologue_start` (not `message_loop_start`) to prevent LiteLLM connection race
- Phase 1 tiny-router: log-only mode (classify every message, don't skip LLM) for threshold tuning
- `num_ctx` must be passed via `kwargs` in model config — A0's `ctx_length` only controls prompt size, not Ollama memory allocation

**Personal A0 Instance:**
- Container: `aefd63c40b81` at `localhost:5080`
- Volume: `/Users/estebannunez/agent-zero/a0/usr` → `/a0/usr`
- Models: codex proxy (gpt-5.3-codex chat, gpt-5.1-codex-mini utility) or local Ollama (glm-4.7-flash)
- Plugins: codex-provider (enabled), tiny_router (enabled)
- Content output: `/a0/usr/documents/content/{research,drafts,published}/`
- Browser cookies: `/a0/usr/workdir/food_autopost/{x,threads,notebooklm}_cookies.json`

**Known Issues (carried + new):**
- [ ] Welcome bleed still occasionally appears
- [ ] Main chat input doesn't auto-expand
- [ ] A0 inserts $0 instead of asking when price unknown
- [ ] `inventory_create` type coercion
- [ ] A0 unnecessarily calls `*_list` before create operations
- [ ] GLM-30B too heavy for concurrent Docker+A0+Chrome on Mac (use 8K num_ctx or switch to smaller model)
- [ ] Codex usage limits hit periodically — need graceful fallback to local LLM
- [ ] Browser agent needs vision-capable model (gpt-5.4-mini, not codex variants)

**Next Session Should:**
1. Test tiny-router live — send varied messages, review classification logs, tune thresholds
2. Content pipeline test — research a topic, draft a thread, publish to X/Threads
3. Implement Phase 2 tiny-router (actually skip LLM for canned responses)
4. Add automatic codex→local LLM fallback when rate limited
5. Full visual QA walkthrough all CarabinerOS modules on :8080
6. Fix A0 $0 price insertion — system prompt guardrail

---

## [2026-03-25] Session 10 — R&D Discovery Day + Platform Architecture

**Completed:**
- [x] AgentScope deep research — 3 parallel agents analyzed architecture, multi-agent patterns, memory/planning
- [x] tiny-router A0 plugin — complete design with 12 production-ready files, routing engine, cost model
- [x] Crucix research — graceful parallel ingestion patterns, delta engine, multi-tier alerts
- [x] TurboQuant research — edge quantization path: 4-bit weights → local LLM with KV compression
- [x] GitAgent research — agent versioning, segregation of duties, compliance-as-code patterns
- [x] last30days research — automated R&D discovery engine across 10+ sources
- [x] MarkItDown research — document intake pipeline (PDF, images, audio → markdown → A0 context)
- [x] Karpathy autoresearch — autonomous experiment loop, 3-file pattern, mesh learning
- [x] insanely-fast-whisper research — batch STT for post-service transcription
- [x] OpenClaw video analysis — heartbeat pattern, memory persistence, content system architecture
- [x] ADR-001: Fleet Learning Architecture (federated intelligence)
- [x] ADR-002: Self-Evolving Platform Architecture (6-layer loop)
- [x] Identified local model candidate: Qwen3.5-27B Claude Opus distilled GGUF
- [x] Sandbox container with AgentScope + tiny-router + A0 plugins cloned

**Key Architecture Decisions:**
- Fleet Learning: 4-layer federated intelligence (tiny-router federation, anonymous benchmarks, prompt evolution, compression templates)
- Self-Evolving Platform: 6-layer loop (discovery → fleet learning → central → GitAgent distribution → local self-update → voice-first mobile)
- Cost stack: tiny-router ($0, 10ms) → local LLM ($0, 2-3s) → API (paid, 40-50% of msgs) → fallback
- Voice-first mobile: primary input method for kitchen operators, not typing
- Document intake: MarkItDown for recipes, invoices, prep sheets → markdown → A0 context
- Heartbeat pattern (from OpenClaw): A0 should wake every 30 min for proactive maintenance

**Research Artifacts (30+ docs):**
- ADRs: `docs/adr/ADR-001-*.md`, `docs/adr/ADR-002-*.md`
- AgentScope: `.rune/analysis-*.md`, `.rune/DECISION_MATRIX.md`, `.rune/IMPLEMENTATION_GUIDE_*.md`, `docs/ORCHESTRATION_*.md`
- tiny-router: `PLUGIN_TINY_ROUTER_*.md` (6 files)
- Other: `RESEARCH_GITAGENT.md`, `GITAGENT_PATTERNS_*.md`, `MARKITDOWN_*.md`, `RESEARCH_insanely_fast_whisper.md`, `docs/research/autoresearch-*.md`

**Known Issues (carried):**
- [ ] Welcome bleed still occasionally appears
- [ ] Main chat input doesn't auto-expand
- [ ] A0 inserts $0 instead of asking when price unknown
- [ ] `inventory_create` type coercion
- [ ] A0 unnecessarily calls `*_list` before create operations

**Next Session Should:**
1. Set up automated R&D discovery pipeline (last30days-style, scheduled) before starting CarabinerOS work
2. Full visual QA walkthrough all modules on :8080
3. Fix A0 $0 price insertion — system prompt guardrail
4. Fix main chat textarea auto-expand
5. Daily Brief — A0 scheduled task replacing hardcoded insights
6. Start tiny-router A0 plugin MVP (Phase 1)

---

## [2026-03-25] Session 10 — Strategic Decision: Fleet Learning Architecture

**Decision recorded:** ADR-001 — Fleet Learning Architecture (Federated Intelligence Across CarabinerOS Deployments)

**Summary:** Approved a 4-layer federated intelligence system that makes the entire CarabinerOS fleet smarter without centralizing sensitive restaurant data.

- **Layer 1** — Tiny-router federated training: anonymized classification corrections retrain the ONNX router weekly; every restaurant's corrections benefit the whole fleet
- **Layer 2** — Anonymous pattern intelligence (Waze model): opt-in operational benchmarks, fleet aggregates returned as "restaurants like yours average X"
- **Layer 3** — Prompt and extension evolution: winning A0 prompt patterns and self-built plugins spread across the fleet automatically
- **Layer 4** — Memory compression templates: per-restaurant-type compression schemas learned from fleet usage patterns

**Privacy architecture:** Raw data never leaves the deployment. Only anonymized, opt-in signals export. Differential privacy on all aggregates. Per-category kill switch for restaurants.

**Strategic significance:** This is the structural competitive moat — a new competitor starts with zero restaurant training data. CarabinerOS compounds with every deployment. Described internally as "Tesla Autopilot for restaurants."

**Build order:** Layer 1 first (telemetry pipeline + tiny-router federation). Establishes infrastructure that all other layers depend on.

**Status:** Approved — post-MVP. Begins when multi-tenant deployment starts.

**Artifacts:**
- `docs/adr/ADR-001-fleet-learning-federated-intelligence.md` — full ADR
- `.rune/decisions.md` — summary entry added

---

## [2026-03-25] Session 9b Summary — "Make It Nice" Pass + Mini-Chat Architecture

**Completed:**
- [x] Persistent TopBar — CarabinerOS branding, action cards, settings, theme toggle on every page via Shell
- [x] Poker-hand card icon — subtle spread on hover, sized to match Settings/ThemeToggle icons
- [x] Persistent module chat contexts — `moduleId` + localStorage, conversations survive navigation/refresh
- [x] Inventory count click-through modal — centered Dialog with top 5 chart, line items table, inline ModuleChat
- [x] Dialog component — new shadcn/ui Dialog built on Radix primitives (centered overlay, fade+scale)
- [x] Floating point fix — all inventory numbers rounded to 1 decimal, no Wall Street artifacts
- [x] Mini-chat send-then-subscribe — fixes race condition where subscription state_push wiped messages
- [x] Mini-chat expo whisper — shows A0 progress ("orders update", "Thinking...") instead of static "Working..."
- [x] Mini-chat auto-refresh — `onMessageSent` callback fires when A0 finishes (loading→false), order detail refetches
- [x] Lean context piggybacking — just `[module=orders, order_id=UUID]`, A0 reads DB for details (saves tokens)
- [x] Welcome bleed filter — both mini-chat and main chat `message-list.tsx` now strip A0 greetings before first user message
- [x] Hospitality pass (all 9 modules) — warm error states, inviting empty states, helpful filtered-empty states
- [x] Design token compliance — zero `rounded-2xl`, all `p-4`, `gap-4`, `font-mono` on every number/price/date/%
- [x] 5% delight — rotating chef tips in empty states, prep "All set" completion pulse, delivered order badge animation, "On track"/"Nice week" KPI whispers
- [x] Removed duplicate MenuButton from all 9 module headers (TopBar provides it)
- [x] All module pages h-dvh → h-full for Shell flex layout
- [x] Count detail API endpoint — `GET /api/inventory/counts/<id>` with eager-loaded lines + item names

**Key Architecture Decisions:**
- TopBar lives in Shell (persistent across all pages), not per-page
- ModuleChat uses localStorage map `carabiner:module-chat-contexts` keyed by moduleId for persistent conversations
- Mini-chat sends message THEN subscribes (avoids race with state_push clearing messages)
- Context piggybacking is lean — just module + record ID, A0 queries DB for full details
- `onMessageSent` fires on loading→false transition (not fixed timer) so refresh waits for A0 to actually finish

**Known Issues (to fix):**
- [ ] Welcome bleed still occasionally appears (timing-dependent on subscription restore)
- [ ] Main chat input doesn't auto-expand for long text (textarea auto-resize needed)
- [ ] A0 inserts $0 instead of asking when price unknown (system prompt guardrail needed)
- [ ] `inventory_create` type coercion — A0 passes int for VARCHAR columns
- [ ] A0 unnecessarily calls `*_list` before create operations
- [ ] Card module badge shows "GENERAL" — notify_user `group` field not set by A0

**Next Session Should:**
1. Full visual QA walkthrough all modules on :8080
2. Fix A0 $0 price insertion — system prompt: "If you don't have a value, ask the user"
3. Fix main chat textarea auto-expand
4. Daily Brief — A0 scheduled task replacing hardcoded insights
5. Settings/integrations page skeleton
6. Start Google Suite MCP (first integration)

## [2026-03-25] Session 9 Summary — Action Cards End-to-End Fix

**Completed:**
- [x] Debugged action card delivery — root cause: `snapshot.notifications` never consumed by frontend (data arriving, thrown on floor)
- [x] Collapsed expo subordinate into A0 direct `notify_user` calls — saves ~800-1000 tokens per notification
- [x] Updated `_25_restaurant_context.py` — A0 calls `notify_user` directly, no more `call_subordinate(profile="expo")`
- [x] Expanded `A0Notification` type to match backend `NotificationItem.output()` (title, detail, priority, display_time, etc.)
- [x] `useSocket` now extracts `snapshot.notifications` from `state_push` events
- [x] `useActionCards` converts `A0Notification[]` → `ActionCard[]` with type mapping (success→update, warning→urgent, etc.)
- [x] Wired notifications through `SocketProvider` context → `Shell` → `useActionCards`
- [x] Slimmed ALL MCP `*_list` responses — `_slim()` strips 13 heavy JSONB/Text columns (line_items, detail_points, summary, etc.)
- [x] `orders_list` token reduction: 3,103 → ~400-500 tokens (6 orders)
- [x] Disabled auto-emit extension primary path to prevent duplicate cards (notify_user + auto-emit were both creating cards)
- [x] Fixed card UI: removed `aspect-[4/5]` gap, hidden Sheet close button (duplicate X), cleaned card animations
- [x] Rewrote notification panel animations — removed `layoutId`/`LayoutGroup` conflicts, clean spring enter/exit
- [x] Verified end-to-end: user prompt → A0 DB write → A0 calls `notify_user` → `state_push` → frontend card appears
- [x] Expo prompt updated to use `notify_user` tool (kept for scheduled proactive sweeps)

**Key Architecture Decisions:**
- A0 calls `notify_user` directly after DB writes (no subordinate delegation)
- Notifications flow via existing `state_push` → `snapshot.notifications` (same pipe as chat streaming)
- MCP `*_list` tools return summary-only fields; `*_get` returns full objects
- Auto-emit extension disabled (A0 direct notification is the single path)

**Known Issues (to fix):**
- [ ] `inventory_create` type coercion — A0 passes int for VARCHAR columns, requires retry (MCP layer should coerce)
- [ ] A0 unnecessarily calls `*_list` before create operations (e.g., lists all 48 inventory items before adding 1)
- [ ] Token cost still high (~$600/mo estimate for real restaurant scale) — needs RAG/pagination/smarter tool selection
- [ ] Card module badge shows "GENERAL" — notify_user `group` field not set by A0, needs prompt guidance
- [ ] Record IDs visible in card detail text — A0 should not include UUIDs in user-facing notifications

**Still Open (carried):**
- [ ] Migration 009 not yet run
- [ ] Full walkthrough all 8 modules — visual QA
- [ ] Wire ModuleChat into remaining 7 modules
- [ ] Apply "Make It Nice" to empty states, loading, errors
- [ ] Daily Brief — A0 scheduled task
- [ ] Settings/integrations page skeleton

**Next Session Should:**
1. Fix A0 unnecessary `*_list` calls before creates — update system prompt to say "don't list before creating"
2. Fix `inventory_create` type coercion in MCP layer (auto-cast int→str for VARCHAR columns)
3. Add `group` field guidance to A0 prompt so cards show correct module badge
4. Strip UUIDs from A0 `notify_user` detail text via prompt guidance
5. Token cost reduction: pagination on `*_list`, or RAG-based tool selection
6. Visual QA all 8 modules on :8080

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

## [2026-03-24] Session 8b — Full Module Build + Infrastructure Fixes

**Completed:**
- [x] 8 research agents — competitive analysis for all core modules
- [x] All 8 plans chef-reviewed — chat-first pattern, real-world references (Roister budget, Kama prep lists, mepai-capture editor)
- [x] 8 build agents in parallel — all modules built to P0 spec, merged, conflicts resolved
- [x] DB migrations for all new columns/tables (menu, inventory, invoices, marketing, prep)
- [x] Functional seed: menu pricing, inventory categories, 30 days food cost/P&L, budget, par levels, waste, price alerts, vendors
- [x] Order total auto-calc from line items (frontend)
- [x] ModuleChat component — reusable inline chat with context piggybacking
- [x] Mini-chat streaming fix — subscribe to new context after createNewChat()
- [x] Order refresh fix — re-fetch 3s after chat message
- [x] Action cards delivery fix — initStateSyncSocket() (session 6 bug resolved!)
- [x] Docker .dockerignore fix — excludes frontend/, rune-business/, rune-pro/, docs/, .claude/
- [x] "Make It Nice" philosophy research — docs/research/make-it-nice-hospitality-philosophy-2026-03.md
- [x] Integration architecture + self-extending plugin system documented
- [x] flask_blueprint.py syntax fix

**Next Session Should:**
1. Full walkthrough all 8 modules on :8080 — visual QA
2. Wire ModuleChat into remaining 7 modules (currently only Orders)
3. Test action cards in notification panel (session 6 bug should be fixed)
4. Apply "Make It Nice" to empty states, loading, errors
5. Daily Brief — A0 scheduled task replacing hardcoded insights
6. Settings/integrations page skeleton
