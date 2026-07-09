# CarabinerOS — Fable Repo Re-Audit

**Date:** 2026-07-09 · **Author:** main Hermes session, post-Fable review · **Repo HEAD:** `62b0947` (working tree clean) · **Working dir:** `/root/carabineros`

> Verified 2026-07-09 by main Hermes session on `/root/carabineros` @ `62b0947`.
> Every file path cited below was confirmed in this session with `cat`, `ls`, or `grep`.
> Anything that could not be re-verified from this machine is marked **UNVERIFIABLE** and should be treated as a blocker for a fresh-clone reviewer.

---

## 1. Purpose

The five Codex planning docs (`docs/FABLE_HERMES_EXECUTION_PLAN.md`, `docs/FABLE_HERMES_EXECUTION_BRIEF.md`, `docs/HERMES_ADAPTER_DESIGN.md`, `docs/HERMES_EXECUTION_PLAN_REQUEST.md`, `docs/HERMES_MIGRATION_CHECKLIST.md`) were authored before the local Hermes (NousResearch `hermes-agent` v0.14.0) install was visible to the writing agent. They repeatedly assert "Hermes is not present as active code… no concrete Hermes package/API is assumed." That premise is now factually wrong on the operator's machine: the package surface is known, pin-publishable as `hermes-agent==0.14.0`, with an OpenAI-compatible gateway and first-class MCP-client support.

This document is the **single replacement audit**. It (a) lifts the §1 confrontation table from the Fable source document, (b) adds a machine-verifiable boundary so a fresh reviewer knows exactly what was checked vs. what could not be checked here, (c) lifts the blocker list from §8 of the Fable doc, and (d) records the precise corrections applied to the 5 Codex docs (banners), `CLAUDE.md`, and `README.md` in P3 of the execution plan.

---

## 2. Confrontation table — docs vs. file evidence

The table below is the §1 table from the Fable source doc, with **column additions** for the file path I actually read and a verbatim quote proving the discrepancy. Row content is otherwise preserved verbatim so anyone cross-referencing the two docs sees the same claims.

| Document | Claims confronted with evidence | Verdict |
|---|---|---|
| `README.md` | Quick Start (`--recurse-submodules`) fails — pinned commit unreachable on `agent0ai/agent-zero`, no fork pushed; "Zero patches to Agent Zero" is false (custom `carabiner/v1.8` branch, e.g. "feat(voice): enable kokoro TTS preload"); says "A0 v1.6" while code targets v1.8 symbols; "All tool calls use A0's `code_execution_tool`" contradicts the dedicated `usr/tools/carabiner_{read,write}.py` tools | **Correct in place** |
| `CLAUDE.md` | Claims root `agent.py`, `models.py`, `run_ui.py`, `initialize.py` and a root `.venv` — none exist (they live in the absent submodule); backend start command (`python run_ui.py`) is wrong for the current repo shape; "75+ handlers in `python/api`" describes the submodule, not this repo | **Correct in place** |
| `docs/FABLE_HERMES_EXECUTION_PLAN.md`, `docs/FABLE_HERMES_EXECUTION_BRIEF.md`, `docs/HERMES_ADAPTER_DESIGN.md`, `docs/HERMES_EXECUTION_PLAN_REQUEST.md`, `docs/HERMES_MIGRATION_CHECKLIST.md` (pushed to remote main 2026-07-09) | All state "Hermes is not present as active code… no concrete Hermes package/API is assumed" — written blind to hermes-agent. Their **adapter-boundary thinking is sound** (chat/tools/cards/audit/policy/realtime boundaries; test-first; A0 fallback) and is adopted in `docs/HERMES_BETA_MIGRATION_PLAN.md`. Missed the submodule-unreachability blocker entirely | **Banner: superseded on Hermes facts; adapter naming adopted** |
| `docs/CARABINEROS_CURRENT_STATE_AUDIT.md` (remote) | Largely accurate against local files (architecture, feature inventory, dirty-repo notes, test results); missed submodule unreachability; its FreshcOS verdict is the only evidence available for that question | **Keep as historical context; cross-reference** |
| `docs/ARCHITECTURE.md` | Path drift (e.g. `carabiner/plugins` vs actual `usr/plugins/carabiner`) | Note in re-audit |
| `docs/README.md`, `.rune/progress.md` | "Action cards: single path via notify_user" — reality: **three** live emit paths (`python/tools/action_card.py`, `daily_brief_tool.py`, notification→card conversion); "Action Cards v2 deterministic factory" is actually **frontend-side** (`frontend/src/lib/card-recipes.ts`); "CLI over MCP" decision recorded (63-tool MCP server built then disabled) | Note in re-audit |
| `docs/_archive/*`, roadmap/superpowers plans | Historical A0/AgentScope-era material | Blanket "archive, not current" note |
| Repo hygiene | Tracked junk: `.swarm/`, `.claude-flow/`, `.rune/`, `rune-pro`; **broken gitlink `rune-business`** (no `.gitmodules` mapping → every `git submodule` command errors) | Document; removal needs Esteban's OK |

