# CarabinerOS v3 — Expo Station Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build CarabinerOS v3 on a fresh Agent Zero fork with a Next.js frontend that speaks Agent Zero's native Socket.IO protocol directly.

**Architecture:** Agent Zero is Back of House (kitchen) — runs agents, tools, LLM. Next.js is Front of House (dining room) — the Expo Station UI. The frontend connects directly to Agent Zero's `/state_sync` Socket.IO namespace, receives `state_push` events with snapshots containing logs, and renders them as chat messages with an expo status bar. No wrapper, no bridge.

**Tech Stack:** Agent Zero (Python/Flask/Socket.IO), Next.js 15 (App Router), React 19, TypeScript, shadcn/ui, Tailwind CSS, socket.io-client, PostgreSQL, Docker Compose

**Spec:** `docs/superpowers/specs/2026-03-18-carabineros-v3-expo-station-architecture-design.md`

**Source IP:** `/Users/estebannunez/Projects/FreshcOS` (files to migrate from)

---

## File Structure

### Migration (copied from FreshcOS)

```
usr/                              ← Agent overlay (34 files)
├── .env                          ← LLM config (ollama_chat provider)
├── tools/                        ← 10 restaurant tool files
├── agents/                       ← 5 agent profiles (agent.json + prompts/)
└── extensions/                   ← 3 execution hooks

carabiner/                        ← Domain layer (28 files)
├── __init__.py
├── chat_store.py
├── api/                          ← REST endpoints (7 files)
├── db/                           ← Models, migrations, repos (12 files)
└── domain/                       ← Protocols + logic (4 files)

tests/                            ← Test suite (31 files)
alembic.ini                       ← DB migration config
```

### New Files (created in this plan)

```
frontend/                         ← Next.js app
├── package.json
├── next.config.ts                ← Proxy config for Agent Zero
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── src/
│   ├── app/
│   │   ├── layout.tsx            ← Root layout with SocketProvider
│   │   ├── page.tsx              ← HomeView (welcome + composer + cards)
│   │   ├── globals.css           ← Tailwind imports + custom styles
│   │   └── chat/
│   │       └── [contextId]/
│   │           └── page.tsx      ← ChatView (messages + expo + composer)
│   ├── components/
│   │   ├── top-bar.tsx           ← Logo, location, bell icon
│   │   ├── home-view.tsx         ← Welcome text + composer + solitaire cards
│   │   ├── chat-view.tsx         ← Message list + expo bar + composer
│   │   ├── message-list.tsx      ← Renders chat messages
│   │   ├── chat-composer.tsx     ← Text input with send button
│   │   ├── expo-bar.tsx          ← Subtle status above composer
│   │   ├── notification-panel.tsx← Slide-out action card panel
│   │   ├── action-card.tsx       ← Individual action card
│   │   └── solitaire-cards.tsx   ← Fanned KPI cards for home
│   ├── hooks/
│   │   ├── use-socket.ts         ← Socket.IO connection to Agent Zero
│   │   ├── use-chat.ts           ← Send messages, receive responses
│   │   ├── use-expo-stream.ts    ← Map state_push events to expo text
│   │   └── use-action-cards.ts   ← Extract action cards from tool results
│   └── lib/
│       ├── socket-client.ts      ← Socket.IO singleton + CSRF handling
│       ├── expo-messages.ts      ← Expo text mapping + quirky messages
│       └── types.ts              ← TypeScript types for A0 protocol

docker-compose.dev.yml            ← Postgres for development
```

---

## Task 1: Clone Fresh Agent Zero into Repo

**Files:**
- All Agent Zero files from `https://github.com/agent0ai/agent-zero.git`
- Preserve: `.claude/`, `.superpowers/`, `.git/`, `.gitignore`, `docs/superpowers/`

- [ ] **Step 1: Save existing files that must survive**

```bash
# From /Users/estebannunez/Projects/carabiner-os
cp -r docs /tmp/carabiner-docs-backup
```

- [ ] **Step 2: Clone fresh Agent Zero into a temp directory**

```bash
git clone --depth 1 https://github.com/agent0ai/agent-zero.git /tmp/agent-zero-fresh
```

- [ ] **Step 3: Copy Agent Zero files into carabiner-os**

```bash
# Remove the .git from the clone (we keep our own)
rm -rf /tmp/agent-zero-fresh/.git

# Copy all Agent Zero files into carabiner-os
cp -r /tmp/agent-zero-fresh/* /Users/estebannunez/Projects/carabiner-os/
cp /tmp/agent-zero-fresh/.gitignore /Users/estebannunez/Projects/carabiner-os/.gitignore.a0
cp /tmp/agent-zero-fresh/.gitattributes /Users/estebannunez/Projects/carabiner-os/
cp /tmp/agent-zero-fresh/.dockerignore /Users/estebannunez/Projects/carabiner-os/
```

