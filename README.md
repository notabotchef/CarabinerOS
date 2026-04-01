# CarabinerOS

Restaurant management platform powered by Agent Zero.

## Architecture

```
carabiner-os/
├── engine/agent-zero/     ← git submodule (A0 v1.6, read-only)
├── carabiner/             ← domain code (DB models, MCP server, API schemas)
├── frontend/              ← Next.js 16 app (React 19, Tailwind 4, shadcn/ui)
├── usr/                   ← A0 user data (plugins, extensions, agents, chats)
│   ├── plugins/carabiner/ ← main plugin (API handlers, DB init)
│   ├── extensions/        ← lifecycle hooks (system_prompt, tool hooks)
│   ├── agents/            ← agent profiles (gm, souschef, etc.)
│   └── settings.json
├── docker-compose.dev.yml
├── Dockerfile.agent-zero
└── nginx.dev.conf
```

**Key principle**: Zero patches to A0 core files. Everything CarabinerOS lives in `usr/` as plugins/extensions, or in `carabiner/` as domain code.

## Quick Start

```bash
docker compose -f docker-compose.dev.yml up
# Frontend: http://localhost:3000
# Full stack via nginx: http://localhost:8080
```

## Development

```bash
# Frontend
cd frontend && pnpm dev

# Backend (runs A0 with CarabinerOS plugins)
cd engine/agent-zero && python run_ui.py
```