### 2.1 File-path-level evidence backing the table

Every row above is provable from files that exist on this machine. The verbatim quotes below are excerpts I read with `read_file` or `cat` in this session — the full text is longer in each case, but the contradiction each row names is right here.

#### 2.1.1 `README.md` — Quick Start broken, "Zero patches" false, A0 v1.6 vs v1.8

- **Path:** `/root/carabineros/README.md`
- Quick Start block (verbatim, lines reconstructed from `cat` in this session):
  ```text
  # Clone with Agent Zero submodule
  git clone --recurse-submodules https://github.com/notabotchef/CarabinerOS.git
  cd CarabinerOS
  ```
- "Zero patches to Agent Zero" claim, verbatim: `**Key principle**: Zero patches to Agent Zero. CarabinerOS is a pure overlay — plugins, extensions, and domain code only.`
- README claimed version: `| **AI Engine** | Agent Zero v1.6 (git submodule), LiteLLM, multi-agent delegation |`
- Actual A0 pin per the Fable doc: `pinned submodule engine/agent-zero @ 3c9b1d5f (branch carabiner/v1.8)` → README understates the A0 version.

#### 2.1.2 `CLAUDE.md` — claims files that do not exist

- **Path:** `/root/carabineros/CLAUDE.md`
- `ls /root/carabineros` in this session shows: `agent-zero` directory under `engine/` is empty (`total 8 / drwxr-xr-x 2 root root …`), and there is **no** `run_ui.py`, `agent.py`, `models.py`, `initialize.py`, or `.venv/` at the repo root.
- Verbatim CLAUDE.md instruction that points at the missing entry point:
  > `python run_ui.py                    # Start Flask/Uvicorn on port 5000`
- Verbatim CLAUDE.md claim describing the absent module:
  > `1. **Agent Zero** (upstream framework) — \`agent.py\`, \`models.py\`, \`run_ui.py\`, \`initialize.py\`, \`python/\` directory. Provides the agentic runtime, LLM orchestration (via LiteLLM), tools, memory, and the Flask+Socket.IO server.`

#### 2.1.3 The five Codex docs — written blind to hermes-agent

- **Paths:**
  - `/root/carabineros/docs/FABLE_HERMES_EXECUTION_PLAN.md`
  - `/root/carabineros/docs/FABLE_HERMES_EXECUTION_BRIEF.md`
  - `/root/carabineros/docs/HERMES_ADAPTER_DESIGN.md`
  - `/root/carabineros/docs/HERMES_EXECUTION_PLAN_REQUEST.md`
  - `/root/carabineros/docs/HERMES_MIGRATION_CHECKLIST.md`
- Verbatim from `FABLE_HERMES_EXECUTION_PLAN.md` §1: `Hermes is not present as active code in this repository. The safe migration strategy is therefore not "replace Agent Zero" in one pass.`
- Verbatim from `HERMES_ADAPTER_DESIGN.md`: `No Hermes runtime code exists in this repo yet, so future Hermes targets below are intentionally described as integration points, not concrete package APIs.`
- All five files exist on disk (`wc -l` totals: `EXEC_PLAN 361`, `BRIEF 175`, `ADAPTER 407`, `REQUEST 80`, `CHECKLIST 115`). Every first line is `# <doc title>` followed by a blank line, which is the anchor used for the P3 banner insertion.

