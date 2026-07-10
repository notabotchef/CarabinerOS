# Agent Zero → Hermes Restaurant Capability Inventory

**Repo:** `/root/carabineros` · **HEAD:** `d47fc82` (`2026-07-09`) · **Branch:** `main` · **Date:** 2026-07-10
**Scope:** Superproject overlay only. The engine pin `3c9b1d5f9dcd266c082fa08443a9852886f4bc1a` is **unverifiable** from this machine (see §2 + §8).
**Constraint:** Discovery + classification only. **No source edits, no `git commit`, no Docker restarts.** This untracked inventory doc is the only artifact produced this turn.

---

## 1. Evidence boundary

- Repo at `/root/carabineros`, on `main`, source tree was clean against `d47fc82` **before this doc was written**. The doc itself is the only untracked file.
- `engine/agent-zero/` is **empty** (no checkout, no `.git`).
- Pinned object `3c9b1d5f9dcd266c082fa08443a9852886f4bc1a` is **not** in the local object store (`git cat-file -t` → `could not get object info`).
- `.gitmodules` declares only the engine submodule; the orphan `rune-business` gitlink has **no** `.gitmodules` entry, so `git submodule status` errors with `fatal: no submodule mapping found in .gitmodules for path 'rune-business'`. The preceding `-3c9b1d5f… engine/agent-zero` line **must not** be quoted as engine evidence.
- Historical trap: an earlier turn ran `git -C engine/agent-zero log …` which walked up to the superproject and looked like engine history. It is not.
- Docker recovery probe (see §8) already ran this turn — no A0 image, no A0 container, no volume with engine code. The unreachable blob `53167a5f…` was peeked; contents are unrelated JSON (starts with `{"c0d2a473":`), not engine source.
- **Therefore:** A0 loader behavior, extension autoloading, and anything inside the engine pin are unverifiable. Engine items are listed under **§4**.

## 2. Activation confidence classes

Only four classes are used. A row's class describes what we know about the artifact's effect on a working A0 — not whether the file is on disk.

- **🟢 Confirmed mounted/configured** — file present **and** configuration/mount path makes it reachable. **Does not** prove the A0 loader on the `carabiner/v1.8` fork actually invoked it.
- **🟠 Activation uncertain** — file present in a path the engine would *usually* scan, but the fork could have changed loader rules. Cannot be confirmed without the engine.
- **⚪ Configured inactive** — config explicitly disables it (e.g. `mcp_server_enabled: false`, empty `mcp_servers`).
- **⚫ Confirmed no-op** — code path runs but does nothing real (A0 `card_commit`/`card_dismiss` return status only).
- **🚫 Engine-only / unverifiable** — depends on A0 engine code not available on disk.

## 3. Overlay inventory

