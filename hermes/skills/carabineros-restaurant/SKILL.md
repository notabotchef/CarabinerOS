---
name: carabineros-restaurant
description: "Restaurant-ops rules for CarabinerOS — identity, data access, write policy, action cards. Loaded alongside SOUL.md; do not duplicate the identity block."
version: 1.0.0
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [restaurant, carabineros, ops, mcp, action-cards]
    related_skills: []
---

# CarabinerOS Restaurant Operations

This skill is the operational reference for CarabinerOS. It does
**not** repeat the identity block (that lives in `SOUL.md`). It
documents the data access contract, the write lifecycle, and the
action-card protocol that the operator's dashboard expects.

## MCP tools (the only data surface)

You have exactly two MCP tools. There is no shell-out path and no
legacy dispatcher surface — those belong to the prior stack and do
not exist here. All restaurant data work goes through the two tools
below.

### `carabiner_read(resource, id?, filters?)`

Read-only. `resource` is one of:

- `orders` — vendor purchase orders (draft, pending, submitted, received)
- `inventory` — stock items (on-hand, par, variance, category)
- `prep` — prep tasks (station, service lane, readiness, shortage)
- `food_cost` — per-menu-item cost pressure and margin
- `menu` — menu items (price, food cost %, performance, recommendation)
- `recipes` — recipes (yield, components, status, category)
- `invoices` — vendor invoices (status, total, vendor)
- `campaigns` — marketing campaigns (channel, audience, lifecycle)

Pass `id` (UUID string) for a single record. Pass `filters` as a
JSON object for list queries, e.g. `{"location_id": "...", "status": "draft"}`.

### `carabiner_propose_write(resource, verb, data, reason)`

Propose a mutation. `verb` is `create`, `update`, or `delete`.
`data` is the field payload. `reason` is a short string shown on
the action card so the operator knows why you proposed it.

The bridge:

1. Validates `resource` × `verb` against the host-side policy
   allowlist.
2. Writes an `ActionLog(status="proposed")` audit row.
3. Emits an `action_card` on the operator's dashboard.
4. Returns `{"status": "awaiting_approval", "card": {...}}` on
   success, or `{"status": "denied", "reason": "..."}` on policy
   denial.

**This tool never mutates the database.** The operator must
commit the action card on the dashboard for the mutation to
execute. Never claim a write happened until the operator has
approved it.

## Write lifecycle

1. You call `carabiner_propose_write(...)`.
2. The bridge validates, audits, and emits a card.
3. The operator commits → mutation executes, audit row
   `committed`, card re-emitted with `status: "committed"`.
4. The operator dismisses → no mutation, audit row
   `dismissed`, card re-emitted with `status: "dismissed"`.

## Action-card protocol

When you propose a write, the action card is emitted with these
fields (the operator sees them on the dashboard):

- `module` — one of the resource names above
- `action` — `create` / `update` / `delete` / `alert` / `report`
- `item_id` — UUID of the affected record (when applicable)
- `stats[]` — short `{label, value}` pairs (e.g. Total, Items)
- `changes[]` — `{op, text}` ops (`+`, `-`, `→`, `!`)
- `actions[]` — buttons the operator can press
- `suggested_chips[]` — follow-up questions the operator can tap

You do not need to build the card yourself. The bridge constructs
it from the audit row. Your job is to (a) call `carabiner_propose_write`
with a clear `reason` and (b) tell the user in chat that the
proposal is ready for review.

## Operating rules

- Always call `carabiner_read` before answering an operational
  question. Never say "I don't have access to data."
- Never invent UUIDs, vendor names, prices, or quantities. If
  the data is not in the database, say so and offer the next step.
- Prefer specific numbers from the data over round-number
  approximations in replies.
- When proposing a write, the `reason` should explain the
  business outcome (margin impact, par coverage, vendor cutoff),
  not the technical action.

## What this skill is not

- It is not a substitute for SOUL.md. Identity, tone, and the
  greeting live there.
- It is not a shell or CLI interface. Data access is MCP-only,
  via the two tools above.
- It does not document any legacy dispatcher or shell-out
  surface. None of those exist on Hermes; do not introduce them.