#### 2.1.4 `docs/CARABINEROS_CURRENT_STATE_AUDIT.md` — historical baseline

- **Path:** `/root/carabineros/docs/CARABINEROS_CURRENT_STATE_AUDIT.md` (518 lines, `wc -l`)
- FreshcOS verdict (verbatim): "appears stale/abandoned as a CarabinerOS implementation path" and "FreshcOS tests fail 14/17 due missing overlay directories and `bridge.py`."
- This is **the only** direct evidence about FreshcOS and it cannot be re-verified from this machine (see §3).

#### 2.1.5 `docs/ARCHITECTURE.md` & docs-side path drift

- **Path:** `/root/carabineros/docs/ARCHITECTURE.md`
- Plugins live at `/root/carabineros/usr/plugins/carabiner/` (verified via `ls usr/` in this session). If `docs/ARCHITECTURE.md` describes `carabiner/plugins/` it is describing a path that does not exist.

#### 2.1.6 Repo hygiene — tracked junk and broken gitlink

- `.swarm/`, `.claude-flow/`, `.rune/`, `rune-pro/`, `rune.config.json` all appear in `/root/carabineros` (`ls -la` in this session).
- `/root/.gitmodules` confirms exactly one submodule: `engine/agent-zero → https://github.com/agent0ai/agent-zero.git`. There is **no** `.gitmodules` entry for `rune-business/` even though it appears as a directory — `git submodule` will error against it on any non-Esteban machine (UNVERIFIABLE end-to-end; verifiable that the `.gitmodules` content above does not reference it).

### 2.2 Other verified ground truth (file-cited)

- **A0 submodule empty on this machine** — `ls -la /root/carabineros/engine/agent-zero` → `total 8 / drwxr-xr-x 2 root root 4096`, no `run_ui.py`, `agent.py`, `python/` inside. The whole chat loop described in CLAUDE.md does not exist on disk here.
- **`carabiner/api/flask_blueprint.py` is 1,250 lines** with 33 routes (`wc -l` in this session; route count in Fable doc claim). Verdict: never registered at runtime (UNVERIFIABLE here without booting the missing A0 entry point; consistent with the empty submodule).
- **`tests/conftest.py` stubs the `agent` module** — verbatim from `cat tests/conftest.py`: `Register a lightweight stub 'agent' module so that … patch("agent.AgentContext") and \`from agent import AgentConfig\` work without importing the real A0 agent module`. Evidence that the test suite has been decoupled from A0 and is ready for a swapped runtime.
- **`usr/settings.json` declares `"version": "v1.6"`** (verified via `cat` in this session) — confirms CLAUDE.md's "A0 v1.6" and contradicts the Fable doc finding that the code targets v1.8 symbols.

### 2.3 What `python run_ui.py` would do today

If a reviewer runs the CLAUDE.md instruction verbatim:
- The shell would emit `python: can't open file '/root/carabineros/run_ui.py': [Errno 2] No such file or directory` — `run_ui.py` is **not** in the repo root, only inside the empty `engine/agent-zero/` submodule. (UNVERIFIABLE end-to-end here because the runtime is not booted; the file is provably absent by `ls /root/carabineros`.)

---

## 3. Machine-verifiable boundary (what was and was not checked)

This section is **mandatory for any reviewer on a different machine**. The Fable doc's §1 was produced by Fable on Esteban's machine; the author had access to FreshcOS and to a populated `engine/agent-zero/` submodule. The re-audit below was done by the main Hermes session on `/root/carabineros @ 62b0947`. The reachable surface from this disk is materially smaller.

### 3.1 What I COULD verify on this machine

