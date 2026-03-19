# Agent Zero ↔ Frontend Streaming Fix

**Date:** 2026-03-19
**Branch:** `fix/a0-frontend-streaming` (off `feat/homepage-redesign`)
**Status:** Proposed

## Problem

Agent Zero receives user messages and generates responses (visible in docker logs), but responses never stream to the Next.js frontend chat UI. The root cause is a WebSocket origin mismatch:

- Next.js runs on `localhost:3000`, Agent Zero on `localhost:5000`
- The Socket.IO client defaults to same-origin (`localhost:3000`), which is the Next.js server — not Agent Zero
- If `NEXT_PUBLIC_A0_URL` is set to point directly at Agent Zero, the `validate_ws_origin()` check in `python/helpers/websocket.py` rejects the connection because `Origin: http://localhost:3000` doesn't match `Host: localhost:5000`
- Next.js `rewrites()` only proxy REST endpoints, not WebSocket upgrades

## Solution: Nginx Dev Proxy

Add an nginx reverse proxy as a Docker service that presents a single origin to the browser, routing traffic to the correct backend.

### Architecture

```
Browser (localhost:8080)
    │
    ▼
┌─────────────────────────┐
│  nginx (:8080)          │
│                         │
│  /socket.io/*  → :5000  │  (Agent Zero WebSocket + polling)
│  /csrf_token   → :5000  │  (CSRF handshake)
│  /message*     → :5000  │  (Chat REST API)
│  /chats        → :5000  │  (Chat list API)
│  /chat_*       → :5000  │  (Chat management API)
│  /api/*        → :5000  │  (Workspace REST API)
│  /a0/*         → :5000  │  (Agent Zero built-in UI)
│  /*            → :3000  │  (Next.js frontend)
└─────────────────────────┘
```

### Why This Works

- Browser origin = `http://localhost:8080`
- WebSocket `Host` header = `localhost:8080`
- `validate_ws_origin()` sees origin and host both at `localhost:8080` → match
- CSRF cookies set with `SameSite=Strict` work because everything is same-origin
- No Agent Zero core files modified

## Changes

### 1. `nginx.dev.conf` (new file, project root)

Nginx configuration that:
- Listens on port 8080
- Proxies `/socket.io/` to Agent Zero with WebSocket upgrade headers
- Proxies Agent Zero REST routes (`/csrf_token`, `/message_async`, `/message`, `/chats`, `/chat_load`, `/chat_create`, `/api/*`, `/a0/*`)
- Proxies everything else to Next.js
- Sets `X-Forwarded-Host`, `X-Forwarded-Proto` headers

### 2. `docker-compose.dev.yml` (modify)

Add nginx service:
- Image: `nginx:alpine`
- Port: `8080:8080`
- Mounts `nginx.dev.conf`
- Depends on: postgres
- **Dev workflow:** Postgres + nginx run in Docker; Agent Zero and Next.js run on the host (`python run_ui.py` and `pnpm dev`). The nginx config uses `host.docker.internal` to reach host services.

### 3. `frontend/next.config.ts` (optional cleanup)

The Next.js rewrites for `/csrf_token`, `/message_async`, etc. can be kept for direct-access dev mode (`localhost:3000`) or removed since nginx handles routing. Keeping them is safer for backwards compatibility.

### 4. No frontend code changes

- `socket-client.ts` defaults to `""` (same-origin) which is correct through the proxy
- `use-socket.ts` remains unchanged
- CSRF flow unchanged

## Security

- **No `cors_allowed_origins="*"`** — origin validation stays strict
- **No core file modifications** — `validate_ws_origin()` and `run_ui.py` untouched
- **CSRF protection intact** — same-origin cookies work naturally
- **Session cookies** — `SameSite=Strict` works because browser sees single origin
- **WebSocket upgrade** — nginx passes through upgrade headers securely
- **Origin passthrough** — `proxy_set_header Origin $http_origin` in the `/socket.io/` block is load-bearing; it preserves the browser's original Origin so `validate_ws_origin()` can match it against the forwarded host. Removing or rewriting this header would break the fix.

## Test Plan

### Automated Tests

1. **`tests/test_nginx_proxy_routing.py`** — Verify nginx routes `/socket.io/` to A0 and `/` to Next.js
2. **`tests/test_websocket_origin_via_proxy.py`** — Verify `validate_ws_origin()` accepts connections when origin matches host through proxy
3. **`tests/test_e2e_chat_streaming.py`** — Full round-trip: send message via `/message_async`, verify `state_push` event arrives with `response`-type log entry

### Manual Smoke Test

1. Start Postgres: `docker compose -f docker-compose.dev.yml up`
2. Start Agent Zero: `python run_ui.py`
3. Start Next.js: `cd frontend && pnpm dev`
4. Open `http://localhost:8080`
5. Send a message, confirm response streams into the chat
6. Model: ollama qwen2.5:9b

## LLM Configuration

Tests run against local ollama with `qwen2.5:9b`:

```env
A0_SET_chat_model_provider=ollama_chat
A0_SET_chat_model_name=qwen2.5:9b
A0_SET_chat_model_api_base=http://localhost:11434
```

## Out of Scope

- Production deployment (production uses nginx anyway per `socket-client.ts` comments)
- Multi-user authentication
- WebSocket compression/optimization
- Changes to Agent Zero core files
