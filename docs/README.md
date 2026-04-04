# CarabinerOS Documentation

**AI-native restaurant management platform built by a chef, for chefs.**

---

## What is CarabinerOS?

CarabinerOS replaces the 15-screen CRUD grind with an agent that understands restaurant operations. Independent operators say it, don't click it. The AI drafts, humans approve, the ledger is deterministic.

- **Stack:** Next.js 16, React 19, Tailwind CSS 4, Python/Flask, PostgreSQL, Agent Zero
- **Target:** 3+ location independent operators, $3M+ revenue
- **Mission:** Build the first AI-native restaurant management platform that independent operators actually trust with their food cost

---

## 🗂️ Documentation Structure

### 📦 [01-Product](01-product/)
Product vision, competitive analysis, and user feedback
- [Competitive Analysis](01-product/competitive-analysis.md) - Market positioning vs Toast, Square, MarginEdge
- [Audit Report](01-product/audit-report.md) - Technical audit findings
- [User Feedback](01-product/user-feedback/) - Chef insights and validation

### 📊 [02-Market Intelligence](02-market-intelligence/)
Market simulations and competitive intelligence
- [MiroShark Reports](02-market-intelligence/miroshark-reports/) - Prediction market simulations
- [Simulations](02-market-intelligence/simulations/) - Market adoption modeling
- [Research](02-market-intelligence/research/) - Industry analysis

**Key Insights from MiroShark Simulations:**
- Integration depth is the #1 concern (not product features)
- $149/mo pricing validated
- "Screen 16" attack line against competitors
- Will Guidara (target user) betting against adoption despite liking product

### 🛠️ [03-Development](03-development/)
Technical roadmap, architecture decisions, and bug tracking
- [Architecture](03-development/architecture/) - ADRs and technical decisions
- [Roadmap](03-development/roadmap/) - Development plans, specs, and open work
- [Bug Reports](03-development/bug-reports/) - Current issues and fixes

**Current Priority Stack:**
1. End-to-end chat (A0 calling CLI) — Hermes Engineer
2. Content pipeline posting daily — Content Producer
3. Beta restaurant list — Market Researcher
4. Next: Toast integration, onboarding flow, personalized demo generator

### 🚀 [04-Go-to-Market](04-go-to-market/)
Launch strategy, demo materials, and beta program
- [Strategy](04-go-to-market/strategy/) - GTM approach and positioning
- [Demo Materials](04-go-to-market/demo-materials/) - Demo runbooks and scripts
- [Beta Program](04-go-to-market/beta-program/) - NYC targets and testing plans

**Demo-Ready:** 15-minute demo script validates "say it, don't click it" value prop

### ⚙️ [05-Operations](05-operations/)
Multi-agent organization and deployment guides
- [Agents](05-operations/agents/) - Paperclip organization structure
- [Deployment](05-operations/deployment/) - Production deployment guides

**Paperclip Org:** CEO (Opus) → CTO (Sonnet) → Hermes Engineer (coding agent)

---

## 🏃‍♂️ Quick Start

**Prerequisites:**
- Read `CLAUDE.md` before any code work
- Read `DESIGN_TOKENS.md` before frontend work
- Check `.rune/progress.md` for current build status

**Key Context:**
- Codebase: `~/Projects/carabiner-os`
- Current: Action Cards v2, Toast integration planning, NYC beta targeting
- Zero budget — never suggest paid services without acknowledging it

**Development Workflow:**
- Always work on branches, never main
- Tasks >30 lines → delegate to agent or use rune:cook
- Don't add features beyond what was asked

---

## 📋 Current Status (April 2026)

**✅ Recently Completed:**
- Action Cards v2: A0 sends structured JSON in notify_user.detail
- Frontend notificationToCard() parses rich card payload
- Chat Context Link: nullable chat_context_id on workspace models
- MiroShark sim2 report committed
- GTM docs: NYC beta targets, demo runbook, liability framework

**🔄 In Progress:**
- End-to-end chat integration (A0 ↔ CarabinerOS)
- Real-time sync between A0 WebUI and cOS
- Toast/Square integration architecture

**📋 Next Up:**
- Daily Ops Briefing ("The Matrix") — #1 chef pain point
- Smart Ordering Assistant — prevent staff over-ordering
- Third-party integrations (OAuth-based MCP servers)

---

## 🎯 Key Files to Review

- **Market Intelligence:** [MiroShark Sim2 Report](02-market-intelligence/miroshark-reports/sim2_report_claude.md)
- **Development Roadmap:** [Open Work Items](03-development/roadmap/plans/open-work.md)
- **GTM Strategy:** [Demo Runbook](04-go-to-market/strategy/demo-runbook.md)
- **User Feedback:** [Chef Feedback](01-product/user-feedback/)
- **Multi-Agent Org:** [Paperclip Company](05-operations/agents/paperclip-company/COMPANY.md)

---

## 📞 Contact & Context

**Esteban Nunez** - Former exec chef (Alinea Group / Roister, Chicago)
- **Goal:** Fund a ground-up Michelin-starred restaurant + food R&D lab
- **GitHub:** Nunezchef
- **Email:** nunez.chef@icloud.com
- **Still active in the industry** — building CarabinerOS to solve real chef pain points

---

*Last Updated: April 2026 - Session 15*