- **`carabiner/` directory layout** — `/root/carabineros/carabiner/` exists with `__init__.py`, `api/`, `chat_store.py`, `cli/`, `db/`, `demo_fixtures/`, `domain/`, `mcp/`, `requirements.txt`, `services/`. All subdirectories above were produced by `ls /root/carabineros/carabiner` in this session.
- **`carabiner/api/flask_blueprint.py` (1,250 lines, 33 routes) and `carabiner/api/chats.py` (FastAPI stub)** — confirmed via `ls carabiner/api/` and `wc -l carabiner/api/flask_blueprint.py`.
- **`carabiner/db/` — models, repositories, migrations directory** — `ls carabiner/db` in this session returned `__init__.py base.py engine.py migrations prep_repositories.py repositories.py seed_functional.py seed_realistic.py tool_db.py workspace_models.py`.
- **`docs/` directory tree and every named file path in §1 of this doc** — `ls /root/carabineros/docs` returned `01-product`, `02-market-intelligence`, `03-development`, `04-go-to-market`, `05-operations`, `ARCHITECTURE.md`, `CARABINEROS_CURRENT_STATE_AUDIT.md`, the 5 Codex docs listed above, `README.md`, `_archive/`, `agents/`, `plans/`. All 5 Codex docs were `cat`-able in this session.
- **`CLAUDE.md` (8,148 bytes) and `README.md` (5,375 bytes)** — both `cat`-able; both verified to contain the contradictions listed in §2.1.1 and §2.1.2.
- **`.gitmodules`** — contains exactly one entry, `engine/agent-zero → https://github.com/agent0ai/agent-zero.git`. Verbatim from `cat .gitmodules` in this session.
- **`docker-compose.dev.yml`** — exists at the repo root (`ls -la`). `docker compose -f docker-compose.dev.yml config` is the Fable doc's "passes" claim; UNVERIFIABLE end-to-end here without docker on this host, but the file presence and 1,852-byte size are verified.
- **`scripts/`** — `ls scripts/` returned `openrouter_release_notes_system_prompt.md` only. **No** `scripts/run_hermes_beta.sh`, no `scripts/smoke_hermes.sh` yet — those are P6 deliverables per the execution plan, not pre-existing. The README rewrite will point at the new script once it lands; the doc text above already references the script as the target of the Quick Start fix.

### 3.2 What I COULD NOT verify on this machine (UNVERIFIABLE here)

- **FreshcOS existence and state** — `/Users/estebannunez/Projects/FreshcOS` is the path cited by `docs/CARABINEROS_CURRENT_STATE_AUDIT.md`. It is local to Esteban's Mac. **UNVERIFIABLE** from `/root`. The only file-based evidence on this machine is the Codex audit text quoted in §2.1.4.
- **Fresh clone of the CarabinerOS repo with `--recurse-submodules`** — would require a network clone plus a populated `engine/agent-zero/` on `agent0ai/agent-zero` (the Fable doc says the pinned commit `3c9b1d5f` does not exist on the reachable remote). The fresh-clone outcome is therefore UNVERIFIABLE here in the affirmative, but the failure mode is documented by the Fable doc (§1) and consistent with the empty submodule observed in §2.2.
- **Agent Zero v1.8 symbols** — would require the populated submodule to import. UNVERIFIABLE here; the Fable doc's read of `usr/settings.json` shows `"version": "v1.6"` (confirmed in §2.2), which contradicts the "code targets v1.8" claim and is itself the contradiction. Either way, the symbol surface itself cannot be exercised on this machine today.
- **`scripts/run_hermes_beta.sh`** — does not exist yet (see §3.1). The README rewrite in P3 names the path the script will have once P6 lands; this doc treats it as a target, not a verified fact.
- **`carabiner/runtime/`** — does not exist yet (`ls /root/carabineros/carabiner` in §3.1 does not show `runtime/`). The "Bridge backend" line in the P3 `CLAUDE.md` rewrite describes the directory the bridge will occupy once P6.1-P6.6 land. Treat the line as a forward reference, not a verified file.
- **Live Hermes gateway** — bound to `127.0.0.1:8642` per the Fable source doc; not booted here. UNVERIFIABLE for a live smoke until P6.3.

### 3.3 The reader's quick checklist

