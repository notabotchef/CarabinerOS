# Decisions Log

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
