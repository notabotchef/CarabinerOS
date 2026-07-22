# CarabinerOS — Post-War-Room Baseline (2026-07-22)

## Repository
- Branch: `main`
- HEAD: `60c7c053c7bce4d723cadac32c820b34a11b0d81`
- Origin: `https://github.com/notabotchef/CarabinerOS.git`
- Remote SHA: `60c7c053c7bce4d723cadac32c820b34a11b0d81` (synced)
- Ahead of origin/main: 0 commits
- Working tree: 3 uncommitted edits (README port, workspace_models dup, mcp_surface transport-security)

## Recent war-room commits (all pushed)
- `9f86555` fix(compose): raise hermes mem_limit to 2g to prevent OOM-137
- `fa509bf` fix(frontend): raise mem_limit to 2g after OOM-137 every ~30s
- `3396e33` merge war-room memlimit fix
- `60c7c05` merge war-room frontend memlimit fix

## Docker Stack (5/5 Up)
| Container | Status | Port | Mem limit |
|---|---|---|---|
| carabiner-hermes-postgres-1 | Up 12 days (healthy) | 5432 | default |
| carabiner-hermes-bridge-1 | Up 12+ min (healthy) | 8641 | default |
| carabiner-hermes-hermes-1 | Up 32 min (healthy) | 8642 | 2g |
| carabiner-hermes-nginx-1 | Up 15+ min | 8090→80 | default |
| carabiner-hermes-frontend-1 | Up 2 min | 3000 | 2g |

## /api/health
```json
{"ok": true, "runtime": "hermes", "hermes_reachable": true}
```

## Database
- Image: postgres:16-alpine
- Revision: `011_chat_context` (alembic)
- Volumes: pgdata
- Tables seeded: workspace_inventory (3), workspace_invoices (5), workspace_food_cost (3), workspace_campaigns (3), inbox_items (3), action_log (12+ rows including war-room commits)

## Hermes
- Version: bundled in carabiner-hermes image (commit 9f86555)
- Active default model: MiniMax M3 (minimax-oauth)
- Verified fallback chain:
  1. minimax-oauth / MiniMax-M3
  2. xai-oauth / grok-4.3
  3. openai-codex / gpt-5.5
  4. nous / tencent/hy3:free
- OpenRouter excluded — no key in active profile
- Config: var/hermes-home/config.yaml (backup at var/rollback/warroom-2026-07-22/config.yaml.bak)

## Bridge MCP surface
- URL: http://bridge:8641/mcp
- Tools: carabiner_read (8 resources), carabiner_propose_write (verb×resource allowlist)
- Host validation: TransportSecuritySettings added 2026-07-22 (in working tree, uncommitted) — allows `*` for demo; behind authenticated tunnel front door

## Nginx route behavior
- Public edge :8090 → carabiner-hermes-nginx → /api /socket.io /mcp /csrf_token /message_async /chats /chat_* → bridge; everything else → frontend
- 502 warm-up: first request to a Next.js page takes 5-30s for Turbopack compilation; subsequent requests ~50ms
- Cloudflare tunnel: NOT FUNCTIONAL — cloudflared reconnecting without origin cert; `https://targetrestaurant.carabineros.com/` returns HTTP 000

## Safe demo access
```bash
ssh -L 8090:127.0.0.1:8090 hermes-vps
# Operator opens http://localhost:8090
```

## Known caveats
- Cloudflare tunnel down (origin cert missing)
- Frontend 502 on first request per page during Turbopack compile (~30s)
- Pending action cards in-memory only (lost on bridge restart)
- MCP transport_security wildcard applied in dirty edit (uncommitted, pending review per SEC-002)
- README port drift (8080 → 8090, uncommitted, pending CFG-001)
- Duplicate `import sqlalchemy as sa` (uncommitted, pending DB-005)

## Evidence + rollback
- /root/carabineros-warrooom-evidence/ (7 files, 600 perms, off-container backup at /opt/carabineros-evidence/2026-07-22-warroom/ with SHA-256 manifest)
- /root/carabineros/var/rollback/warroom-2026-07-22/ (config.yaml.bak + auth.json.bak, also backed up off-container)
