# Feature: Action Cards — Direct Emit + Visual Polish

## Overview
Give A0 a dedicated `action_card` tool that emits structured cards via Socket.IO. The LLM decides content. Polish card UI: module icons on cards, card-stack arrival animation (back→front flip with type color), Midnight Kitchen premium feel.

## Phases
| # | Name | Status | Plan File | Summary |
|---|------|--------|-----------|---------|
| 1 | Tool + Emit | Pending | plan-action-cards-phase1.md | action_card tool + system prompt + sio emit |
| 2 | Visual Polish | Pending | plan-action-cards-phase2.md | Module icons, card-stack animation, Midnight Kitchen |
| 3 | Card Chat | Pending | plan-action-cards-phase3.md | Wire card_message to A0 subordinate |
| 4 | Persistence | Pending | plan-action-cards-phase4.md | sessionStorage card state across refresh |

## Key Decisions
- **LLM-driven cards**: A0 calls `action_card` tool with structured args. No text-parsing extensions.
- **System prompt teaches usage**: Extension tells A0 when/how to emit cards.
- **Card-stack animation**: When new card arrives, top-bar icon animates (back card flips to front, takes type color). Panel cards animate in with layoutId.
- **Module icons on cards**: Each card shows module icon (cart=orders, box=inventory, etc.) matching sidebar nav icons.
- **Card chat via A0 subordinate**: card_message → A0 with card context.
- **Persistence via sessionStorage**: No DB table needed.

## Architecture
```
A0 LLM decides to notify chef
    ↓ (tool call)
action_card tool  ← NEW: structured args → sio.emit("action_card")
    ↓ (Socket.IO)
Frontend useActionCards  ← EXISTING: receives, sorts, renders
    ↓ (user interacts)
card_message → A0 subordinate  ← PHASE 3
```

## Risks
- **A0 must learn the tool**: System prompt must be clear for GPT-5.3 and local models.
- **Card chat latency**: 5-10s for A0 subordinate. Frontend has loading spinner.
- **sessionStorage**: ~50 cards × 1KB = 50KB. Well within limits.