- [ ] **Step 4: Restore docs**

```bash
cp -r /tmp/carabiner-docs-backup/superpowers /Users/estebannunez/Projects/carabiner-os/docs/superpowers
```

- [ ] **Step 5: Merge .gitignore files**

Merge the Agent Zero `.gitignore.a0` with the existing `.gitignore`. Add these CarabinerOS-specific entries:
```
# CarabinerOS
.superpowers/brainstorm/
frontend/node_modules/
frontend/.next/
```

- [ ] **Step 6: Add upstream remote for future updates**

```bash
git remote add upstream https://github.com/agent0ai/agent-zero.git
```

- [ ] **Step 7: Verify Agent Zero runs**

```bash
# Check key files exist
ls agent.py run_ui.py initialize.py python/ webui/
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: clone fresh Agent Zero as CarabinerOS foundation

Agent Zero (MIT) serves as the backend engine.
Upstream remote added for future updates.
Existing docs/superpowers preserved."
```

---

## Task 2: Copy CarabinerOS Overlay (usr/)

**Files:**
- Copy from: `/Users/estebannunez/Projects/FreshcOS/usr/`
- Copy to: `usr/` in carabiner-os

- [ ] **Step 1: Copy tool files**

```bash
cp /Users/estebannunez/Projects/FreshcOS/usr/tools/*.py \
   /Users/estebannunez/Projects/carabiner-os/usr/tools/
```

- [ ] **Step 2: Copy agent profiles**

```bash
# Copy all 5 agent profile directories
for agent in agm executivechef gm marketing souschef; do
  cp -r /Users/estebannunez/Projects/FreshcOS/usr/agents/$agent \
        /Users/estebannunez/Projects/carabiner-os/usr/agents/
done
```

- [ ] **Step 3: Copy extensions**

```bash
mkdir -p /Users/estebannunez/Projects/carabiner-os/usr/extensions/response_stream_chunk
mkdir -p /Users/estebannunez/Projects/carabiner-os/usr/extensions/system_prompt
mkdir -p /Users/estebannunez/Projects/carabiner-os/usr/extensions/tool_execute_after

cp /Users/estebannunez/Projects/FreshcOS/usr/extensions/response_stream_chunk/_25_response_cleaning.py \
   /Users/estebannunez/Projects/carabiner-os/usr/extensions/response_stream_chunk/
cp /Users/estebannunez/Projects/FreshcOS/usr/extensions/system_prompt/_25_restaurant_context.py \
   /Users/estebannunez/Projects/carabiner-os/usr/extensions/system_prompt/
cp /Users/estebannunez/Projects/FreshcOS/usr/extensions/tool_execute_after/_25_workspace_sync.py \
   /Users/estebannunez/Projects/carabiner-os/usr/extensions/tool_execute_after/
```

- [ ] **Step 4: Copy LLM config**

```bash
cp /Users/estebannunez/Projects/FreshcOS/usr/.env \
   /Users/estebannunez/Projects/carabiner-os/usr/.env
```

- [ ] **Step 5: Verify overlay structure**

```bash
# Should show 10 tools, 5 agent dirs, 3 extensions, .env
ls usr/tools/*.py | wc -l    # expect 10
ls -d usr/agents/*/           # expect 5 dirs
find usr/extensions -name "*.py" | wc -l  # expect 3
cat usr/.env | head -3        # expect ollama_chat provider
```

- [ ] **Step 6: Commit**

```bash
git add usr/
git commit -m "feat: add CarabinerOS overlay — tools, agents, extensions

10 restaurant tools (orders, inventory, prep, recipes, food cost,
invoices, menu, marketing, reporting, ping).
5 role-based agent profiles (GM, AGM, Chef, Sous Chef, Marketing).
3 extensions (restaurant context, workspace sync, response cleaning).
LLM config: ollama_chat provider with glm-4.7-flash."
```

---

## Task 3: Copy CarabinerOS Domain Layer (carabiner/)

**Files:**
- Copy from: `/Users/estebannunez/Projects/FreshcOS/carabiner/`
- Copy to: `carabiner/` in carabiner-os
- Copy: `alembic.ini`

- [ ] **Step 1: Copy the entire carabiner directory**

```bash
cp -r /Users/estebannunez/Projects/FreshcOS/carabiner \
      /Users/estebannunez/Projects/carabiner-os/
```

- [ ] **Step 2: Copy alembic.ini**

