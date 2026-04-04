# Progress

## Current State (as of 2026-04-03)

**Branch:** main (clean, pushed to GitHub)
**Stack:** Next.js 16 / React 19 / TypeScript + Python 3.12 / Flask 3 / PostgreSQL 16 / Agent Zero v1.6 (submodule)
**DB:** 37 tables, 3,037 records seeded (Carabiner Tapas, March 2026)

---

## Open / Still Needs Work

- [ ] Action cards: live test — does A0 produce valid JSON in notify_user.detail, does card render rich? (requires live stack)
- [ ] CLI write commands: test end-to-end (orders create via A0 chat)
- [ ] Real-time sync: cOS doesn't get state_push when conversation started in A0 WebUI (different sessions)
- [ ] Reporting page: needs `/api/reporting/daily-pl` endpoint
- [ ] Menu 86-board: needs `/api/menu/86-board` endpoint
- [ ] A0 self-update shows "unknown" (no .git in /a0/ — cosmetic)

## Next Session Should

1. `docker compose -f docker-compose.dev.yml up` — bring stack up
2. Send "Draft a new order for Pacific Seafood for produce replenishment based on our par levels" in A0 chat
3. Verify: action card appears with title as headline, structured actions/stats visible
4. Verify: order appears in Orders page with chat_context_id, side-chat links to that conversation
5. Real-time sync: investigate why cOS misses state_push from A0 WebUI sessions
6. Add `/api/reporting/daily-pl` and `/api/menu/86-board` endpoints

---

## Architecture Decisions (summary)

- **CLI over MCP** — carabiner CLI (Typer+Rich) replaces 63 MCP tools. Saves ~14,000 tokens per A0 prompt.
- **Plugin-only A0** — CarabinerOS lives entirely in `usr/` overlay. Zero patches to A0 core.
- **A0 base image** — `FROM agent0ai/agent-zero-base:latest`. Never `python:3.12-slim`.
- **Chat context** — `chat_context_id` nullable column on all workspace models. A0 passes `--chat-context` on all writes.
- **Action cards** — A0 sends structured JSON in `notify_user.detail` (actions, stats, changes, chips). Single path via `notify_user.py`.
- **Fleet Learning** — ADR-001 approved, post-MVP. Federated ONNX router + anonymous benchmarks. Full doc: `docs/adr/ADR-001-fleet-learning-federated-intelligence.md`.

## Tech Reference

- Python venv: `/opt/venv-a0/` inside Docker (A0 base image)
- A0 submodule: `engine/agent-zero/` pinned to v1.6
- CarabinerOS plugin: `usr/plugins/carabiner/`
- CLI: `carabiner/cli/` — 8 resource modules, read + write commands
- Extensions: `usr/extensions/python/`
- DB migration: SQLAlchemy `create_all` (no Alembic versioning active)
- nginx: all A0 routes proxy to `agent-zero:80`; UUID rewrites for `/api/<resource>/<uuid>`
