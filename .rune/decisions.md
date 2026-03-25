# Decisions Log

## [2026-03-25] Decision: Self-Evolving Platform Architecture (ADR-002)

**Context:** CarabinerOS needs to continuously improve itself — discovering new techniques, learning from all deployments, distributing improvements — without manual intervention. Session 10 R&D surfaced 10 projects that form a complete self-evolving loop.
**Decision:** 6-layer self-evolving platform: (1) Automated discovery via last30days-style scanning, (2) Fleet learning from all restaurants, (3) Central intelligence evaluation, (4) GitAgent-style versioned distribution, (5) Local self-update via compressed LLM (no API cost), (6) Voice-first mobile interface.
**Rationale:** Compound competitive advantage. Day 1: good restaurant tool. Day 365: learned from hundreds of restaurants, knows every kitchen dialect. The moat is accumulated intelligence, not code.
**Impact:** Every feature should include telemetry hooks. Every A0 prompt change should be git-versioned. Voice input is the default assumption for mobile. Full spec: `docs/adr/ADR-002-self-evolving-platform-architecture.md`

## [2026-03-25] Decision: Message Cost Stack (tiny-router + local LLM + API)

**Context:** API costs estimated at ~$600/mo at scale. Need to reduce without sacrificing quality.
**Decision:** 4-tier cost stack: (1) tiny-router DeBERTa classifier ($0, 10ms) skips "thanks"/"ok"/closures entirely, (2) Qwen3.5-27B local via llama.cpp ($0, 2-3s) handles low-urgency actions, (3) Codex Proxy (paid) for complex reasoning, (4) LLM Fallback plugin for backup. Target: 50-60% of messages at $0.
**Rationale:** tiny-router classifies before LLM call. Local model handles cheap tier. API only for what needs it. Combined with memory compression (40-60% token savings), total cost reduction could be 60-70%.
**Impact:** tiny-router A0 plugin (designed, ready to build), local model setup (Qwen3.5-27B GGUF via llama.cpp), LLM Fallback plugin (already built).

## [2026-03-25] Decision: Fleet Learning — Federated Intelligence Architecture (ADR-001)

**Context:** Each CarabinerOS deployment holds sensitive restaurant data (costs, recipes, vendors, staff). As the fleet grows the question is how to make all deployments smarter without centralizing that data.
**Decision:** 4-layer federated intelligence system. Layer 1: tiny-router federated training (anonymized classification corrections retraining the ONNX router weekly). Layer 2: anonymous pattern benchmarks (Waze model — opt-in operational metrics, aggregated fleet insights in return). Layer 3: prompt and plugin evolution (spread winning A0 prompt patterns and self-built integrations across fleet). Layer 4: memory compression templates (per-restaurant-type compression schemas learned from fleet usage).
**Privacy boundary:** Raw text, dollar amounts, vendor names, recipes, staff names never leave the deployment. Only anonymized, opt-in signals export. Differential privacy on all aggregates. Per-category kill switch in restaurant dashboard.
**Rationale:** Tesla Autopilot model for restaurants. Each kitchen operates independently; the fleet gets smarter together. A new competitor starts with zero restaurant training data. This is the fundamental structural moat — it compounds with every deployment that joins.
**Impact:** Requires (1) telemetry/export pipeline per deployment, (2) central model registry + aggregation service, (3) privacy-preserving anonymization layer, (4) plugin validation/distribution system. Build order: Layer 1 (tiny-router federation) first — simplest, highest immediate ROI, establishes telemetry infrastructure for all other layers.
**Status:** Approved — post-MVP, begins when multi-tenant deployment starts. Full spec: `docs/adr/ADR-001-fleet-learning-federated-intelligence.md`

## [2026-03-25] Decision: Persistent TopBar in Shell, not per-page

**Context:** Module pages each rendered their own headers with MenuButton. TopBar (branding, action cards, settings) only appeared on home and chat pages. User wanted consistent top bar everywhere.
**Decision:** TopBar + NotificationPanel live in Shell component. Removed duplicate TopBar from home/chat pages and MenuButton from all 9 module headers.
**Rationale:** Single source of truth for navigation chrome. Modules focus on content, Shell handles chrome.
**Impact:** `shell.tsx` (owns TopBar + action cards), `page.tsx`, `chat/[contextId]/page.tsx`, all 9 module pages.

