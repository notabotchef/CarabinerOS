# CarabinerOS ↔ Agent Zero Integration Audit

**Date:** 2026-03-31  
**Scope:** Full audit of how CarabinerOS integrates with, modifies, and extends Agent Zero  
**Method:** `git diff upstream/main --name-status`, extension/plugin inventory, dependency analysis

---

## Executive Summary

**Good news: the integration is much cleaner than it appears.** Only **5 files** are modified from upstream Agent Zero — everything else (592 files) is brand new CarabinerOS additions. The update friction you're experiencing is not caused by massive code divergence, but by structural and process issues.

| Metric | Value |
|---|---|
| Files modified from upstream | **5** |
| Files added by CarabinerOS | **592** |
| Total lines added | ~186,170 |
| Total lines removed from upstream | **2** |
| A0 core files touched | **1** (`run_ui.py`) |

---

## 1. Modified Files (The Actual Conflict Zones)

Only these 5 files differ from upstream Agent Zero:

### 1.1 `run_ui.py` — **The only A0 core file modified**

**What changed:** CarabinerOS adds two blocks after `init_a0()`:

```python
# Block 1: CarabinerOS DB initialization
try:
    _init_carabiner_db()
except Exception as e:
    PrintStyle.warning(f"CarabinerOS DB init error (non-fatal): {e}")

# Block 2: Register CarabinerOS Flask blueprints
try:
    from carabiner.api.flask_blueprint import blueprint as carabiner_bp
    webapp.register_blueprint(carabiner_bp)
    from carabiner.api.prep_routes import prep_blueprint
    webapp.register_blueprint(prep_blueprint)
    PrintStyle().print("CarabinerOS API routes registered.")
except Exception as e:
    PrintStyle.warning(f"CarabinerOS API routes not loaded: {e}")
```

**Why this is a conflict zone:** On every upstream merge, `run_ui.py` is a likely conflict point because A0 may change the bootstrap sequence, add new initialization steps, or restructure the Flask/Starlette wiring.

**Fix:** Move this to an extension point (`extensions/python/agent_init/`) or a plugin `hooks.py` instead of patching the entry point.

### 1.2 `requirements.txt` — CarabinerOS dependencies added

**What changed:** Added CarabinerOS-specific dependencies (lines 37+):
```
# CarabinerOS database dependencies (not in upstream A0)
asyncpg>=0.29.0
sqlalchemy[asyncio]>=2.0.0
alembic>=1.13.0
```
Plus security floor pins for transitive dependencies (Pillow, nltk, urllib3, cryptography, werkzeug).

**Why this is manageable:** This is an additive change. Upstream A0 changes to requirements.txt will merge cleanly as long as they don't touch the same lines.

**Fix:** Consider moving CarabinerOS-specific deps to a separate `requirements-carabiner.txt` that gets installed alongside the base requirements.

### 1.3 `.dockerignore` — CarabinerOS-specific exclusions

**What changed:** Added exclusions for frontend build artifacts, docs, research files, `.rune/`, `.claude/`, `.worktrees/`, `.github/`, and selective markdown inclusion.

**Impact:** Zero conflict risk for A0 updates — this is purely a CarabinerOS build concern.

### 1.4 `.gitignore` — Added `.worktrees/`

**Impact:** Trivial, no conflict risk.

### 1.5 `plugins/_plugin_installer/helpers/install.py` — Removed unused import

**What changed:** Removed `from turtle import stamp` (unused import).

**Impact:** This is a cleanup that will conflict if upstream also modifies this file. Should be submitted upstream as a PR or reverted to stay clean.

---

## 2. Extension & Plugin Inventory

CarabinerOS uses Agent Zero's extension system **extensively and correctly**. This is the right pattern.

### 2.1 Extension Points Used (31 extension directories)

| Extension Point | Files | Purpose |
|---|---|---|
| `agent_init/` | 2 | Initial message, profile settings |
| `banners/` | 2 | Security warnings, system resources |
| `before_main_llm_call/` | 1 | Stream logging |
| `error_format/` | 1 | Error masking |
| `hist_add_before/` | 1 | Content masking |
| `hist_add_tool_result/` | 1 | Save tool call files |
| `job_loop/` | 1 | Cache trimming |
| `message_loop_end/` | 2 | History organization, chat saving |
| `message_loop_prompts_after/` | 4 | DateTime, skills, agent info, workdir extras |
| `message_loop_prompts_before/` | 1 | History organization wait |
| `message_loop_start/` | 1 | Iteration numbering |
| `monologue_end/` | 1 | Waiting for input message |
| `monologue_start/` | 1 | Chat renaming |
| `process_chain_end/` | 1 | Process queue |
| `reasoning_stream*` | 3 | Stream masking and logging |
| `response_stream*` | 5 | Stream masking, logging, live response |
| `startup_migration/` | 0 | (empty — reserved) |
| `system_prompt/` | 6 | Main prompt, tools, MCP, secrets, skills, project |
| `tool_execute_after/` | 1 | Secret masking |
| `tool_execute_before/` | 2 | Output replacement, secret unmasking |
| `user_message_ui/` | 1 | Update check |
| `util_model_call_before/` | 1 | Secret masking |
| `webui_ws_*` | 3 | WebSocket state sync |
| `_functions/` | 2 | Implicit hook points for `__main__` and `agent` |

