# BASE-001 — Confirm Current Repository and Deployment State

**Status**: COMPLETE
**Date**: 2026-07-22T10:15:00-05:00

## Repository

- **HEAD**: `5437b5d` — "merge dashboard mock fallback"
- **Branch**: `strategic-implementation` (created from main)
- **Origin**: `https://github.com/notabotchef/CarabinerOS.git`
- **Ahead of origin/main**: 0 commits
- **Behind origin/main**: 0 commits
- **Working tree**: 1 modified file (`scripts/run_hermes_beta.sh`), 11 new untracked files (state/carabineros/*.md)
- **Remote sync**: origin/main and local main are in sync (5437b5d)
- **Branch pushed**: `strategic-implementation` pushed to origin

## Docker Stack (5/5 Up)

| Container | Image | Status | Port | Mem Limit |
|-----------|-------|--------|------|-----------|
| carabiner-hermes-postgres-1 | postgres:16-alpine | Up 12 days (healthy) | 5432 | default (0 = unlimited) |
| carabiner-hermes-bridge-1 | carabiner-hermes-bridge | Up (healthy) | 8641 | default (0 = unlimited) |
| carabiner-hermes-hermes-1 | carabiner-hermes-hermes | Up (healthy) | 8642 | 2g (2147483648 bytes) |
| carabiner-hermes-nginx-1 | nginx:alpine | Up | 8090→80 | default (0 = unlimited) |
| carabiner-hermes-frontend-1 | carabiner-hermes-frontend | Up | 3000 | 2g (2147483648 bytes) |

**Image IDs**:
- frontend: `0500c752b4be` (built 2026-07-22 09:39:52)
- bridge: `92c422821a84` (built 2026-07-22 09:39:17)
- hermes: `f1a07ab8586f` (built 2026-07-09 13:14:13)
- nginx: `54f2a904c251` (nginx:alpine)
- postgres: `57c72fd2a128` (postgres:16-alpine)

## Database

- **Image**: postgres:16-alpine
- **Version**: PostgreSQL 16.14
- **Revision**: `011_chat_context` (alembic)
- **Tables**: 42 (public schema)
- **Key tables**: action_log, alembic_version, budget_periods, daily_food_cost, daily_pl, gl_accounts, inbox_items, inventory_counts, invoices, items, locations, menu_items, order_guides, organizations, par_levels, pos_sales, prep_lists, purchase_orders, recipes, units_of_measure, vendors, workspace_campaigns, workspace_food_cost, workspace_inventory, workspace_invoices, workspace_locations, workspace_menu, workspace_orders, workspace_prep, workspace_recipes
- **Volumes**: pgdata

## Hermes

- **Version**: Bundled in carabiner-hermes image (commit 9f86555)
- **Config**: `/root/carabineros/var/hermes-home/config.yaml`
- **Active default model**: MiniMax M3 (minimax-oauth)
- **Verified fallback chain**:
  1. minimax-oauth / MiniMax-M3
  2. xai-oauth / grok-4.3
  3. openai-codex / gpt-5.5
  4. nous / tencent/hy3:free
- **OpenRouter**: Excluded (no key in active profile)
- **API server**: Enabled via env (API_SERVER_ENABLED=true, port 8642)
- **MCP**: Mounted at http://bridge:8641/mcp (2 tools: carabiner_read, carabiner_propose_write)

## Routes

- **Nginx**: `http://127.0.0.1:8090` → bridge (/api, /socket.io, /mcp, /csrf_token, /message_async, /chats, /chat_*) → frontend (everything else)
- **Bridge health**: `http://127.0.0.1:8641/api/health` → `{"ok":true,"runtime":"hermes","hermes_reachable":true}`
- **Nginx health**: `http://127.0.0.1:8090/api/health` → `{"ok":true,"runtime":"hermes","hermes_reachable":true}`
- **Hermes models**: `http://127.0.0.1:8642/v1/models` → HTTP 401 (invalid API key — expected, API server requires auth)

## Environment Variable Names (from .env)

- DATABASE_URL, ALLOWED_ORIGINS, A0_URL, NEXT_PUBLIC_A0_URL, OLLAMA_API_BASE
- CARABINER_RUNTIME, BRIDGE_PORT, HERMES_BASE_URL, HERMES_MODEL, MCP_PUBLIC_URL, AUDIT_REQUIRED
- POSTGRES_USER, POSTGRES_DB
- (Secrets: POSTGRES_PASSWORD, API_SERVER_KEY — not exposed)

## Known Failures

1. **Cloudflare tunnel**: NOT FUNCTIONAL — `https://targetrestaurant.carabineros.com/` returns HTTP 000 (origin cert missing)
2. **Frontend 502**: First request to any Next.js page takes 5-30s for Turbopack compilation; subsequent requests ~50ms
3. **Pending action cards**: In-memory only (lost on bridge restart) — RUN-001 will fix
4. **MCP transport_security**: Wildcard host validation applied in dirty edit (uncommitted, pending review per SEC-002)
5. **README port drift**: 8080 → 8090 (uncommitted, pending CFG-001)
6. **A0_URL**: Points to `http://localhost:5050` in .env (stale Agent Zero reference) — pending CFG-002
7. **Python tests**: `pytest_asyncio` not in system Python — use `.venv/bin/python -m pytest`

## Scheduled Jobs (cron)

- Daily Threads metrics backfill: `30 21 * * *` (America/Chicago)
- Daily last30days digest: `0 19 * * *`
- Digest gap watchdog: `0 */6 * * *`
- Daily prep + slots: `0 6 * * *` + 6 autopost slots
- Threads metrics poll: `0 * * *` + watchdog `15 * * *`
- Pipeline manifest: `*/15 * * *` + cron watchdog `7,22,37,52 * * *`
- ThreadHermes recovery: `31 19 * * *` (one-shot, confirmed)
- Hermes cron jobs: Amazon link research (0 7 * * *), Memory maintenance (0 6 * * *)