| Subsystem | Path(s) | Restaurant behavior | Confidence | Hermes / bridge equivalent today |
|---|---|---|---|---|
| **Default profile (gm)** | `usr/settings.json:agent_profile="gm"` | Selected as the active agent on A0 boot. **Configuration intent, not execution proof.** | 🟠 | ❌ None — Hermes is single-agent, no profile selector in `var/hermes-home/config.yaml`. |
| **Five specialist profiles** | `usr/agents/{agm,executivechef,souschef,expo,marketing}/{agent.yaml,agent.json,prompts/agent.system.main.role.md}` | AGM (orders/inventory/invoices), Executive Chef (menu/food-cost/recipes), Sous Chef (prep), Marketing (campaigns), Expo (card formatter + daily sweep). Each role prompt mandates `code_execution_tool → carabiner CLI` and `notify_user` after every write with structured detail JSON. | 🟠 | ❌ None on Hermes. |
| **GM router role** | `usr/agents/gm/prompts/agent.system.main.role.md` (23 LOC) | "You are CarabinerOS… You are a **router**. You NEVER use tools directly. You ALWAYS delegate to the right specialist using `call_subordinate`." | 🟠 | ❌ None on Hermes. `call_subordinate` is an A0 concept; not a tool. |
| **Restaurant context system-prompt extension** | `usr/extensions/python/system_prompt/_25_restaurant_context.py` (95 LOC) | Injects CarabinerOS identity + mandatory `carabiner_read` / `carabiner_write` usage + `--chat-context` rule + action-card-after-write rule into A0's system prompt. | 🟠 | ❌ Not loaded into Hermes. |
| **Action-card system-prompt** | `usr/extensions/python/system_prompt/_30_action_cards.py` + `_action_cards.md` | Teaches model the urgency/priority/group taxonomy (`type: warning/error/success/info/progress`, `priority: high/normal`, group ∈ {orders, prep, recipes, inventory, invoices, menu, food_cost, campaigns}). | 🟠 | ❌ Not loaded into Hermes. |
| **Inject Socket.IO at agent init** | `usr/extensions/python/agent_init/_10_inject_sio.py` (45 LOC) | `from run_ui import socketio_server` → `self.agent.config.additional["sio"] = sio`. | 🟠 | ✅ Bridge owns its own `socketio.AsyncServer`; covered by `carabiner/runtime/sockets.py`. |
| **Inject location at agent init** | `usr/extensions/python/agent_init/_20_inject_location.py` (46 LOC) | Subprocess-runs `carabiner orders list --json`, takes first order's `location_id`, sets `active_location_id` + hard-coded `active_location_name = "Main Kitchen"`. | 🟠 | ❌ No `active_location` in `carabiner/runtime/`. **Recommendation: design fresh, not lift** (see §6 #1). |
| **Chef-status UX hook** | `usr/extensions/python/monologue_end/_10_chef_status.py`, `tool_execute_before/_10_chef_status.py`, `tool_execute_after/_10_chef_status.py` | Emits sio `chef_status` events at three lifecycle points. | 🟠 | 🚫 Drop on Hermes — frontend has its own spinner via `log_progress_active`. |
| **Response stream cleaning** | `usr/extensions/python/response_stream_chunk/_25_response_cleaning.py` (49 LOC) | `re.sub(r"\bcode_execution_tool\b", "operational workflow", …)` — strips the tool name from the user-facing reply. | 🟠 | 🚫 Drop on Hermes — bridge streams raw deltas; cleaning belongs in the frontend, not the model output. |
| **Workspace sync** | `usr/extensions/python/tool_execute_after/_25_workspace_sync.py` (50 LOC) | "Sync tool results to action_log and emit workspace_update events." (Not a workdir sync despite the file name.) | 🟠 | 🚫 Drop on Hermes — no workdir surface; bridge has no equivalent of `workspace_update`. |
| **Action-card emit (live)** | `usr/extensions/python/tool_execute_after/_30_action_card_emit.py` (137 LOC) | After every `code_execution_tool` call, build a card from the tool result and emit to sio. | 🟠 | ✅ Bridge single-emitter at `carabiner/runtime/cards.py` + socket `card_commit`/`card_dismiss` in `sockets.py`. |
| **Action-card emit (.disabled)** | `usr/extensions/python/tool_execute_after/_30_action_card_emit.py.disabled` | **Byte-identical** SHA `dc22e439…738dc` to the live file. Kill-switch intent. | 🟠 | 🚫 Drop on Hermes — one bridge emitter; no kill-switch needed. |
| **Daily-brief hook** | `usr/extensions/python/webui_ws_event/_30_daily_brief.py` (61 LOC) + `python/tools/daily_brief_tool.py` (401 LOC) | Triggered by `daily_brief_request` socket events; queries DB for today's operations; emits cards. | 🟠 | ❌ No bridge scheduler today. |
| **Dedicated read tool** | `usr/tools/carabiner_read.py` (83 LOC) + `usr/prompts/agent.system.tool.carabiner_read.md` | Wraps the `carabiner` CLI. `resource ∈ {orders,inventory,recipes,menu,invoices,prep,food-cost,vendors,campaigns}` × `verb ∈ {list,get,query,summary,counts,par-levels}`. | 🟠 | ⚠️ **Partial** — bridge has `carabiner_read` MCP tool at `carabiner/runtime/mcp_surface.py`, mounted at `/mcp`, registered in `var/hermes-home/config.yaml`. **Tool-prompt parity with the A0 tool prompt not yet verified.** |
| **Dedicated write tool** | `usr/tools/carabiner_write.py` (157 LOC) + `usr/prompts/agent.system.tool.carabiner_write.md` | `verb ∈ {create,update,delete}` × same resources. Auto-injects `--chat-context`. Fires action card. Policy allowlist at lines 23–28 (`_WRITE_VERBS` × `_RESOURCES`). | 🟠 | ⚠️ **Partial** — bridge has `carabiner_propose_write` MCP tool + host policy at `carabiner/runtime/policy.py`. Mutation only on `card_commit` socket event with policy re-check. **Tool-prompt parity not yet verified.** |
| **CLI-via-`code_execution_tool`** | Implicit in every role prompt (5 specialists + system-prompt context). | Three competing data-access eras. | 🟠 | 🚫 Retired on Hermes — tools surface via MCP only. Role prompts must be cleaned of these examples after porting. |
| **Action-card dict shape** | `usr/extensions/python/system_prompt/_action_cards.md` schema | `{module, action, item_id, stats[], changes[], actions[], suggested_chips[]}` inside the `detail` JSON. | 🟢 | ⚠️ Bridge `cards.py` builds a dict; **shape parity with the A0 schema unverified end-to-end.** |
| **A0 `card_commit` / `card_dismiss` socket handler** | `python/websocket_handlers/state_sync_handler/action_cards_handler.py` lines 101–111 | Returns `_Result(ok=True, data={"status": "committed"})` and similarly for dismiss. **No DB write, no audit, no execution.** | ⚫ Confirmed no-op | ✅ Bridge `sockets.py` `card_commit` does idempotent status guard → policy re-check → execute → `ActionLog(committed)` → re-emit card. Fails closed on `AUDIT_REQUIRED=true`. |
| **`card_message` (chat-in-card)** | same file, `_handle_message` | A0: calls back into A0 via `agent_module.AgentContext.first().communicate(prompt)` with a 30 s timeout; emits `card_reply`. | 🟠 (depends on engine) | ❌ **Bridge version is still echo-only**: `sockets.py:255–266` calls `emitter.emit_card_reply(server, card_id, text, …)` with the user's text verbatim — no LLM call, no card context read. **Real LLM-backed `card_message` is a 🔧 row.** |
| **Carabiner startup plugin** | `usr/plugins/carabiner/{plugin.yaml, .toggle-1, extensions/python/startup_migration/_10_carabiner_init.py}` | `always_enabled: true`, `version: 0.13.0`. Creates tables via `metadata.create_all`, initializes async pool, writes A0 ApiHandler stubs. | 🟠 | ⚠️ Bridge uses Alembic migrations in `carabiner/db/migrations/`. The plugin's startup logic may do something the migrations miss — verify before deleting. |
| **LangExtract plugin** | `usr/plugins/langextract/{plugin.yaml, prompts/agent.system.tool.langextract.md, helpers/{extractor.py, schemas.py}, tools/langextract_tool.py, tests/, fixtures/}` | Structured extraction from invoice/recipe/prep text. `per_project_config: true`, `per_agent_config: false`. Methods: `langextract:extract`, `extract_invoice`, `extract_recipe`, `extract_prep`. | 🟠 | ❌ No MCP tool for it on Hermes. |
| **Scheduler** | `usr/scheduler/tasks.json` | `{"tasks":[]}` — **empty**. | 🟢 (file contents) | ❌ No Hermes scheduler; no bridge scheduler. |
| **Model-config presets** | `usr/plugins/_model_config/{config.json, presets.yaml}` | Per-agent LLM config. Path is `plugins/_model_config`, not the standard A0 plugin location. | 🟠 | ❌ Hermes has its own per-model config in `var/hermes-home/config.yaml`; not currently consulted here. |
| **Knowledge — identity** | `usr/knowledge/main/carabineros-identity.md` | "Your name is CarabinerOS — never Agent Zero." | 🟠 Activation uncertain — file is under `main/` while `settings.json:agent_knowledge_subdir` is `"custom"`; the engine loader could have honored a different default, but cannot be confirmed without the engine. | ❌ Not loaded. |
| **Knowledge — schema** | `usr/knowledge/main/database-schema.md` | Table overview for the LLM context. | 🟠 Same as above. | ❌ Not loaded. |
| **Knowledge — CLI reference** | `usr/knowledge/main/carabiner-cli-reference.md` | `carabiner <resource> <verb> [--json]` reference. | 🟠 Same as above. | 🚫 Drop on Hermes — Hermes uses MCP tools, not the `carabiner` CLI binary. |
| **Settings — runtime knobs** | `usr/settings.json` | `agent_knowledge_subdir:"custom"`, `tts_kokoro:true`, `workdir_show:true`, `mcp_server_enabled:false`, `mcp_servers:"{}"`, `chat_inherit_project:true`. | 🟢 | ⚠️ `var/hermes-home/config.yaml` does not currently mirror `agent_profile` or `tts_kokoro`. |
| **Settings — local override** | `usr/settings.local.json.example` | Would enable `carabiner-db` MCP stdio and override model base URLs. | ⚪ Configured inactive — `usr/settings.local.json` **does not exist** on disk. | n/a |
| **Workdir artifacts** | `usr/workdir/sales_query.py` (725 B), `usr/workdir/trend-scout-ai-restaurant-2026.md` (18 KB) | User-supplied market intel + a one-shot query script. | 🟢 (user data) | 🚫 Not part of the runtime; keep as docs. |
| **Initial greeting** | `usr/prompts/fw.initial_message.md` | "Welcome to CarabinerOS 🦐 — how can I help you today?" with `agent.system.main.role` reintroduction. | 🟢 | ❌ No `fw.initial_message` analogue on Hermes. |
| **Top-level shim tools** | `tools/action_card.py` (39 B), `tools/daily_brief_tool.py` (63 B) | Tiny re-export shims to A0's `/a0/tools/` discovery path. | 🟢 | 🚫 Drop on Hermes. |
| **Tracked junk** | `tools/paperclip-bridge/` (~52 MB, 3766 tracked files), `rune-business` orphan gitlink, `.rune/metrics/` | Hygiene, not capability. | 🟢 | n/a |