```bash
cp /Users/estebannunez/Projects/FreshcOS/alembic.ini \
   /Users/estebannunez/Projects/carabiner-os/
```

- [ ] **Step 3: Fix duplicate 003_ migration**

Rename one of the duplicate `003_` migration files to `006_`:

```bash
mv carabiner/db/migrations/versions/003_invoices_table_and_seed.py \
   carabiner/db/migrations/versions/006_invoices_table_and_seed.py
```

Then update the Alembic revision chain in that file — change its `down_revision` to point to `005_menu_recipe_link` instead of `002_`.

- [ ] **Step 4: Verify structure**

```bash
find carabiner -name "*.py" | wc -l   # expect ~28 files
ls carabiner/db/migrations/versions/  # expect 001-006, no duplicate prefix
```

- [ ] **Step 5: Commit**

```bash
git add carabiner/ alembic.ini
git commit -m "feat: add CarabinerOS domain layer — db, api, protocols

Async SQLAlchemy models for workspace (orders, inventory, prep,
recipes, food cost, invoices, menu, marketing).
REST API endpoints for workspace CRUD, reporting, health.
Action card protocol, status protocol, response cleaning.
6 Alembic migrations with seed data (fixed duplicate 003_ prefix)."
```

---

## Task 4: Copy Tests and Documentation

**Files:**
- Copy from: `/Users/estebannunez/Projects/FreshcOS/tests/`
- Copy from: `/Users/estebannunez/Projects/FreshcOS/docs/` (CarabinerOS-specific only)

- [ ] **Step 1: Copy test files**

```bash
# The fresh Agent Zero already has a tests/ dir — copy our additions
cp /Users/estebannunez/Projects/FreshcOS/tests/test_discovery.py \
   /Users/estebannunez/Projects/carabiner-os/tests/
cp /Users/estebannunez/Projects/FreshcOS/tests/test_tools.py \
   /Users/estebannunez/Projects/carabiner-os/tests/
```

Note: Only copy CarabinerOS-specific tests (`test_discovery.py`, `test_tools.py`). The other 29 test files are Agent Zero's own tests which are already in the fresh clone.

- [ ] **Step 2: Copy CarabinerOS docs**

```bash
# Copy handoff and CarabinerOS-specific docs
cp /Users/estebannunez/Projects/FreshcOS/docs/HANDOFF-2026-03-18.md \
   /Users/estebannunez/Projects/carabiner-os/docs/
cp /Users/estebannunez/Projects/FreshcOS/docs/competitive-analysis.md \
   /Users/estebannunez/Projects/carabiner-os/docs/
cp /Users/estebannunez/Projects/FreshcOS/docs/migration-plan.md \
   /Users/estebannunez/Projects/carabiner-os/docs/
```

- [ ] **Step 3: Copy old specs for reference**

```bash
cp /Users/estebannunez/Projects/FreshcOS/docs/superpowers/specs/2026-03-17-*.md \
   /Users/estebannunez/Projects/carabiner-os/docs/superpowers/specs/
cp /Users/estebannunez/Projects/FreshcOS/docs/superpowers/specs/2026-03-18-carabineros-roadmap-to-launch-design.md \
   /Users/estebannunez/Projects/carabiner-os/docs/superpowers/specs/
```

- [ ] **Step 4: Commit**

```bash
git add tests/ docs/
git commit -m "feat: add CarabinerOS tests and documentation

2 CarabinerOS-specific test files.
Handoff doc, competitive analysis, migration plan.
Previous phase specs preserved for reference."
```

---

## Task 5: Docker Compose for Development

**Files:**
- Create: `docker-compose.dev.yml`

- [ ] **Step 1: Create dev Docker Compose**

```yaml
# docker-compose.dev.yml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: carabiner
      POSTGRES_PASSWORD: carabiner
      POSTGRES_DB: carabiner
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U carabiner"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

- [ ] **Step 2: Test Postgres starts**

```bash
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps  # expect postgres healthy
docker compose -f docker-compose.dev.yml down
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.dev.yml
git commit -m "feat: add dev Docker Compose for Postgres"
```

---

## Task 6: Scaffold Next.js Frontend

**Files:**
- Create: `frontend/` directory with Next.js app

- [ ] **Step 1: Create Next.js app with create-next-app**

```bash
cd /Users/estebannunez/Projects/carabiner-os
pnpm create next-app frontend \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-pnpm \
  --no-turbopack
