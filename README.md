# CarabinerOS

Restaurant management platform powered by Agent Zero. AI-first operations for independent restaurants — orders, inventory, prep, menu, recipes, invoices, food cost, marketing, and reporting.

## Architecture

CarabinerOS is a domain layer built on top of [Agent Zero](https://github.com/agent0ai/agent-zero), an agentic AI framework.

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui
- **Backend**: Agent Zero (Python/Flask + Socket.IO) with CarabinerOS extensions
- **Database**: PostgreSQL 16, SQLAlchemy 2.0 async, Alembic migrations
- **AI**: LiteLLM (multi-provider), MCP tools for database operations

## Running

```bash
# Full stack via Docker
docker compose -f docker-compose.dev.yml up

# Access
# CarabinerOS frontend: http://localhost:8080
# Agent Zero UI: http://localhost:8080/a0/
```

## Project Structure

```
carabiner-os/
├── carabiner/           # CarabinerOS domain code
│   ├── api/             # Flask blueprint (REST routes)
│   ├── db/              # SQLAlchemy models + Alembic migrations
│   └── mcp/             # MCP server (AI tool interface)
├── frontend/            # Next.js 16 app
├── usr/                 # Agent Zero user data (volume-mounted)
│   ├── agents/          # Agent profiles
│   ├── extensions/      # Lifecycle hooks
│   ├── plugins/         # A0 plugins
│   └── settings.json    # Runtime config
├── api/                 # Agent Zero API handlers (upstream)
├── plugins/             # Agent Zero plugins (upstream)
├── docker-compose.dev.yml
├── Dockerfile.agent-zero
└── nginx.dev.conf
```

## Status

Active development. Private repository.

## License

Proprietary. All rights reserved.