## 4. Engine-only — unverifiable from this machine

| Subsystem | Where it lives | Restaurant behavior | Status |
|---|---|---|---|
| **Core chat loop / monologue** | A0 pin `3c9b1d5f` (custom `carabiner/v1.8` branch) | Hosts the agent run loop, monologue, LiteLLM bridge. | 🚫 Replaced by `carabiner/runtime/hermes/HermesClient` + `_assistant_run` — verified live (`d47fc82`). |
| **A0 host Socket.IO state-sync server** | A0 `python/websocket_handlers/state_sync_handler/` | A0-side state push orchestration. | 🚫 Replaced by `carabiner/runtime/sockets.py`. |
| **`agent.py` / `models.py` / `run_ui.py` / `initialize.py`** | A0 root | Process entry points. | 🚫 Replaced by `python -m carabiner.runtime.server`. |
| **Kokoro TTS preload** | A0 commit on `carabiner/v1.8` (cited in README) | Voice preload tweak (`tts_kokoro:true` in `usr/settings.json`). | 🚫 No TTS bridge yet on Hermes-frontend. Migration plan flags this as still-missing. |
| **63-tool MCP server** | A0 `python/tools/` mcp era | Per-module resource×verb. | 🚫 Replaced by scoped 2-tool MCP. |
| **A2A server, ACP adapter** | A0 upstream | Outbound agent-to-agent / structured-stream. | 🚫 Not used in CarabinerOS. |
| **FreshcOS** | Esteban's machine only | Claimed "newest direction". | 🚫 Unverifiable. The only evidence is the Codex audit on Esteban's machine, which says it's stale. |
| **In-engine patches not mirrored under `usr/`** | Any commit on `carabiner/v1.8` that touched engine code | Unknown. | 🚫 Cannot verify (see §8). |

