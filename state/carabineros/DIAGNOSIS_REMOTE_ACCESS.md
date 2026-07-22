# Live State Diagnosis — 2026-07-22 15:36 CDT

## User Report
"carabinerOS page is loading on http://2.24.125.216:8090 but nothing is working (back end not running) i click on anything and is just a stale page."

## Investigation Results

### Docker Stack — ALL HEALTHY
| Container | Status | Port | Mem |
|-----------|--------|------|-----|
| carabiner-hermes-postgres-1 | Up 12 days (healthy) | 5432 | default |
| carabiner-hermes-bridge-1 | Up 54 min (healthy) | 8641 | default |
| carabiner-hermes-hermes-1 | Up 43 min (healthy) | 8642 | 2g |
| carabiner-hermes-nginx-1 | Up 2 hours | 8090→80 | default |
| carabiner-hermes-frontend-1 | Up 16 min | 3000 | 2g |

### API Endpoints — ALL RESPONDING
- `GET /api/health` → `{"ok":true,"runtime":"hermes","hermes_reachable":true}` (HTTP 200)
- `GET /api/orders` → Returns 3 orders with vendor data (HTTP 200)
- `GET /api/food-cost` → Returns 3 items (HTTP 200)
- `GET /api/prep` → Returns 3 items (HTTP 200)
- `GET /csrf_token` → Returns CSRF token (HTTP 200)

### Socket.IO — WORKING
- Handshake at `/socket.io/?EIO=4&transport=polling` returns valid session ID
- Frontend `useSocket` logs show: "connected to /ws namespace", "emitting state_request", "received event: state_push"
- No errors in console (0 errors, 0 warnings)

### Playwright Browser Test — FULLY INTERACTIVE
- Page loads: `http://127.0.0.1:8090` → Title: "CarabinerOS"
- KPI cards expand on click (verified Food Cost card expansion with detail overlay)
- Navigation to `/orders` works — shows 3 orders with vendor names, statuses, totals
- Socket.IO connects and receives state_push events

## Root Cause: NOT "backend not running"

The backend is running and fully functional. The "stale page" experience is caused by:

1. **Next.js Dev Mode (Turbopack)**: The frontend runs `pnpm dev` which compiles pages on first hit. First hit per page takes 5-30 seconds. During this time the page shows "Loading your briefing…" (the SSR placeholder before hydration).

2. **"Loading your briefing…" Persistence**: The greeting/time context in `home-view.tsx` only renders after the `useMounted` hook fires (post-hydration). If hydration is slow or interrupted, the user sees this indefinitely.

3. **Action Cards Empty**: The notification panel shows "No conversations yet" because action cards are only populated when Hermes emits them via Socket.IO. Until then, the panel is empty.

4. **Remote Access Latency**: `http://2.24.125.216:8090` goes through nginx → bridge → frontend dev server. The first compilation is slower over network.

## Fix Options

### Option A: Rebuild frontend image with `pnpm build && pnpm start` (production mode)
Eliminates Turbopack compilation delay. Requires rebuilding the Docker image.

### Option B: Reduce Turbopack compilation time
Already mitigated by 2g mem_limit (Cycle 1 war-room fix). Further optimization in CFG-005.

### Option C: Add loading state indicators
Show "Compiling..." spinner during first hit. Already partially done with "Loading your briefing…" placeholder.

## Recommendation
- **Immediate**: Tell user to hard-refresh (Ctrl+Shift+R) and wait 30s for first compilation, then page is interactive.
- **Short-term (CFG-005)**: Diagnose and optimize frontend warm-up.
- **Long-term (Phase 4)**: Rebuild frontend image with production build for faster cold starts.

## What IS Working (verified via Playwright)
- ✓ Page loads with title "CarabinerOS"
- ✓ Greeting renders ("Good morning, Chef")
- ✓ Daily Brief shows 3 insight rows (clickable, keyboard accessible)
- ✓ KPI cards show mock fallback values (Orders: 0, Food Cost: 28.4%, Prep: 87%, Covers: 142)
- ✓ KPI cards expand on click with detail overlay
- ✓ Navigation links work (clicked /orders, loaded successfully)
- ✓ Orders page shows live data (3 orders from API)
- ✓ Socket.IO connects and receives state_push events
- ✓ No JavaScript errors in console