```

- [ ] **Step 2: Install dependencies**

```bash
cd frontend
pnpm add socket.io-client
pnpm add -D @types/node
```

- [ ] **Step 3: Initialize shadcn**

```bash
pnpm dlx shadcn@latest init -d
```

- [ ] **Step 4: Add shadcn components needed for MVP**

```bash
pnpm dlx shadcn@latest add button input scroll-area badge sheet
```

- [ ] **Step 5: Configure Next.js proxy for Agent Zero**

Replace `next.config.ts` with:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Agent Zero REST API routes
      { source: "/message", destination: "http://localhost:5000/message" },
      { source: "/message_async", destination: "http://localhost:5000/message_async" },
      { source: "/chats", destination: "http://localhost:5000/chats" },
      { source: "/chat_load", destination: "http://localhost:5000/chat_load" },
      { source: "/chat_create", destination: "http://localhost:5000/chat_create" },
      // Note: Socket.IO proxying handled separately via middleware or direct connection
    ];
  },
};

export default nextConfig;
```

**Important:** Socket.IO WebSocket connections cannot be proxied via Next.js rewrites. The frontend Socket.IO client will connect directly to `http://localhost:5000` in development. In production, nginx handles the unified routing.

- [ ] **Step 6: Clean up default Next.js boilerplate**

Remove default page content from `src/app/page.tsx` and `src/app/globals.css`. Replace with minimal placeholder.

- [ ] **Step 7: Verify it runs**

```bash
pnpm dev
# Visit http://localhost:3000 — should show blank page
```

- [ ] **Step 8: Commit**

```bash
cd /Users/estebannunez/Projects/carabiner-os
git add frontend/
git commit -m "feat: scaffold Next.js frontend with shadcn

Next.js 15, TypeScript, Tailwind, shadcn/ui.
Proxy config for Agent Zero REST routes.
Socket.IO connects directly to :5000 in dev."
```

---

## Task 7: Socket.IO Client Library

**Files:**
- Create: `frontend/src/lib/types.ts`
- Create: `frontend/src/lib/socket-client.ts`
- Create: `frontend/src/hooks/use-socket.ts`

- [ ] **Step 1: Define TypeScript types for Agent Zero protocol**

Create `frontend/src/lib/types.ts`:

```typescript
// Agent Zero Socket.IO protocol types

export interface A0LogEntry {
  no: number;
  id: string;
  type: "user" | "agent" | "response" | "tool" | "code_exe" | "browser" |
        "progress" | "mcp" | "subagent" | "warning" | "rate_limit" |
        "error" | "info" | "util" | "hint";
  heading: string;
  content: string;
  kvps: Record<string, unknown>;
  timestamp: number;
  agentno: number;
}

export interface A0Context {
  id: string;
  name: string;
  last_message: string;
  log_version: number;
}

export interface A0Snapshot {
  deselect_chat: boolean;
  context: string;
  contexts: A0Context[];
  tasks: unknown[];
  logs: A0LogEntry[];
  log_guid: string;
  log_version: number;
  log_progress: string | number;
  log_progress_active: boolean;
  paused: boolean;
  notifications: A0Notification[];
  notifications_guid: string;
  notifications_version: number;
}

export interface A0Notification {
  id: string;
  type: string;
  message: string;
}

export interface A0StatePush {
  runtime_epoch: string;
  seq: number;
  snapshot: A0Snapshot;
  ts: string;
  handlerId: string;
  eventId: string;
  correlationId: string;
}

export interface A0StateRequestResponse {
  ok: boolean;
  data: {
    runtime_epoch: string;
    seq_base: number;
  };
  correlationId: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ActionCard {
  id: string;
  type: string;
  module: string;
  action: string;
  itemId?: string;
  item?: Record<string, unknown>;
  summary: string;
  timestamp: number;
  read: boolean;
}
```

- [ ] **Step 2: Create Socket.IO client singleton**

Create `frontend/src/lib/socket-client.ts`:

```typescript
import { io, Socket } from "socket.io-client";

const A0_URL = process.env.NEXT_PUBLIC_A0_URL || "http://localhost:5000";

let stateSyncSocket: Socket | null = null;

export function getStateSyncSocket(): Socket {
  if (!stateSyncSocket) {
    stateSyncSocket = io(`${A0_URL}/state_sync`, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      withCredentials: true,
    });
  }
  return stateSyncSocket;
}

export function disconnectAll() {
  if (stateSyncSocket) {
    stateSyncSocket.disconnect();
    stateSyncSocket = null;
  }
}

export { A0_URL };
```

- [ ] **Step 3: Create useSocket hook**

Create `frontend/src/hooks/use-socket.ts`:

```typescript
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getStateSyncSocket } from "@/lib/socket-client";
import type { A0StatePush, A0Snapshot } from "@/lib/types";
import type { Socket } from "socket.io-client";

interface UseSocketReturn {
  connected: boolean;
  snapshot: A0Snapshot | null;
  subscribe: (contextId: string | null) => void;
}

export function useSocket(): UseSocketReturn {
  const [connected, setConnected] = useState(false);
  const [snapshot, setSnapshot] = useState<A0Snapshot | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const logFromRef = useRef(0);

  useEffect(() => {
    const socket = getStateSyncSocket();
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("state_push", (envelope: A0StatePush) => {
      const snap = envelope.snapshot;
      setSnapshot(snap);
      if (snap.logs.length > 0) {
        logFromRef.current = snap.logs[snap.logs.length - 1].no + 1;
      }
    });

    socket.connect();

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("state_push");
      socket.disconnect();
    };
  }, []);

  const subscribe = useCallback((contextId: string | null) => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    logFromRef.current = 0;

    socket.emit("state_request", {
      context: contextId,
      log_from: 0,
      notifications_from: 0,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ts: new Date().toISOString(),
      correlationId: crypto.randomUUID(),
      data: {},
    });
  }, []);

  return { connected, snapshot, subscribe };
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && pnpm build
```
Expected: Build succeeds (pages may be empty but types compile).

- [ ] **Step 5: Commit**

```bash
cd /Users/estebannunez/Projects/carabiner-os
git add frontend/src/lib/types.ts frontend/src/lib/socket-client.ts frontend/src/hooks/use-socket.ts
git commit -m "feat: Socket.IO client for Agent Zero state_sync protocol

Types for A0 snapshot, logs, notifications.
Singleton socket client targeting /state_sync namespace.
useSocket hook with connect/subscribe/snapshot state."
```

---

## Task 8: Expo Stream Hook + Message Mapping

**Files:**
- Create: `frontend/src/lib/expo-messages.ts`
- Create: `frontend/src/hooks/use-expo-stream.ts`
- Create: `frontend/src/hooks/use-chat.ts`
- Create: `frontend/src/hooks/use-action-cards.ts`

- [ ] **Step 1: Create expo message mapping**

Create `frontend/src/lib/expo-messages.ts`:

```typescript
import type { A0LogEntry } from "@/lib/types";

const QUIRKY_MESSAGES: Record<string, string[]> = {
  food_cost_tool: [
    "Crunching the numbers on that produce order...",
    "Checking if the avocado market crashed yet...",
  ],
  inventory_tool: [
    "Checking the walk-in...",
    "Counting what's left after brunch service...",
  ],
  prep_tool: [
    "Asking the sous chef about tomorrow's prep...",
    "Making sure mise en place is actually en place...",
  ],
  order_tool: [
    "Drafting that PO, hang tight...",
    "Negotiating with the vendor rep...",
  ],
  recipe_tool: [
    "Pulling up the recipe book...",
    "Cross-referencing Chef's secret notes...",
  ],
  reporting_tool: [
    "Pulling last week's covers from the reservation book...",
    "Running the numbers for the morning briefing...",
  ],
  invoice_tool: [
    "Scanning that invoice...",
    "Making sure they didn't overcharge us again...",
  ],
  marketing_tool: [
    "Drafting something Instagram-worthy...",
    "Thinking about what would make foodies stop scrolling...",
  ],
  menu_tool: [
    "Checking the menu matrix...",
    "Looking at what's selling and what's sitting...",
  ],
  default: [
    "Working on it...",
    "One moment...",
    "On it, Chef...",
  ],
};

const COMPLETION_MESSAGES = [
  "Heard.",
  "Service.",
  "All set.",
  "Done, Chef.",
];

export function getExpoMessage(log: A0LogEntry): string | null {
  // Tool execution
  if (log.type === "tool" && log.heading) {
    const toolName = log.heading.replace("Using ", "").replace("...", "").trim();
    const messages = QUIRKY_MESSAGES[toolName] || QUIRKY_MESSAGES.default;
    return messages[Math.floor(Math.random() * messages.length)];
  }

  // Agent delegation
  if (log.type === "agent" || log.type === "subagent") {
    return `Delegating to ${log.heading || "a specialist"}...`;
  }

  // Progress updates
  if (log.type === "progress" && log.content) {
    return log.content;
  }

  return null;
}

export function getCompletionMessage(): string {
  return COMPLETION_MESSAGES[Math.floor(Math.random() * COMPLETION_MESSAGES.length)];
}
```

- [ ] **Step 2: Create useExpoStream hook**

Create `frontend/src/hooks/use-expo-stream.ts`:

```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import type { A0Snapshot } from "@/lib/types";
import { getExpoMessage, getCompletionMessage } from "@/lib/expo-messages";

interface ExpoState {
  text: string | null;
  active: boolean;
}

export function useExpoStream(snapshot: A0Snapshot | null): ExpoState {
  const [expo, setExpo] = useState<ExpoState>({ text: null, active: false });
  const prevLogsLenRef = useRef(0);

  useEffect(() => {
    if (!snapshot) return;

    // Agent is actively processing
    if (snapshot.log_progress_active && snapshot.log_progress) {
      const progressText = typeof snapshot.log_progress === "string"
        ? snapshot.log_progress
        : "Working...";

      // Try to map to a friendly expo message from latest log
      const newLogs = snapshot.logs.slice(prevLogsLenRef.current);
      let expoText = progressText;

      for (const log of newLogs.reverse()) {
        const mapped = getExpoMessage(log);
        if (mapped) {
          expoText = mapped;
          break;
        }
      }

      setExpo({ text: expoText, active: true });
    } else if (expo.active) {
      // Was active, now done
      setExpo({ text: getCompletionMessage(), active: false });
      // Clear after 2 seconds
      const timer = setTimeout(() => setExpo({ text: null, active: false }), 2000);
      return () => clearTimeout(timer);
    }

    prevLogsLenRef.current = snapshot.logs.length;
  }, [snapshot]);

  return expo;
}
```

- [ ] **Step 3: Create useChat hook**

Create `frontend/src/hooks/use-chat.ts`:

```typescript
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { A0Snapshot, ChatMessage } from "@/lib/types";
import { A0_URL } from "@/lib/socket-client";

interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (text: string) => Promise<string>;
  contextId: string | null;
  loading: boolean;
}

export function useChat(snapshot: A0Snapshot | null): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contextId, setContextId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const processedLogIds = useRef(new Set<string>());

  // Extract messages from snapshot logs
  useEffect(() => {
    if (!snapshot) return;

    const newMessages: ChatMessage[] = [];

    for (const log of snapshot.logs) {
      if (processedLogIds.current.has(log.id)) continue;

      if (log.type === "user") {
        newMessages.push({
          id: log.id,
          role: "user",
          content: log.content,
          timestamp: log.timestamp,
        });
        processedLogIds.current.add(log.id);
      }

      if (log.type === "response" && log.content.trim()) {
        newMessages.push({
          id: log.id,
          role: "assistant",
          content: log.content,
          timestamp: log.timestamp,
        });
        processedLogIds.current.add(log.id);
      }
    }

    if (newMessages.length > 0) {
      setMessages(prev => [...prev, ...newMessages]);
    }

    if (snapshot.context) {
      setContextId(snapshot.context);
    }

    // Loading state based on progress
    setLoading(snapshot.log_progress_active);
  }, [snapshot]);

  const sendMessage = useCallback(async (text: string): Promise<string> => {
    // Optimistically add user message
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: Date.now() / 1000,
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const res = await fetch(`${A0_URL}/message_async`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        text,
        context: contextId || "",
      }),
    });

    const data = await res.json();
    const newContextId = data.context || contextId;
    if (newContextId) setContextId(newContextId);
    return newContextId;
  }, [contextId]);

  return { messages, sendMessage, contextId, loading };
}
```

- [ ] **Step 4: Create useActionCards hook**

Create `frontend/src/hooks/use-action-cards.ts`:

```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import type { A0Snapshot, ActionCard } from "@/lib/types";

interface UseActionCardsReturn {
  cards: ActionCard[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

export function useActionCards(snapshot: A0Snapshot | null): UseActionCardsReturn {
  const [cards, setCards] = useState<ActionCard[]>([]);
  const processedIds = useRef(new Set<string>());

  useEffect(() => {
    if (!snapshot) return;

    for (const log of snapshot.logs) {
      if (processedIds.current.has(log.id)) continue;
      if (log.type !== "tool") continue;

      // Check if the tool result has additional data (action card payload)
      const kvps = log.kvps || {};
      if (kvps.module && kvps.action) {
        const card: ActionCard = {
          id: log.id,
          type: String(kvps.action),
          module: String(kvps.module),
          action: String(kvps.action),
          itemId: kvps.item_id ? String(kvps.item_id) : undefined,
          item: kvps.item as Record<string, unknown> | undefined,
          summary: log.content.slice(0, 120),
          timestamp: log.timestamp,
          read: false,
        };
        setCards(prev => [...prev, card]);
        processedIds.current.add(log.id);
      }
    }
  }, [snapshot]);

  const unreadCount = cards.filter(c => !c.read).length;

  const markRead = (id: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, read: true } : c));
  };

  const markAllRead = () => {
    setCards(prev => prev.map(c => ({ ...c, read: true })));
  };

  return { cards, unreadCount, markRead, markAllRead };
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd frontend && pnpm build
```