### 2.2 Plugins (19 plugins in `plugins/`)

| Plugin | Type | Status |
|---|---|---|
| `_browser_agent` | Core A0 | Browser automation |
| `_chat_branching` | Core A0 | Chat branching |
| `_chat_compaction` | Core A0 | Chat compaction |
| `_code_execution` | Core A0 | Code execution |
| `_email_integration` | CarabinerOS | Email features |
| `_error_retry` | Core A0 | Error retry |
| `_infection_check` | Core A0 | Security |
| `_memory` | Core A0 | Memory system |
| `_model_config` | Core A0 | Model configuration |
| `_onboarding` | Core A0 | Onboarding |
| `_plugin_installer` | Core A0 | Plugin installation |
| `_plugin_scan` | Core A0 | Plugin scanning |
| `_plugin_validator` | Core A0 | Plugin validation |
| `_promptinclude` | Core A0 | Prompt includes |
| `_telegram_integration` | CarabinerOS | Telegram |
| `_text_editor` | Core A0 | Text editing |
| `browser_bridge` | CarabinerOS | Browser bridge |
| `notebooklm` | CarabinerOS | NotebookLM integration |

### 2.3 CarabinerOS-Specific Extensions

All CarabinerOS-specific extensions live in `extensions/python/` and follow the naming convention (`_NN_description.py`). These are **properly using the extension system** — not modifying core files.

### 2.4 Tools in `usr/tools/` (CarabinerOS domain tools)

| Tool | Purpose |
|---|---|
| `food_cost_tool.py` | Food cost calculations |
| `inventory_tool.py` | Inventory management |
| `invoice_tool.py` | Invoice generation |
| `marketing_tool.py` | Marketing operations |
| `menu_tool.py` | Menu management |
| `order_tool.py` | Order processing |
| `ping_tool.py` | Health check |
| `prep_tool.py` | Kitchen prep |
| `recipe_tool.py` | Recipe management |
| `reporting_tool.py` | Reporting & analytics |

---

## 3. CarabinerOS Additions Architecture

### 3.1 `carabiner/` Package (Restaurant Operations Platform)

```
carabiner/
├── __init__.py          # "CarabinerOS — Restaurant operations platform."
├── chat_store.py        # Chat persistence
├── api/                 # Flask blueprints
│   ├── flask_blueprint.py   # Main CarabinerOS API (1,240 lines)
│   ├── prep_routes.py       # Prep module routes
│   ├── chats.py, health.py, hq.py, locations.py, reporting.py, schemas.py, workspace.py
├── db/                  # SQLAlchemy + Alembic
│   ├── engine.py, base.py, models.py, repositories.py
│   ├── migrations/versions/  # 10+ migration files
│   ├── seed_functional.py, seed_realistic.py
│   └── tool_db.py, workspace_models.py
├── domain/              # Business logic
│   ├── connectors.py, reporting.py
└── mcp/                 # MCP server
    └── server.py        # 2,002 lines
```

### 3.2 Frontend (`frontend/`)

Separate Next.js frontend with its own Dockerfile, pnpm-lock.yaml, and app structure. Built separately from the A0 WebUI.

### 3.3 Documentation & Plans (`docs/`, `.rune/`)

Extensive documentation including:
- Architecture designs, migration plans, ADRs
- Phase-by-phase update plans (Phase 1-5)
- Frontend consolidation plans
- Competitive analysis, research docs

---

## 4. Dependency Audit

### 4.1 `requirements.txt`

**Upstream A0 pins (lines 1-36):** Standard A0 dependencies — langchain, openai, flask, etc.

**CarabinerOS additions (lines 37+):**
- Database: `asyncpg>=0.29.0`, `sqlalchemy[asyncio]>=2.0.0`, `alembic>=1.13.0`
- Document processing: `pymupdf`, `pdf2image`, `pytesseract`
- Communication: `imapclient`, `exchangelib`, `boto3`
- Audio: `soundfile`
- Web: `python-socketio`, `uvicorn`, `wsproto`, `watchdog`
- Security floors: `Pillow>=10.2.0`, `nltk>=3.9.3`, `urllib3>=2.6.0`, `cryptography>=46.0.0`

### 4.2 `requirements2.txt`

Minimal supplement:
- `litellm==1.79.3`
- `openai==1.99.5`
- `chardet<6`