## [2026-03-25] Decision: Lean context piggybacking (just record ID)

**Context:** ModuleChat was sending ALL order details in brackets — vendor, status, total, every line item name+qty. Burned tokens on context A0 already has in the DB.
**Decision:** Context piggybacking sends only `[module=orders, order_id=UUID]`. A0 reads full details from DB via MCP tools.
**Rationale:** A0 has DB access. Sending data it can query is pure waste. Same principle applied to inventory count modal.
**Impact:** `order-detail-panel.tsx`, `count-detail-panel.tsx`. Significant token savings per mini-chat message.

## [2026-03-25] Decision: Mini-chat send-then-subscribe flow

**Context:** ModuleChat called `createNewChat()` → `subscribe()` → `sendMessage()`. The subscription triggered a `state_push` that raced with the message send, clearing messages or attaching to wrong context.
**Decision:** Reorder to: `createNewChat()` → `sendMessage()` → `subscribe()`. Message goes out first (createNewChat already sets contextIdRef), then subscribe to receive the streaming response.
**Rationale:** `subscribe()` triggers server-side state_push which can wipe local state via context-switch detection. Sending first ensures the message reaches the correct context before any subscription side effects.
**Impact:** `module-chat.tsx` doSend function.

## [2026-03-25] Decision: A0 direct notify_user (no expo subordinate)

**Context:** Expo subordinate agent added ~800-1000 tokens per notification for a second LLM call that just reformatted data A0 already had. Expo also failed on first try (passed unsupported `priority` field), wasting another ~300 tokens.
**Decision:** A0 calls `notify_user` directly after DB writes. No subordinate delegation for reactive notifications. Expo agent kept for scheduled proactive sweeps only.
**Rationale:** A0 has all the context — vendor name, item counts, deadline. Spawning a subordinate to reformat is pure overhead. The notify_user tool is simple (title, message, detail, type). A0 can assess urgency inline.
**Impact:** `usr/extensions/system_prompt/_25_restaurant_context.py` (prompt change), `usr/extensions/tool_execute_after/_30_action_card_emit.py` (auto-emit disabled). Frontend unchanged — consumes `snapshot.notifications` from `state_push`.

## [2026-03-25] Decision: Slim MCP list responses

**Context:** `orders_list` returned 3,103 tokens for 6 orders (full line_items JSONB, detail_points, summary, prompt). A real restaurant with 50+ orders would cost thousands in tokens monthly. `inventory_list` was even worse: 10,219 tokens for 48 items.
**Decision:** All `*_list` MCP tools strip 13 heavy columns (line_items, detail_points, prompt, summary, extracted_data, gl_codes, media_urls, components, steps, ingredients, notes, equipment, tags, events). `*_get` tools return full objects.
**Rationale:** LLM only needs summary fields to decide what to do. Full detail is fetched on demand via `*_get`. This is a 75-85% token reduction on list calls.
**Impact:** `carabiner/mcp/server.py` — `_slim()` helper applied to 13 list endpoints. No model or repository changes.

## [2026-03-25] Decision: Notifications via state_push (not separate Socket.IO events)

**Context:** Action cards were delivered via direct `sio.emit("action_card")` on `/state_sync` — but CSRF cookie validation was rejecting CarabinerOS's socket connections. Chat streaming worked because it uses the same `state_push` mechanism.
**Decision:** Notifications flow through the existing `state_push` → `snapshot.notifications` pipeline. Frontend reads notifications from the same events that deliver chat. No new socket events, no new handshakes.
**Rationale:** The pipe already works (chat proves it). Adding a second delivery mechanism (direct `action_card` emit) introduced CSRF issues and duplicate cards. Single path = simple path.
**Impact:** `frontend/src/hooks/use-action-cards.ts` (consumes `snapshot.notifications`), `frontend/src/hooks/use-socket.ts` (exposes notifications), `frontend/src/components/socket-provider.tsx` (context). Auto-emit extension disabled.

## [2026-03-24] Decision: Self-extending plugin architecture

