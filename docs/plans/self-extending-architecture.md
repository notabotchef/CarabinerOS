# CarabinerOS — Self-Extending Plugin Architecture

Created: 2026-03-24

## Vision

A0 can create new integrations at runtime — writing MCP servers, manifests, and tool definitions — without any developer touching React code or deploying new builds. The frontend dynamically discovers and renders whatever A0 has built. CarabinerOS evolves itself.

## The Problem

When A0 creates `mcp_tock.py` at 2am, how does CarabinerOS show Tock data in the UI at 7am without a developer writing React components?

## Solution: Plugin Manifest + Dynamic UI

Every integration A0 creates includes a manifest that describes its capabilities. The frontend reads manifests and renders widgets dynamically.

### Plugin Directory Structure

```
usr/plugins/
  mcp_tock/
    server.py          # FastMCP server (the actual integration)
    manifest.json      # Describes capabilities, UI presence, auth
    tests/             # A0-generated integration tests
  mcp_lightspeed/
    server.py
    manifest.json
    tests/
```

### Manifest Schema

```json
{
  "id": "tock",
  "name": "Tock Reservations",
  "icon": "calendar",
  "status": "active",
  "version": "1.0.0",
  "created_by": "a0",
  "created_at": "2026-03-25T02:15:00Z",
  "capabilities": [
    {
      "id": "reservations",
      "label": "Reservations",
      "type": "list",
      "summary_widget": {
        "metric": "total_covers",
        "label": "Covers Tomorrow",
        "module": "dashboard"
      },
      "tools": ["tock_get_reservations", "tock_get_covers"],
      "refresh": "15m"
    },
    {
      "id": "guest_notes",
      "label": "Guest Notes",
      "type": "detail",
      "tools": ["tock_get_guest_notes"],
      "queryable": true,
      "natural_language_examples": [
        "any allergies for tomorrow?",
        "who's coming in tonight?",
        "VIP tables this week?"
      ]
    }
  ],
  "settings": {
    "auth_type": "oauth2",
    "auth_url": "https://app.exploretock.com/oauth/authorize",
    "scopes": ["reservations:read", "guests:read"]
  }
}
```

### Frontend Dynamic Rendering

The dashboard does NOT hardcode integrations. One generic component handles all:

```
Dashboard loads
  → GET /api/plugins?status=active
  → For each plugin with summary_widget:
      → <PluginWidget manifest={m} />
      → Calls the specified tool for the metric value
      → Auto-refreshes on the specified interval

Settings → Integrations loads
  → GET /api/plugins (all)
  → For each plugin: connect/disconnect card with status
```

Zero React code per integration. The manifest IS the UI definition.

### A0 Natural Language Routing

The `natural_language_examples` in manifests become part of A0's context. When a user asks "any allergies for tomorrow?", A0 matches it to the `tock.guest_notes` capability and calls the right tools.

A0 doesn't need retraining — the manifest tells it what questions each integration answers.

## The Overnight Agent

A maintenance agent runs on a schedule (e.g., 2am nightly):

1. Check all active plugins for API health (401s, schema changes)
2. If an API changed → research new docs → update MCP server → test
3. Check for user-requested integrations → scaffold new plugins
4. Run integration tests
5. Update manifests
6. Morning notification: "Chef, I added 7shifts overnight. Connect in Settings."

## Plugin Sandbox Rules

### CAN (Level 1 — autonomous)
- Create new files in `usr/plugins/`
- Register new MCP servers in config
- Write manifests (defines UI presence)
- Add tools A0 can call
- Research external API docs (browser tool)
- Test against sandboxes
- Update its own system prompt context

### CANNOT (Level 3 — forbidden)
- Modify frontend source code (`frontend/src/`)
- Modify domain code (`carabiner/`)
- Modify Agent Zero core (`agent.py`, `python/`, `run_ui.py`)
- Create database migrations
- Access other tenants' data
- Modify auth/encryption code
- Deploy without manifest validation

### NEEDS APPROVAL (Level 2 — supervised)
- Write new database tables
- Modify existing plugin code
- Change OAuth scopes
- Disable/remove existing plugins

## Implementation Build Order

1. **Plugin manifest schema** — define the JSON structure, validation
2. **Plugin discovery API** — `/api/plugins` endpoint reads `usr/plugins/*/manifest.json`
3. **Generic PluginWidget component** — renders any manifest's summary_widget
4. **Settings/integrations page** — dynamic connect/disconnect from manifests
5. **MCP scaffolding tool** — template A0 uses to create new plugins (standard structure)
6. **Plugin registry in A0 context** — manifests injected into A0's system prompt
7. **Overnight agent** — scheduled maintenance + auto-build
8. **Rollback system** — if a plugin breaks, auto-disable + notify

## Why This Matters

Traditional SaaS: feature request → dev team → 2 sprints → 6 weeks.
CarabinerOS: user request → A0 builds it overnight → live tomorrow morning.

The competitive moat isn't the integrations built — it's the ability to build ANY integration on demand. CarabinerOS stops being software that needs developers and becomes a platform that extends itself.

## Research & Validation Stack

A0 doesn't guess — it researches before building:

**Context7 (MCP, already connected):** When scaffolding a new MCP server, A0 pulls latest docs for FastMCP, httpx, OAuth libraries, etc. No hallucinated APIs — real, up-to-date documentation.

**AutoResearch pattern (Karpathy):** When a user says "connect to Tock", A0 follows a research loop:
1. Search for Tock's developer docs and API surface
2. Read actual endpoint documentation (browser tool + context7)
3. Validate endpoints exist before writing code
4. Scaffold MCP server grounded in real API specs
5. Test against sandbox
6. Iterate on failures with real error messages

Reference: https://github.com/karpathy/autoresearch.git

The combination ensures generated integrations are **grounded in reality**. The restaurant owner sees "Tock connected" and covers on their dashboard. They never see the research loop that made it reliable.

## Evidence This Works

- A0 (GLM 27B local model) already demonstrated: installed PostgreSQL from scratch, created schema from memory, inserted data, used notify_user — 27+ LLM calls, zero human intervention (Session 5, 2026-03-21)
- A0 with GPT-5.3 via Codex proxy: proper delegation, data-first tool calling, operator-ready output
- MCP server pattern is simple (~100-200 lines Python per integration) — well within A0's code generation capability
- The `usr/` directory is already designed as the safe extension zone