## 5. A0 → Hermes parity matrix

Capabilities are graded by what is actually present and *verified*, not by "exists in the bridge." Use these statuses:

- **✅ implemented and live-verified** — exercised end-to-end.
- **✅ partial** — present in bridge but not yet parity-checked against the A0 artifact (prompt, dict shape, etc.).
- **🔧 not implemented** — needs new code.
- **🚫 drop on Hermes** — no port needed; concept retired.
- **🚫 blocked on engine** — depends on the missing `carabiner/v1.8` fork.

| # | Capability | A0 artifact(s) | Hermes / bridge equivalent | Verdict |
|---|---|---|---|---|
| 1 | Restaurant identity / brand voice | `usr/knowledge/main/carabineros-identity.md` + `fw.initial_message.md` | ❌ | 🔧 port as Hermes skill + greeting |
| 2 | Default agent profile (gm router) | `usr/agents/gm/` + `settings.json:agent_profile` | ❌ | 🔧 port gm prompt; add router logic |
| 3 | Five specialist profiles | `usr/agents/{agm,executivechef,souschef,expo,marketing}/` | ❌ | 🔧 port as Hermes sub-profiles |
| 4 | Restaurant system-prompt context | `_25_restaurant_context.py` | ❌ | 🔧 bake into Hermes system prompt / skill |
| 5 | Action-card protocol teaching | `_30_action_cards.py` + `_action_cards.md` | ❌ | 🔧 port as a Hermes skill |
| 6 | Dedicated read tool | `usr/tools/carabiner_read.py` + tool prompt | ⚠️ `carabiner_read` MCP tool exists; prompt parity unverified | ✅ partial |
| 7 | Dedicated write tool + policy allowlist | `usr/tools/carabiner_write.py` + tool prompt | ⚠️ `carabiner_propose_write` MCP tool + host policy; prompt parity unverified | ✅ partial |
| 8 | CLI-via-`code_execution_tool` | Implicit in role prompts | 🚫 Not exposed | 🚫 drop on Hermes (clean up prompt examples) |
| 9 | Action-card emission (3 paths) | `action_card.py` + `daily_brief_tool.py` + `_30_action_card_emit.py[.disabled]` | ⚠️ Bridge has one emitter in `cards.py`; dict-shape parity unverified | ✅ partial |
| 10a | Card commit / dismiss lifecycle | A0 `card_commit/dismiss` (no-ops) | ✅ Bridge `sockets.py`: real status guard, policy re-check, `ActionLog(committed)`, audit fail-closed | ✅ implemented |
| 10b | `card_message` (LLM-in-card) | A0 calls `agent.AgentContext.first().communicate(prompt)`, emits `card_reply` | ❌ Bridge echoes the user's text verbatim (`sockets.py:255–266`); no LLM call, no card context read | 🔧 not implemented |
| 11 | DB schema knowledge | `usr/knowledge/main/database-schema.md` | ❌ | 🔧 port as tool-description / skill |
| 12 | CLI command reference | `usr/knowledge/main/carabiner-cli-reference.md` | ❌ — Hermes uses MCP tools, not the CLI binary | 🚫 drop on Hermes (delete) |
| 13 | Location injection | `_20_inject_location.py` (first order's `location_id`, hard-coded `"Main Kitchen"`) | ❌ No `active_location` in `carabiner/runtime/` | 🔧 design fresh — don't copy the hard-coded location name (see §6) |
| 14 | Socket.IO injection at agent init | `_10_inject_sio.py` | ✅ Bridge owns its own sio | ✅ implemented |
| 15 | Chef-status UX | `_10_chef_status.py` × 3 | n/a — frontend has its own spinner + `log_progress_active` | 🚫 drop on Hermes |
| 16 | Workspace sync | `_25_workspace_sync.py` (action_log + `workspace_update`) | n/a — bridge has no `workspace_update` | 🚫 drop on Hermes |
| 17 | Response-cleaning | `_25_response_cleaning.py` | n/a — bridge streams raw deltas | 🚫 drop on Hermes |
| 18 | Daily brief | `daily_brief_tool.py` + `webui_ws_event/_30_daily_brief.py` + `usr/scheduler/tasks.json` (`{"tasks":[]}`) | ❌ | 🔧 bridge-native scheduler running existing read APIs |
| 19 | LangExtract | `usr/plugins/langextract/` | ❌ | 🔧 port as third MCP tool `carabiner_extract` |
| 20 | Kokoro TTS preload | Engine commit `carabiner/v1.8` | ❌ | 🚫 blocked on engine |
| 21 | Workdir file browser | `usr/settings.json:workdir_show` | n/a — Hermes UI is the CarabinerOS frontend | 🚫 drop on Hermes |
| 22 | Core chat loop / monologue | Engine pin | ✅ Bridge `hermes/HermesClient` + `_assistant_run` (live at `d47fc82`) | ✅ implemented |
| 23 | Core Socket.IO state-sync host | Engine | ✅ Bridge `sockets.py` | ✅ implemented |
| 24 | A0 process entry points | Engine | ✅ `python -m carabiner.runtime.server` | ✅ implemented |
| 25 | FreshcOS | Esteban's machine | n/a | 🚫 blocked (not pushed) |

**Honest counts** (matrix has 26 entries because #10 is split into 10a + 10b):

| Status | Count | Items |
|---|---|---|
| ✅ implemented | **5** | #10a, #14, #22, #23, #24 |
| ✅ partial (present, parity unverified) | **3** | #6, #7, #9 |
| 🔧 not implemented | **10** | #1, #2, #3, #4, #5, #10b, #11, #13, #18, #19 |
| 🚫 drop on Hermes | **6** | #8, #12, #15, #16, #17, #21 |
| 🚫 blocked on engine | **2** | #20, #25 |

## 6. Recommended order of implementation (recommendation only — no work started)

The acting agent is **not** starting these. Listed in execution order for when the user gives the go-ahead.

1. **Identity + restaurant operating rules + `gm` profile** — port `usr/agents/gm/prompts/agent.system.main.role.md`, `usr/knowledge/main/carabineros-identity.md`, and `fw.initial_message.md` into a Hermes skill / system-prompt pack. **This is the recommended first wire** (matches the order the user originally described: "soul files, agents profiles, special skills"). Strip every `code_execution_tool` / `carabiner` CLI / `notify_user` example from the ported prompts; the bridge already covers all of those surfaces.
2. **Location injection** — design fresh in `carabiner/runtime/http_api.py` (`_assistant_run`) and `runs`-equivalent orchestration. **Do not** copy the A0 hard-coded `"Main Kitchen"` string; that was a placeholder. Decide whether to (a) look up `chat_context_id → location_id` from the `chat_contexts` table, or (b) inject via request header. Awaiting owner direction.
3. **MCP tool-prompt parity** — verify `var/hermes-home/config.yaml` tool descriptions match the A0 tool prompts (`carabiner_read.md`, `carabiner_write.md`).
4. **Action-card dict-shape parity** — verify `cards.py` builds the same shape `_action_cards.md` specifies; then implement **real LLM-backed `card_message`** in `sockets.py` (currently echo-only).
5. **Daily-brief scheduler** — bridge-native `carabiner/runtime/scheduler.py` reusing existing read APIs + `cards.py`.

Defer (lower priority, not on the critical path):

- Five specialist profile loaders.
- LangExtract as a third MCP tool.
- Response-cleaning / chef-status / workspace-sync / workdir (drop, not port).

## 7. Recovery probe (done — nothing recoverable)

The engine pin was unreachable; the following read-only probes already ran this turn:

| Probe | Result |
|---|---|
| `docker ps -a` | Only the **carabiner-hermes-*** stack is present; all exited ~1 hour ago. No A0 container. |
| `docker images` | Only `carabiner-hermes-{bridge,hermes,frontend}`, `postgres:16-alpine`, `nginx:alpine`. No `agent-zero*` image, no `agent0ai/*` base. |
| `docker volume ls` | `carabiner-hermes_hermes_home`, `carabiner-hermes_pgdata`. No engine volume. |
| `find / -maxdepth 6 -type d -name 'agent-zero' -o -name 'agent0'` | Only the empty `engine/agent-zero` gitlink in the repo. |
| `find /root /tmp /opt -type d -name a0` | Only `.git/objects/a0/` (loose object subdir, not engine). |
| `git fsck --full --unreachable --no-reflogs` | One unreachable blob: `53167a5f…` (8.4 KB JSON, peeked — starts with `{"c0d2a473":…}`, unrelated to the engine). |
| `git reflog --all` | Only superproject commits, no engine history. |

**Verdict: engine recovery from this machine is impossible.** Engine audit stays blocked until Esteban pushes the `carabiner/v1.8` fork or provides an engine snapshot.

## 8. Blockers — questions for the human owner

1. **Engine fork.** Push the patched `carabiner/v1.8` engine fork (e.g. `notabotchef/agent-zero`) and repoint `.gitmodules`. Without this, every "Engine-only" row stays 🚫 forever.
2. **FreshcOS.** If still relevant, push it (branch or separate repo). The only existing evidence says it's stale.
3. **Tracked-junk cleanup.** `tools/paperclip-bridge/` (52 MB, 3766 files), the orphan `rune-business` gitlink, `.rune/metrics/`. Hygiene, not migration — needs explicit OK.
4. **Which 🔧 row to wire first.** Recommended order is in §6. The acting agent is **not** starting without an explicit pick from you.
5. **Operational note (out of scope, FYI).** The carabiner-hermes compose stack is currently **exited**. Tunnel and live UI are down. Bringing it back up is **not** in this discovery phase; mention if you want it revived.

## 9. Stop

No source edits made. No `git commit` performed (per user instruction: discovery only). The inventory doc is left **untracked** unless the user asks to commit.

**Inventory complete. Awaiting owner direction on which row to wire next.**