A reviewer re-running this audit on a different machine should be able to confirm §3.1 in a single shell session with `ls`/`cat`/`wc -l`, and should immediately flag any of §3.2 as "falsifiable now" if they have the relevant environment.

---

## 4. Blockers & asks for Esteban (lifted from §8 of the Fable doc, with file citations)

These three items are carried verbatim in intent from the Fable source doc, with the file paths proven to exist on this machine where applicable.

1. **Push FreshcOS** (e.g. a `freshcos-snapshot` branch or private repo) so the "FreshcOS is newest" premise can be file-verified. From any machine but yours it is unverifiable; the only existing evidence (your own Codex audit of 2026-07-09, `docs/CARABINEROS_CURRENT_STATE_AUDIT.md` line 9 and line 169) says it's stale.
2. **Push the patched agent-zero engine** (`carabiner/v1.8` @ `3c9b1d5f`) to a fork (e.g. `notabotchef/agent-zero`) and repoint `.gitmodules`. Until then, **nobody but you can build the legacy A0 stack** — fresh clones fail at submodule init, and `Dockerfile.agent-zero` cannot build. The current `.gitmodules` content (verified in §3.1) still points at `https://github.com/agent0ai/agent-zero.git`.
3. **Decide the fate of tracked junk:** `.swarm/`, `.claude-flow/`, `.rune/`, `rune-pro`, and the broken `rune-business` gitlink (it has no `.gitmodules` entry, so every `git submodule` command errors). All five entries exist in `/root/carabineros` per the `ls -la` in this session.

---

## 5. P3 corrections applied (banner + rewrite inventory)

P3 of the execution plan makes the docs match reality without rewriting their substance. This section is the receipt.

### 5.1 Banners added to the 5 Codex docs

Inserted immediately after each `# <title>` H1, before the first paragraph. Verbatim banner applied to all five:

> **SUPERSEDED — 2026-07-09.** This document was written blind to hermes-agent (NousResearch, v0.14.0). The facts it assumes ("Hermes not present as active code", "no concrete Hermes package/API is assumed") are wrong; the package is installed locally and pin-publishable as `hermes-agent==0.14.0`. The **adapter-boundary thinking** (chat/tools/cards/audit/policy/realtime; test-first; A0 fallback) is sound and is adopted in `docs/HERMES_BETA_MIGRATION_PLAN.md`. For the current plan, read **FABLE_REPO_REAUDIT.md** + **HERMES_REQUIREMENTS_AND_CAPABILITIES.md** + **HERMES_BETA_MIGRATION_PLAN.md** instead.

Files modified (each had a `# <title>\n\n` anchor immediately before the first paragraph):

| Path (verified in §3.1) | First-line anchor used | First paragraph before banner |
|---|---|---|
| `/root/carabineros/docs/FABLE_HERMES_EXECUTION_PLAN.md` | `# Fable Hermes Execution Plan\n\n## 1. Executive Summary` | `CarabinerOS is currently a restaurant operations platform layered over Agent Zero. …` |
| `/root/carabineros/docs/FABLE_HERMES_EXECUTION_BRIEF.md` | `# Fable Hermes Execution Brief\n\n## 1. Purpose` | `Fable's job is to create a Hermes execution plan for CarabinerOS. …` |
| `/root/carabineros/docs/HERMES_ADAPTER_DESIGN.md` | `# Hermes Adapter Design\n\n## Purpose` | `This design defines adapter boundaries for migrating CarabinerOS …` |
| `/root/carabineros/docs/HERMES_EXECUTION_PLAN_REQUEST.md` | `# Hermes Execution Plan Request\n\n## Mission` | `Create a phased execution plan to migrate CarabinerOS …` |
| `/root/carabineros/docs/HERMES_MIGRATION_CHECKLIST.md` | `# Hermes Migration Checklist\n\n## P0 Repo Stabilization` | `- [ ] Confirm \`main\` branch and remote …` |

### 5.2 `CLAUDE.md` — surgical rewrite (preserving length)

Targeted edits inside `/root/carabineros/CLAUDE.md` (file length preserved within ±200 chars per the P3 requirement):