**Context:** CarabinerOS needs integrations with Toast, OpenTable, Square, Google, 7shifts, etc. Building each one manually doesn't scale. A0 can already write code at runtime.
**Decision:** A0 creates integrations autonomously by writing MCP servers + manifest files to `usr/plugins/`. The frontend dynamically discovers and renders plugin data via a generic PluginWidget — zero React code per integration. Manifests define UI presence, auth config, and natural language routing.
**Rationale:** This makes CarabinerOS a self-extending platform. Traditional SaaS: feature request → 6 weeks. CarabinerOS: user request → A0 builds overnight → live tomorrow. The competitive moat is the ability to build ANY integration on demand.
**Impact:** `docs/plans/self-extending-architecture.md` (full spec), `docs/plans/integration-architecture.md` (OAuth/token details). Build order: manifest schema → plugin discovery API → generic widget → settings page → MCP scaffolding tool → overnight agent.
**Constraints:** A0 can only write to `usr/plugins/`. Cannot modify frontend, domain code, core, auth, or database schema without approval.

## [2026-03-21 16:00] Decision: Use remark-gfm for markdown table rendering

**Context:** CarabinerOS chat rendered markdown tables as raw pipe-delimited text instead of formatted HTML tables
**Decision:** Added remark-gfm plugin to ReactMarkdown and CSS table styles using existing theme variables
**Rationale:** GFM tables are not standard markdown — require remark-gfm plugin. CSS-only approach keeps it simple.
**Impact:** frontend/src/components/message-list.tsx, frontend/src/app/globals.css

## [2026-03-21 16:30] Decision: Use relative venv path for MCP config

**Context:** MCP carabiner_db command used absolute path to venv python, breaking portability across machines and Docker
**Decision:** Changed to `.venv/bin/python` (relative) in usr/settings.json, added settings.local.json pattern for overrides
**Rationale:** Docker uses `python` (system), local dev uses `.venv/bin/python`. Relative path works for local dev; Docker overrides via its own config.
**Impact:** usr/settings.json, .gitignore, usr/settings.local.json.example

## [2026-03-21 17:00] Decision: Unpinned litellm/openai/starlette in requirements.txt

**Context:** requirements.txt had `>=` floor pins that conflicted with exact pins in requirements2.txt (used by Docker)
**Decision:** Use unpinned entries (just package name) so requirements2.txt wins in Docker builds
**Rationale:** requirements2.txt is the authoritative source for Docker version pins. Our entries just ensure the packages are listed.
**Impact:** requirements.txt

## [2026-03-21 17:30] Decision: Single orchestrator pattern for Claude Code

**Context:** Running two Claude Code sessions on the same repo caused branch conflicts and file corruption
**Decision:** One Claude Code session at a time. Delegated agents use `isolation: "worktree"` for parallel work.
**Rationale:** Git has one working tree — concurrent checkouts corrupt each other's state.
**Impact:** Workflow pattern, not code. Saved in memory for future sessions.

## [2026-03-21 20:30] Decision: Bridge notify_user → action cards instead of Expo JSON parsing

**Context:** We built an Expo extension that parses tool response JSON for action card data, but it's fragile (JSON extraction, prompt engineering for raw JSON output). Meanwhile, A0 has a built-in `notify_user` tool that it naturally uses to send structured notifications with title, message, type, priority.
**Decision:** Create a post-tool extension that intercepts `notify_user` calls and converts them to action card Socket.IO events. Keep the existing Expo extension as a secondary path.
**Rationale:** A0 already WANTS to notify the user — it used notify_user spontaneously when it created the rush order (27B local model, no prompting). Fighting that instinct (forcing Expo to output raw JSON) is harder than riding it. The type mapping is clean: success→update, warning→urgent, info→info.
**Impact:** New extension in usr/extensions/tool_execute_after/ that hooks notify_user → action_card emit. Frontend action card system unchanged. Expo extension remains as fallback.
**Evidence:** A0 session 2026-03-21 — installed PostgreSQL, created schema from memory, inserted order, used notify_user to alert chef. The notification pattern was correct on first try.

## [2026-03-22 00:00] Decision: Two-path action card architecture