- [ ] **Step 6: Commit**

```bash
cd /Users/estebannunez/Projects/carabiner-os
git add frontend/src/lib/expo-messages.ts \
       frontend/src/hooks/use-expo-stream.ts \
       frontend/src/hooks/use-chat.ts \
       frontend/src/hooks/use-action-cards.ts
git commit -m "feat: expo stream, chat, and action card hooks

useExpoStream maps Agent Zero state_push to friendly status text.
useChat extracts messages from logs, sends via /message_async.
useActionCards captures tool mutation cards for notification panel.
Expo messages include context-aware quirky restaurant humor."
```

---

## Task 9: Build the UI Components

**Files:**
- Create: `frontend/src/components/top-bar.tsx`
- Create: `frontend/src/components/expo-bar.tsx`
- Create: `frontend/src/components/chat-composer.tsx`
- Create: `frontend/src/components/message-list.tsx`
- Create: `frontend/src/components/solitaire-cards.tsx`
- Create: `frontend/src/components/action-card.tsx`
- Create: `frontend/src/components/notification-panel.tsx`
- Create: `frontend/src/components/home-view.tsx`
- Create: `frontend/src/components/chat-view.tsx`

**Note:** @frontend-design and @shadcn skills should be invoked during implementation for design quality. @web-design-guidelines for accessibility. These components need to look polished — "eat with your eyes."

- [ ] **Step 1: Build TopBar**