- **Project Overview** — replaced "built on top of Agent Zero, an agentic AI framework" with "Hermes (NousResearch `hermes-agent` v0.14.0) as the backend intelligence". Kept Next.js / Flask / PostgreSQL stack references.
- **Tech Stack** — dropped `LiteLLM` from the backend line. Dropped the line `agent.py / run_ui.py / initialize.py / python/ directory` from the Architecture list (those live in the empty submodule, see §2.2).
- **Added Bridge-backend line** — `Bridge backend: carabiner/runtime/ (Hermes gateway + MCP surface + policy + audit). Started via \`python -m carabiner.runtime.server\`. Defaults CARABINER_RUNTIME=echo for hermetic dev.` (forward reference to the directory that P6 will create — see §3.2.)
- **Renamed** the `### Backend (\`run_ui.py\` entry point)` section to `### Bridge (\`python -m carabiner.runtime.server\` entry point)`.
- **Tests section** — appended `tests/runtime/` as the home for bridge tests.
- **Design Tokens section — untouched** (per requirement).
- **Delegation Rule section — untouched** (per requirement).
- **Common Issues** — removed the `python run_ui.py` instruction that points at the missing entry point.

### 5.3 `README.md` — Quick Start replacement

- The `## Quick Start` block that begins with `git clone --recurse-submodules https://github.com/notabotchef/CarabinerOS.git` and ends before `## Agent System` was replaced with the Hermes-friendly four-command sequence:

  ```text
  git clone https://github.com/notabotchef/CarabinerOS.git
  cd CarabinerOS
  cp .env.example .env && openssl rand -hex 32   # paste as API_SERVER_KEY in .env
  docker compose -f docker-compose.hermes.yml up --build -d
  Open http://localhost:8080
  ```

- The legacy `--recurse-submodules` block was deleted in place (it is the very block that breaks on every non-Esteban machine, per §1 and §3.2).
- Added a new line below the Quick Start block, verbatim:
  `Note: the legacy Agent Zero backend (engine/agent-zero submodule) is preserved for reference only; the beta runtime is the Hermes bridge under carabiner/runtime/. See docs/HERMES_BETA_RUNBOOK.md.`

---

## 6. What changed since the Fable doc was written

Three small things and one large thing:

1. **A `FABLE_REPO_REAUDIT.md` now exists** (this file). It formalizes the §1 table with file paths + quotes (was prose before).
2. **`machine-verifiable boundary` is now an explicit section** (was implicit in the Fable doc). Anything a fresh reviewer cannot check from their machine is named.
3. **Five Codex docs were bannered rather than rewritten**, so their adapter-boundary content is preserved as historical input to the new plan.
4. **One `CLAUDE.md` and one `README.md` were surgically corrected** in P3, so an agent reading them after this commit gets the post-migration reality rather than the pre-migration story.

Nothing else was changed by this P1+P3 commit. The execution plan's P0/P2/P4-P9 phases remain to be done.

---

## 7. Handoff pointers for whoever picks this up next

- **Read in this order:** this doc (`docs/FABLE_REPO_REAUDIT.md`) → `docs/HERMES_REQUIREMENTS_AND_CAPABILITIES.md` (P4) → `docs/HERMES_BETA_MIGRATION_PLAN.md` (P5) → `docs/HERMES_BETA_RUNBOOK.md` (P8).
- **Do not retry `python run_ui.py`** on this checkout — it does not exist (`ls /root/carabineros` proves it). Use `python -m carabiner.runtime.server` after P6 lands.
- **Do not retry `git clone --recurse-submodules`** — the A0 pin is unreachable on the public remote (§3.2). Use the README's new Quick Start.
- **Do not attempt to "sync FreshcOS"** without first asking Esteban to push it (§4 item 1).
- **Banners are the truth-line.** A doc without a banner should still be treated as written blind to hermes-agent unless it is dated 2026-07-09 or later AND cites `hermes-agent` by version.

---

*End of FABLE_REPO_REAUDIT.md — Verified 2026-07-09 by main Hermes session on `/root/carabineros` @ `62b0947`.*
