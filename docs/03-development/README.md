# Development Documentation

## Overview

Technical roadmap, architecture decisions, and development tracking for CarabinerOS. Always read `CLAUDE.md` and `DESIGN_TOKENS.md` before any code work.

## Current Status (April 2026)

**✅ Recently Completed:**
- Action Cards v2: A0 sends structured JSON in notify_user.detail  
- Frontend notificationToCard() parses rich card payload
- Chat Context Link: nullable chat_context_id on workspace models
- GTM docs: NYC beta targets, demo runbook, liability framework

**🔄 In Progress:**
- End-to-end chat integration (A0 ↔ CarabinerOS)
- Real-time sync between A0 WebUI and cOS
- Toast/Square integration architecture

**📋 Next Up:**
- Daily Ops Briefing ("The Matrix") — #1 chef pain point
- Smart Ordering Assistant — prevent staff over-ordering  
- Third-party integrations (OAuth-based MCP servers)

## Contents

### 🏗️ [Architecture](architecture/)
- [ADR-001: Fleet Learning Federated Intelligence](architecture/ADR-001-fleet-learning-federated-intelligence.md)
- [ADR-002: Self-Evolving Platform Architecture](architecture/ADR-002-self-evolving-platform-architecture.md)

### 🗺️ [Roadmap](roadmap/)
**Current Priority Stack:**
1. End-to-end chat (A0 calling CLI) — Hermes Engineer
2. Content pipeline posting daily — Content Producer  
3. Beta restaurant list — Market Researcher
4. Next: Toast integration, onboarding flow, personalized demo generator

#### 📋 [Plans](roadmap/plans/)
- [Open Work Items](roadmap/plans/open-work.md) — Current development tasks and blockers
- [Module Plans](roadmap/plans/modules/) — Individual module development plans

#### 📐 [Specs](roadmap/specs/)  
- [A0 Frontend Streaming Fix](roadmap/specs/2026-03-19-a0-frontend-streaming-fix-design.md)
- [Expo Station Architecture](roadmap/specs/2026-03-18-carabineros-v3-expo-station-architecture-design.md)

#### ⚡ [Superpowers](roadmap/superpowers/)
High-level feature specifications and implementation plans:
- [Frontend Redesign](roadmap/superpowers/specs/2026-03-31-carabiner-frontend-redesign-design.md)
- [Chat Interface Design](roadmap/superpowers/specs/2026-03-17-phase4-chat-interface-design.md)
- [Agent Profiles & Tools](roadmap/superpowers/specs/2026-03-17-phase5a-agent-profiles-tools-design.md)

### 🐛 [Bug Reports](bug-reports/)
Current issues and testing reports from March 2026 including:
- Chat initialization problems
- Expo whispering functionality
- Action card generation issues
- Real-time sync problems

## Development Workflow

- **Always work on branches, never main**
- **Tasks >30 lines → delegate to agent or use rune:cook**  
- **Don't add features beyond what was asked**
- **Zero budget — never suggest paid services without acknowledging it**

## Key Files to Review

- **Current Status:** [.rune/progress.md](../../../.rune/progress.md) 
- **Open Work:** [Open Work Items](roadmap/plans/open-work.md)
- **Integration Audit:** [CarabinerOS A0 Integration Audit](roadmap/carabiner-a0-integration-audit.md)
- **Migration Planning:** [Migration Plan](roadmap/migration-plan.md)