Create `frontend/src/components/top-bar.tsx`:
- CarabinerOS logo (amber/gold text)
- Location name
- Notification bell with badge count
- Dark background (#1a1a1a)
- `onBellClick` prop to toggle notification panel

- [ ] **Step 2: Build ExpoBar**

Create `frontend/src/components/expo-bar.tsx`:
- Three-dot amber animation when `active`
- Green dot when complete
- Italic text, subtle styling
- Sits directly above the composer
- Animates in/out smoothly (CSS transitions)
- Props: `text: string | null`, `active: boolean`

- [ ] **Step 3: Build ChatComposer**

Create `frontend/src/components/chat-composer.tsx`:
- Text input with placeholder "Ask CarabinerOS anything..."
- Send button (dark, arrow up icon)
- Submit on Enter key
- `onSend: (text: string) => void` prop
- Disabled state while loading

- [ ] **Step 4: Build MessageList**

Create `frontend/src/components/message-list.tsx`:
- Renders `ChatMessage[]`
- User messages: right-aligned, gray background bubbles
- Assistant messages: left-aligned, clean text (no bubble)
- Auto-scroll to bottom on new messages
- Uses shadcn `ScrollArea`

- [ ] **Step 5: Build SolitaireCards**

Create `frontend/src/components/solitaire-cards.tsx`:
- 4 KPI cards fanned at slight rotations (-4deg, -1deg, 2deg, 5deg)
- Each card: label, big number, subtitle
- Static data for now (orders, food cost, prep, covers)
- Glanceable, not interactive

- [ ] **Step 6: Build ActionCard**

Create `frontend/src/components/action-card.tsx`:
- Type label (color-coded: amber for alerts, blue for orders, etc.)
- Timestamp ("2m ago")
- Summary text
- Action buttons (dark primary, outlined secondary)
- `onAction: (action: string) => void` prop

- [ ] **Step 7: Build NotificationPanel**

Create `frontend/src/components/notification-panel.tsx`:
- Uses shadcn `Sheet` (slides from right)
- Header: "Action Cards" + close button
- Scrollable list of ActionCard components
- `open: boolean`, `onClose: () => void`, `cards: ActionCard[]` props

- [ ] **Step 8: Build HomeView**

Create `frontend/src/components/home-view.tsx`:
- Welcome text: "Good morning, Chef" (time-aware greeting)
- Subtitle: KPI summary line
- Centered ChatComposer
- SolitaireCards at bottom
- `onSend: (text: string) => void` prop — triggers transition to chat

- [ ] **Step 9: Build ChatView**

Create `frontend/src/components/chat-view.tsx`:
- Full height flex column
- MessageList (flex: 1, scrollable)
- ExpoBar (above composer)
- ChatComposer (bottom)
- Receives `messages`, `expo`, `onSend`, `loading` props

- [ ] **Step 10: Commit**

```bash
cd /Users/estebannunez/Projects/carabiner-os
git add frontend/src/components/
git commit -m "feat: UI components — TopBar, ExpoBar, Chat, Home, Notifications

Two-state UI: HomeView (welcome + solitaire cards) and ChatView
(messages + expo bar above composer). NotificationPanel slides
from right with action cards. Expo bar shows BOH status with
subtle animation and restaurant personality."
```

---

## Task 10: Wire Up App Shell + Routing

**Files:**
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/app/page.tsx`
- Create: `frontend/src/app/chat/[contextId]/page.tsx`
- Modify: `frontend/src/app/globals.css`

- [ ] **Step 1: Create root layout with SocketProvider**

Update `frontend/src/app/layout.tsx` to wrap children with a client-side SocketProvider that manages the Socket.IO connection lifecycle.

```typescript
// layout.tsx wraps with SocketProvider
// SocketProvider creates the socket connection on mount
// Passes snapshot down via React context
```

Create `frontend/src/components/socket-provider.tsx`:
- Uses `useSocket()` hook
- Creates React context with `{ connected, snapshot, subscribe }`
- Wraps children

- [ ] **Step 2: Build home page**

Update `frontend/src/app/page.tsx`:
- Renders TopBar + HomeView
- On send: calls `sendMessage`, gets contextId, redirects to `/chat/[contextId]`
- Uses `useRouter()` for navigation

- [ ] **Step 3: Build chat page**

Create `frontend/src/app/chat/[contextId]/page.tsx`:
- Reads `contextId` from params
- Calls `subscribe(contextId)` on mount
- Renders TopBar + ChatView + NotificationPanel
- Wires hooks: `useChat(snapshot)`, `useExpoStream(snapshot)`, `useActionCards(snapshot)`

- [ ] **Step 4: Add global styles**

Update `frontend/src/app/globals.css`:
- Tailwind imports
- Custom animation for expo bar dots
- Smooth transitions for notification panel
- Dark top bar styling

- [ ] **Step 5: Test full flow manually**

```bash
# Terminal 1: Start Postgres
docker compose -f docker-compose.dev.yml up -d

# Terminal 2: Start Agent Zero (if Ollama is running)
python run_ui.py

# Terminal 3: Start Next.js
cd frontend && pnpm dev

# Visit http://localhost:3000
# 1. See HomeView with welcome text and solitaire cards
# 2. Type a message in composer
# 3. Should redirect to /chat/[contextId]
# 4. Expo bar should show status
# 5. Response should appear in message list
```

- [ ] **Step 6: Commit**

```bash
cd /Users/estebannunez/Projects/carabiner-os
git add frontend/src/app/ frontend/src/components/socket-provider.tsx
git commit -m "feat: wire up app shell — home → chat flow with Socket.IO

Home page shows welcome + composer + solitaire cards.
Sending a message creates context and navigates to chat view.
Chat view shows messages, expo bar, and notification panel.
Direct Socket.IO connection to Agent Zero /state_sync namespace."
```

---

## Task 11: Create CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Write project guide**

Create `CLAUDE.md` with:
- Project overview (CarabinerOS = Agent Zero fork + Next.js frontend)
- How to run (3 terminals: Postgres, Agent Zero, Next.js)
- Architecture rule: never modify Agent Zero core files
- File organization: `usr/` (overlay), `carabiner/` (domain), `frontend/` (FOH)
- Tech stack details
- LLM config: must use `ollama_chat` not `ollama`

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md project guide"
```

---

## Execution Notes

**Task dependencies:** Tasks 1-4 are sequential (each builds on previous). Task 5-6 can run in parallel. Tasks 7-8 depend on Task 6. Task 9 depends on Task 8. Task 10 depends on Task 9. Task 11 can run anytime after Task 1.

**Skills to invoke during implementation:**
- Task 6: @shadcn for initialization
- Task 9: @frontend-design, @shadcn, @web-design-guidelines for component design quality
- Task 10: @vercel-react-best-practices for App Router patterns

**Deferred to future plans:** `useWorkspace(module)` hook and workspace module pages (orders table, recipe editor, etc.) — per spec's "What's NOT in This Spec" section.

**Socket.IO note:** The spec mentions proxying `/socket.io` through Next.js, but WebSocket upgrades don't work through Next.js rewrites. The frontend Socket.IO client connects directly to Agent Zero's port in dev. In production, nginx handles unified routing. The plan is authoritative here.

**Event name note:** The spec uses `state_update` but the actual Agent Zero event name is `state_push`. The plan uses the correct name from the source code.

**Testing approach:** Tasks 1-5 are migration/infrastructure — verified by file existence and basic smoke tests. Tasks 6-10 are frontend — verified by TypeScript compilation and manual testing against a running Agent Zero instance.

**Agent Zero must be running for end-to-end testing.** Ensure Ollama is running with `glm-4.7-flash` model pulled, and `usr/.env` is configured correctly.
