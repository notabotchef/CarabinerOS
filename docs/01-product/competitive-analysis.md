# Competitive Analysis — CarabinerOS vs. Market

## Competitors

### MarginEdge ($330/mo per location)
- Invoice processing (OCR, auto-categorize)
- Daily P&L / food cost tracking
- Inventory with mobile counting
- Menu analysis with real-time ingredient pricing
- Purchase ordering
- Multi-unit transfers / commissary
- POS + accounting integrations

### Restaurant365 (Enterprise pricing)
- Full accounting suite (AP, GL, banking, fixed assets)
- Inventory + recipe + prep management
- Workforce scheduling (AI-optimized)
- Payroll & HR
- Budgets & forecasting
- Sales forecasting
- Mobile app with bilingual support
- AI-generated P&Ls

### xtraCHEF (by Toast)
- AP automation with OCR
- Real-time food cost + margin variance
- Inventory with real-time valuations
- Recipe management (drag-and-drop)
- Procurement / purchase orders
- Budgets & forecasting
- Manufacturer rebate tracking

## CarabinerOS Differentiator

**Every feature is accessible through natural language.**

Competitors are form-based CRUD tools. CarabinerOS wraps an AI agent (Agent Zero) around the same operational data, so operators can:
- "Build today's produce order for River North" → agent drafts order from par levels + sales mix
- "What's driving food cost up this week?" → agent analyzes margin pressure across locations
- "Process these three invoices" → agent extracts line items, matches to POs, flags variances
- "Generate tonight's prep list from inventory and reservations" → agent builds prep plan

The agent reads/writes the same database, uses the same connectors, but the interface is conversation — not clicks through 15 forms.

## Feature Gap Analysis

| Feature | ME | R365 | xC | CarabinerOS | Priority |
|---------|:--:|:----:|:--:|:-----------:|:--------:|
| Invoice Processing / AP | Y | Y | Y | **Gap** | P1 |
| Daily P&L / Reporting | Y | Y | Y | **Gap** | P1 |
| POS Integration | Y | Y | - | **Gap** | P2 |
| Budgets & Forecasting | - | Y | Y | **Gap** | P2 |
| Recipe Management (deep) | Y | Y | Y | Schema only | P2 |
| Food Cost Tracking | Y | Y | Y | Workspace view | Built |
| Inventory Management | Y | Y | Y | Workspace view | Built |
| Menu Engineering | Y | - | Y | Workspace view | Built |
| Purchase Orders | Y | Y | Y | Workspace view + connectors | Built |
| Prep Lists | - | Y | - | Workspace view | Built |
| Multi-location | Y | Y | - | Location switcher | Built |
| Marketing / Campaigns | - | - | - | Workspace view | Built |
| AI Agent (NL ops) | - | - | - | **Core** | Built |
| Real-time updates | - | - | - | Socket.IO | Built |
| Vendor connectors | - | - | - | API/email/browser | Built |
| Workforce / Scheduling | - | Y | - | Not planned | P3 |
| Payroll / HR | - | Y | - | Not planned | - |
