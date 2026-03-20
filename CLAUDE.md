# CarabinerOS

AI-powered restaurant operations platform built on Agent Zero.

## Architecture

- **Back of House (BOH):** Agent Zero — Flask + Socket.IO on port 5000. Runs AI agents, tools, LLM.
- **Front of House (FOH):** Next.js — React app on port 3000. The Expo Station UI.
- **Database:** PostgreSQL via async SQLAlchemy + Alembic migrations.

## Critical Rule

**Never modify Agent Zero core files** (`agent.py`, `python/`, `run_ui.py`, `initialize.py`, `webui/`).
All customization goes in:
- `usr/` — Agent overlay (tools, agent profiles, extensions)
- `carabiner/` — Domain layer (API, database, protocols)
- `frontend/` — Next.js app

## How to Run

Terminal 1 — Postgres:
    docker compose -f docker-compose.dev.yml up

Terminal 2 — Agent Zero (BOH):
    python run_ui.py

Terminal 3 — Next.js (FOH):
    cd frontend && pnpm dev

Visit http://localhost:3000

## LLM Configuration

In `usr/.env` — use `ollama` provider with local models:

    A0_SET_chat_model_provider=ollama
    A0_SET_chat_model_name=glm-4.7-flash:latest
    A0_SET_chat_model_api_base=http://host.docker.internal:11434

Note: Inside Docker, use `host.docker.internal` (not `localhost`) to reach Ollama on the host.

## Tech Stack

- Agent Zero (Python/Flask/Socket.IO) — MIT licensed
- Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui
- PostgreSQL 16, SQLAlchemy (async), Alembic
- socket.io-client for frontend ↔ Agent Zero communication
- Ollama (dev) / Cloud LLM APIs (prod) via litellm

## Upstream Updates

    git fetch upstream
    git merge upstream/main

## Security

- Never commit secrets, API keys, or credentials to git
- Never run destructive commands without explicit confirmation
- Validate all external input at system boundaries
- Use parameterized queries for database operations

## Build & Test

Build: `npm run build`
Test: `npm test`

Run tests before committing. Run the build to catch type errors.

## Ruflo Integration

Ruflo is registered as an MCP server and available in every session. Use these proactively:

- `mcp__ruflo__memory_search` — Search persistent cross-session knowledge before researching from scratch
- `mcp__ruflo__memory_store` — Store non-obvious fixes and insights after solving problems
- `mcp__ruflo__hooks_post-task` — Record task completion to feed the learning system
- `mcp__ruflo__hooks_session-end` — Run at session end to persist state
- `mcp__ruflo__analyze_diff` — Risk-assess changes before committing
- `mcp__ruflo__hooks_intelligence` — Check learning status at session start
- `mcp__ruflo__hive-mind_spawn` — Spawn coordinated worker agents for complex tasks
- `mcp__ruflo__task_create` / `mcp__ruflo__task_list` — Track work items

Read `docs/plans/ruflo-integration-playbook.md` for the full capability map.

## Workflow Rules

1. **Session start** — At the beginning of every conversation, start the ruflo daemon (`npx ruflo@latest daemon start`), read `docs/plans/open-work.md`, and greet with a summary of open items and recommended next steps.
2. **Commit on fix** — Commit immediately after every working fix. Don't batch changes.
3. **Check before rewriting** — Always read the current file with `git diff` before rewriting. Never break previously working features.
4. **Session end** — When the user says goodbye, `/exit`, or "that's it": run ruflo session-end hooks, stop the ruflo daemon (`npx ruflo@latest daemon stop`), update `docs/plans/open-work.md` with any new open items, and commit uncommitted work.
5. **Design-first frontend** — Always invoke `/frontend-design`, `/shadcn`, and `/web-design-guidelines` skills before any UI work.
6. **Never modify Agent Zero core** — All changes go in `usr/`, `carabiner/`, or `frontend/`.
7. **Use ruflo first** — Use ruflo (swarm, hive-mind, tasks, memory) as primary orchestration. Never double-dispatch with Claude Code agents.
8. **Chef delegation** — If it's ≤30 lines and the fix is clear, do it yourself (reach-in). If it needs research, touches multiple files, or the solution is uncertain, spawn an autonomous agent in an isolated worktree (walk-in). Never leave the line to go to the walk-in yourself.
9. **Don't restart during test** — Never restart Docker services, change models, or modify config while the user is actively testing in the browser. Wait for their feedback first.
10. **Worktree isolation** — Agents that edit code MUST work in isolated worktrees on their own branch. Verify isolation before letting them edit. Stash or commit current work before spawning editing agents.
11. **A0 debug skill** — Always invoke the `/a0-debug` skill when debugging Agent Zero ↔ frontend communication issues.
