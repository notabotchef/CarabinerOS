# CarabinerOS — Strategic Implementation Program Status

## Program State

- **Status**: ACTIVE — Phase 0 (Baseline, backup, truth capture)
- **Branch**: `strategic-implementation` (integration branch; no direct writes to `main`)
- **Cycle**: 1 of N (first execution cycle)
- **Last updated**: 2026-07-22T10:15:00-05:00

## Execution Budget (Cycle 1)

- Tickets created: 0 / 25 max
- Tickets started: 0 / 8 max
- Repository-writing specialists: 0 / 3 max
- Read-only investigators: 0 / 5 max
- Migration specialists: 0 / 1 max
- Deployment specialists: 0 / 1 max

## Phase Status

| Phase | Status | Exit Gate |
|-------|--------|-----------|
| P0 — Baseline, backup, truth capture | IN PROGRESS | Stable restore point exists; repo + deployment documented; no destructive work without backups |
| P1 — Critical product regressions + config truth | PENDING | Dashboard interactive; values reconcile; config docs match reality; no silent Echo mode; remote access plan |
| P2 — Database and data ownership | PENDING | One valid migration head; fresh + restored upgrades pass; data ownership unambiguous |
| P3 — Runtime persistence and reliability | PENDING | Bridge restart does not lose or duplicate critical state |
| P4 — Canonical API, MCP, and security | PENDING | One API surface; one MCP surface; external access authenticated; mutations policy-gated |
| P5 — Tests and release engineering | PENDING | No phase release without passing required checks |
| P6 — Agent and Hermes organization | PENDING | New contributor can identify source of every product-facing prompt/skill |
| P7 — Documentation and repository organization | PENDING | Active docs match code; no dead runtime files; historical plans archived |
| P8 — Code modularity and dependency hygiene | PENDING | Modules have clear responsibilities; reproducible installs; lower conflict risk |
| P9 — Product roadmap | PENDING | Product workstreams created and prioritized |

## Model Routing (VPS Control Plane — NOT in product repo)

- Primary: MiniMax M3 (minimax-oauth)
- Fallbacks: grok-4.3 (xai-oauth), gpt-5.5 (openai-codex), tencent/hy3:free (nous)
- OpenRouter excluded (no key in active profile)
- Note: This is the VPS control-plane model config. The CarabinerOS product itself does not implement provider routing.

## System Boundary

- **Product repository**: /root/carabineros/ (frontend, bridge, API, MCP, policy, action cards, audit, persistence, deployment, agents, tests, docs)
- **VPS control plane**: Agency Router, Agency of Agents, Kanban, model routing, cron, fallback providers — NOT implemented in the product repo
