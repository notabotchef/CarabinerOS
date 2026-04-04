# CarabinerOS — Third-Party Integration Architecture

Created: 2026-03-24

## Overview

CarabinerOS connects to restaurant owners' existing tools (Toast, OpenTable, Square, Google, etc.) via OAuth-based MCP servers. Each integration is a Python MCP server (FastMCP) that wraps a platform's REST API and exposes it as tools Agent Zero can call.

## User Flow

```
Restaurant signs up for CarabinerOS
  → /settings/integrations — "Connect Your Tools"
  → Click "Connect Toast" → OAuth redirect → owner logs in → approves scopes
  → Tokens stored encrypted in PostgreSQL
  → MCP server uses tokens to make API calls
  → A0 can now call toast_daily_sales(), opentable_get_reservations(), etc.
  → Owner never thinks about it again
```

## Architecture

```
┌─────────────────────────────────────────────┐
│  CarabinerOS Frontend                        │
│  /settings/integrations                      │
│  Connect cards for each platform             │
└───────┬─────────────┬────────────┬───────────┘
        │ OAuth       │ OAuth      │ OAuth
        ▼             ▼            ▼
   Toast Auth    OpenTable Auth  Google Auth
        │             │            │
        ▼             ▼            ▼
┌─────────────────────────────────────────────┐
│  PostgreSQL: restaurant_integrations         │
│  location_id | platform | tokens (AES-256)  │
└──────────────────────┬──────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   Toast MCP      OpenTable MCP   Google MCP
   (FastMCP)      (FastMCP)       (FastMCP)
        │              │              │
        └──────────────┼──────────────┘
                       ▼
                  Agent Zero
```

## Token Storage

Table: `restaurant_integrations`

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| location_id | UUID | FK → locations |
| platform | enum | toast, opentable, google, square, 7shifts, clover, doordash, ubereats |
| access_token_enc | bytea | AES-256 encrypted |
| refresh_token_enc | bytea | AES-256 encrypted |
| token_expires_at | timestamp | For auto-refresh |
| scopes | text[] | What was authorized |
| connected_at | timestamp | |
| connected_by | text | Who clicked Connect |
| status | enum | active, expired, revoked |

Encryption key: `INTEGRATION_ENCRYPTION_KEY` env var. Never in the DB.

## MCP Server Pattern

Each integration is ~100-200 lines of Python:

```python
@mcp.tool()
async def toast_daily_sales(location_id: str, date: str) -> dict:
    tokens = await get_tokens(location_id, "toast")   # decrypt from DB
    tokens = await refresh_if_expired(tokens)           # auto-refresh
    resp = await httpx.get(
        "https://api.toasttab.com/orders/v2/orders",
        headers={"Authorization": f"Bearer {tokens.access_token}"},
        params={"businessDate": date}
    )
    return resp.json()
```

Shared utilities across all MCP servers:
- `get_tokens(location_id, platform)` — decrypt from DB
- `refresh_if_expired(tokens)` — auto-refresh OAuth tokens
- `store_tokens(location_id, platform, tokens)` — encrypt + store

## Platform Integration Details

### Phase 1 — No approval gates (build now)

**Square** — Full REST API, OAuth2, free, self-service
- Signup: developer.squareup.com (email only, 5 min)
- Sandbox: free, unlimited
- Read: orders, menu/catalog, inventory, invoices, labor/timecards, customers
- Write: full CRUD on everything
- Auth: OAuth2 code flow + PKCE

**7shifts** — Partner API, OAuth2, self-service
- Signup: API Terms of Use agreement + free trial account
- Read: employees, schedules, timecards, wages, labor reports
- Write: create/update employees, shifts, time punches
- Rate limit: 10 req/sec per token
- Auth: OAuth2 client credentials + bearer token

**Clover** — Developer program, auto-provisioned sandbox
- Signup: sandbox.dev.clover.com (email only)
- Read: orders, payments, inventory, customers, employees
- Write: full CRUD
- Auth: OAuth2 code flow + PKCE

**Google Suite** — One OAuth consent screen covers all
- Gmail: read invoices, vendor emails, health dept notices
- Drive: read/write spreadsheets (recipe costing, inventory)
- Calendar: events, private dining, catering bookings
- Sheets: direct read/write
- Auth: Google OAuth2

### Phase 2 — Apply now, build after approval

**Toast** — Partner certification (4-8 weeks)
- Largest US install base (~120K+ locations)
- Read: orders, menus, employees, shifts, analytics, webhooks
- Write: update menu availability, update prices, create orders
- Auth: OAuth2 client credentials (server-to-server)
- CarabinerOS use case: daily sales reports, product mix, labor summary

**OpenTable** — Partnership application
- Read: reservations, covers, guest notes, no-show rates
- Write: create/modify reservations, update guest notes
- CarabinerOS use case: daily reservations → prep planning + labor scheduling

### Phase 3 — Strategic

**DoorDash Drive** — Sandbox now, production approval pending
**Uber Eats** — Written approval required (4-12 weeks)
**Lightspeed** — Developer program enrollment
**MarketMan** — Enterprise tier only

## Build Order

1. DB migration — `restaurant_integrations` table + encryption utils
2. OAuth callback route — `/api/integrations/callback/:platform`
3. Settings page — `/settings/integrations` with connect/disconnect cards
4. Google MCP — first (most useful, zero gate, covers email+drive+calendar)
5. Square MCP — second (richest API, free, covers POS+inventory+invoices+labor)
6. Toast MCP — after partner approval (daily sales, reports)
7. OpenTable MCP — after partnership (reservations, covers)

## Legal Notes

- Browser automation (A0 browsing platforms) is viable for development/demos
- Production should use official APIs (ToS risk with automation at scale)
- Key distinction: restaurant owner authorizes access to THEIR OWN account
- Never store user passwords — only OAuth tokens
- Disclose automation methods in CarabinerOS ToS
- Consult startup lawyer before production launch (~$300-500 consultation)