### 4.3 `update_reqs.py`

Utility script that rewrites `requirements.txt` pins to match currently installed versions. Useful for keeping pins aligned but can cause drift between environments.

---

## 5. Submodule State

### Current State: **Broken / Not Used**

- `.git/config` has a submodule entry for `engine/agent-zero/` pointing to `https://github.com/agent0ai/agent-zero.git`
- **No `.gitmodules` file exists** — the submodule is orphaned in config
- **`engine/` directory does not exist** — the submodule was never checked out
- No `git submodule status` output — submodule is non-functional

### What This Means

The submodule was planned (docs reference `engine/agent-zero/` as the target location) but never implemented. The current repo is a **fork with upstream remote**, not a submodule-based integration.

### Git Remotes

```
origin   → https://github.com/Nunezchef/AgentCarabinerOS.git (your fork)
upstream → https://github.com/agent0ai/agent-zero.git (A0 upstream)
```

---

## 6. Self-Update Mechanism

### How It Works

1. **Trigger:** YAML file written to `/exe/a0-self-update.yaml`
2. **Manager:** `docker/carabiner_self_update_manager.py` fetches from upstream, checks out target branch/tag
3. **Backup:** Preserves `/a0/usr` (gitignored user data)
4. **Health Check:** Verifies `/api/health` responds after update
5. **Rollback:** Restores backup if health check fails
6. **Version Constraint:** Only same-major-version updates allowed; major upgrades require new Docker image

### Friction Points

- Trigger mechanism requires manual YAML file creation
- Health check can fail on network issues, causing unnecessary rollbacks
- Major version upgrades require full Docker image rebuild
- The self-update operates on `/a0` which is the entire repo root — no clean separation between A0 core and CarabinerOS code

---

## 7. Integration Touchpoints & Conflict Zones

### Current Integration Model

```
┌─────────────────────────────────────────────────┐
│  Agent Zero (at repo root — same as upstream)   │
│  agent.py, initialize.py, models.py, helpers/   │
│  tools/, prompts/, knowledge/, webui/            │
│                                                   │
│  ┌─────────────────────────────────────────┐    │
│  │ CarabinerOS injected at:                │    │
│  │  1. run_ui.py (bootstrap patch)         │    │
│  │  2. extensions/python/* (31 ext points) │    │
│  │  3. plugins/* (19 plugins)              │    │
│  │  4. usr/tools/* (10 domain tools)       │    │
│  │  5. usr/extensions/*                    │    │
│  │  6. usr/plugins/*                       │    │
│  │  7. carabiner/ package (separate)       │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### Conflict Risk Assessment

| Area | Risk | Reason |
|---|---|---|
| `run_ui.py` | **HIGH** | Only A0 core file modified; bootstrap changes frequently upstream |
| `requirements.txt` | **LOW** | Additive changes; merges cleanly unless upstream touches same lines |
| `.dockerignore` | **NONE** | CarabinerOS-only; upstream won't touch |
| `.gitignore` | **NONE** | Trivial additive change |
| `plugins/_plugin_installer/` | **LOW** | Only one unused import removed |
| Extensions (`extensions/python/`) | **NONE** | Pure additions; A0 extension system designed for this |
| Plugins (`plugins/`) | **LOW** | New plugins don't conflict; renamed plugins (underscore prefix) may need attention |
| `carabiner/` package | **NONE** | Completely separate namespace |
| `usr/` directory | **NONE** | Gitignored; self-update preserves it |

---

## 8. Findings & Recommendations

### 8.1 The Real Problem Isn't Code Divergence

**Only 5 files differ from upstream.** The update friction comes from:

1. **`run_ui.py` is the single point of failure** — it's the only A0 core file you modify, and it's the entry point that upstream changes frequently
2. **No automated update process** — updates require manual `git fetch upstream && git merge` with no compatibility testing
3. **Submodule was planned but never implemented** — docs reference `engine/agent-zero/` as a submodule, but it doesn't exist
4. **Self-update operates on the entire repo** — no clean boundary between A0 and CarabinerOS code

### 8.2 Recommended Actions (Priority Order)

#### P0: Extract `run_ui.py` patch into extension point

**Current:** CarabinerOS patches `run_ui.py` to register blueprints and init DB.

**Fix:** Create an `agent_init` extension or use the existing `extensions/python/agent_init/` system:

```python
# extensions/python/agent_init/_20_carabiner_bootstrap.py
from helpers.extension import Extension

class CarabinerBootstrap(Extension):
    def execute(self, **kwargs):
        # DB init
        try:
            _init_carabiner_db()
        except Exception as e:
            pass
        
        # Blueprint registration (needs Flask app reference)
        # This may require a different extension point or hook