**Context:** Original plan was a Python extension that parses tool response text into action cards (fragile JSON extraction). User feedback: "A0 has an LLM brain — let it decide." But then subordinate token cost became a concern.
**Decision:** Two complementary paths: (1) Auto-emit extension detects DB writes (`db_mutate`, `*_create`, `*_update`, `*_delete`) and constructs cards from structured MCP response — zero extra LLM tokens. (2) `action_card` tool stays available for proactive LLM-driven notifications (menu ideas, reminders, email alerts) that aren't DB writes.
**Rationale:** DB writes are the common path — auto-emit saves tokens. Proactive alerts are the creative path — LLM decides. Best of both worlds.
**Impact:** `usr/extensions/tool_execute_after/_30_action_card_emit.py` (auto-emit), `python/tools/action_card.py` (proactive tool)

## [2026-03-22 00:30] Decision: MCP subprocess env inheritance via os.environ merge

**Context:** MCP SDK's `StdioServerParameters(env=None)` calls `get_default_environment()` which only passes HOME+PATH. MCP subprocess never sees `DATABASE_URL` from docker-compose.
**Decision:** Patch `python/helpers/mcp_handler.py` to merge `os.environ` into subprocess env before creating `StdioServerParameters`. Server-specific overrides from config still take precedence via `merged_env.update(server.env)`.
**Rationale:** This is A0 core but necessary infrastructure plumbing. The MCP SDK design doesn't support env inheritance natively.
**Impact:** `python/helpers/mcp_handler.py` (line ~1030)

## [2026-03-22 01:00] Decision: Codex plugin install at container startup, not build time

**Context:** `usr/` is excluded from Docker image (`.dockerignore`) and volume-mounted at runtime. Can't run plugin initializer at build time.
**Decision:** Dockerfile CMD runs `initialize.py` before `run_ui.py` if the plugin exists. Conditional — graceful skip if plugin not present.
**Rationale:** The plugin patches A0 core files (`model_providers.yaml`, `settings-store.js`, etc.) which are baked into the image. Plugin source is in volume-mounted `usr/plugins/`. Must run after volume mount, before A0 starts.
**Impact:** `Dockerfile.agent-zero` (CMD entrypoint)

## [2026-03-22 02:00] Decision: sio hierarchy walk for subordinate agents

**Context:** When A1 (subordinate) calls the `action_card` tool, `self.agent.config.additional` doesn't have `sio` — it's only injected into A0 at startup.
**Decision:** Walk up the agent hierarchy via `agent.get_data(Agent.DATA_NAME_SUPERIOR)` to find sio from the root agent (A0).
**Rationale:** A0 always has sio. Subordinates hold a reference to their superior. One hop finds it.
**Impact:** `python/tools/action_card.py`, `usr/extensions/tool_execute_after/_30_action_card_emit.py`

## [2026-03-22 06:40] Decision: Kitchen Display System aesthetic for action cards

**Context:** User tested action cards with fake data and said it looks like "another Claude Code website." Needed restaurant-first visual identity.
**Decision:** Adopted KDS (Kitchen Display System) aesthetic — left-border station colors, monospace labels, "Tickets"/"FIRE"/"Cleared" vocabulary, 2-column solitaire grid with flip-to-expand.
**Rationale:** Restaurant operators recognize KDS patterns instinctively. Kitchen tickets are the mental model — not notification panels.
**Impact:** `action-card.tsx` (rewrite), `action-card-expanded.tsx` (rewrite), `notification-panel.tsx` (rewrite)

## [2026-03-22 06:40] Decision: Inline expand with Framer Motion layoutId over view-swap

**Context:** Original action card expand used AnimatePresence to swap between list view and expanded view — felt like a page navigation, not a card flip.
**Decision:** Use Framer Motion `layoutId` for shared-layout animation between collapsed and expanded card states. Card expands inline, pushing others away.
**Rationale:** User described it as "picking a card from a table, turning it over, bringing it close to your face." layoutId enables this with zero manual animation code.
**Impact:** `action-card.tsx` (layoutId), `action-card-expanded.tsx` (layoutId), `notification-panel.tsx` (LayoutGroup)