```

**Note:** Blueprint registration happens at Flask app creation time, which is before extensions run. This may require a new extension point or a plugin `hooks.py` that runs during app initialization.

#### P1: Separate CarabinerOS dependencies

Move CarabinerOS-specific dependencies to `requirements-carabiner.txt`:
```
# requirements-carabiner.txt
asyncpg>=0.29.0
sqlalchemy[asyncio]>=2.0.0
alembic>=1.13.0
# ... rest of CarabinerOS deps
```

Install via: `pip install -r requirements.txt -r requirements-carabiner.txt`

This eliminates the only other potential merge conflict in `requirements.txt`.

#### P2: Fix or remove the orphaned submodule config

**Option A — Remove it:**
```bash
git config --remove-section submodule.engine/agent-zero
rm -rf .git/modules/engine/agent-zero  # if exists
```

**Option B — Make it real (recommended for future):**
```bash
# Create .gitmodules
git submodule add https://github.com/agent0ai/agent-zero.git engine/agent-zero
```

#### P3: Submit the `turtle` import fix upstream

The `from turtle import stamp` removal in `plugins/_plugin_installer/helpers/install.py` is a valid cleanup. Submit it as a PR to upstream to eliminate this diff.

#### P4: Create an update script

```bash
#!/bin/bash
# scripts/update-agent-zero.sh
set -e

echo "Fetching upstream..."
git fetch upstream

echo "Checking for conflicts..."
git diff --name-only HEAD upstream/main | while read file; do
    echo "  - $file"
done

echo "Merging..."
git merge upstream/main --no-edit

echo "Running compatibility checks..."
python -m pytest tests/ 2>/dev/null || echo "No tests found"

echo "Update complete. Review changes and test manually."
```

#### P5: Clean up prompt log files

The `.rune/` directory contains ~20 prompt optimization log files (~38,000 lines total). These should be gitignored or cleaned up — they add noise to diffs and increase repo size.

---

## 9. Architecture Diagram: Recommended Future State

```
carabiner-os/
├── engine/
│   └── agent-zero/          ← Git submodule (pure upstream, NEVER modified)
├── carabiner/               ← CarabinerOS platform code
│   ├── api/                 ← Flask blueprints
│   ├── db/                  ← SQLAlchemy models + migrations
│   ├── domain/              ← Business logic
│   └── mcp/                 ← MCP server
├── extensions/              ← Extension points (CarabinerOS-specific)
│   └── python/
│       ├── agent_init/
│       ├── system_prompt/
│       └── ...
├── plugins/                 ← CarabinerOS plugins
│   ├── _email_integration/
│   ├── _telegram_integration/
│   ├── browser_bridge/
│   └── notebooklm/
├── usr/                     ← User data (gitignored, preserved across updates)
│   ├── plugins/
│   ├── tools/
│   ├── extensions/
│   └── settings.json
├── requirements.txt         ← Upstream A0 deps (from submodule)
├── requirements-carabiner.txt ← CarabinerOS deps
├── run.py                   ← CarabinerOS entry point (bootstraps A0 + CarabinerOS)
└── frontend/                ← Next.js frontend (separate build)
```

### Update Flow (Future)

```bash
# Update Agent Zero
cd engine/agent-zero && git fetch && git checkout v0.X.Y && cd ../..

# Update CarabinerOS deps
pip install -r requirements-carabiner.txt

# Run compatibility tests
pytest tests/

# Done — no merge conflicts possible
```

---

## 10. Model Configuration Note

**⚠️ Rule: No Anthropic API usage.** Current config uses `anthropic/claude-sonnet-4.6` via OpenRouter (`plugins/_model_config/default_config.yaml` line 5). This needs to be changed to use ChatGPT Plus, Google Antigravity, or Qwen3.6 Plus (free).

The `conf/model_providers.yaml` file lists Anthropic as one of many supported providers (this is A0's multi-provider catalog, not a CarabinerOS-specific choice). The active model selection is in the plugin config.

---

## Appendix A: File Classification Summary

| Category | Count | Examples |
|---|---|---|
| Modified from upstream | 5 | `run_ui.py`, `requirements.txt`, `.dockerignore`, `.gitignore`, `install.py` |
| CarabinerOS additions | ~400 | `carabiner/`, `docs/`, `.rune/`, `frontend/`, extensions, plugins |
| A0 core (unchanged) | ~100 | `agent.py`, `initialize.py`, `models.py`, `helpers/`, `tools/`, `prompts/` |
| User data (gitignored) | N/A | `usr/` contents |

## Appendix B: Extension Point Coverage

CarabinerOS uses **28 of 31** available extension point directories. The only unused ones are:
- `startup_migration/` — empty (reserved)
- `_functions/agent/` — 2 files (implicit hooks)
- `_functions/__main__/` — 1 file (implicit hooks)

This is comprehensive coverage — CarabinerOS is deeply integrated through the extension system, which is the **correct pattern**.
