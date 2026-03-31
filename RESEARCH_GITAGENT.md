# GitAgent Research: Architecture, Patterns, and Relevance to CarabinerOS

**Date**: 2026-03-25
**Status**: Complete research & analysis
**Source**: https://github.com/open-gitagent/gitagent

---

## 1. What is GitAgent?

GitAgent is a **framework-agnostic, git-native standard for defining AI agents**. Instead of embedding agent logic in framework-specific code (LangChain, CrewAI, OpenAI, Claude Code, etc.), GitAgent captures agent identity, rules, and capabilities as a structured file system in a git repository.

**Core insight**: Your repository *becomes* your agent. Clone a repo, get an agent.

### The Problem It Solves

Every AI framework has its own agent structure:
- CrewAI uses Python classes with YAML config
- OpenAI uses a Python SDK
- Claude Code uses CLAUDE.md
- LangChain uses chains/agents in code
- Cursor uses `.cursor/rules/*.mdc` files

**Result**: Agents are not portable, not versionable semantically, not auditable as units, and compliance requirements must be reimplemented per framework.

### Three Key Values

1. **Portability** — Define agent once, export to 12+ frameworks with adapters
2. **Git-native** — Version control, diffs, audit trails, branching all built-in
3. **Compliance-ready** — First-class support for FINRA, SEC, Federal Reserve, CFPB regulations, and segregation of duties (SOD)

---

## 2. Tech Stack & Architecture

### Tech Stack
- **Language**: TypeScript 5, Node.js >= 18
- **CLI Framework**: Commander.js
- **Parsing**: js-yaml, ajv (JSON schema validation)
- **Size**: ~7,800 lines of TypeScript (2,600 in adapters alone)
- **Dependencies**: Minimal — js-yaml, commander, inquirer, chalk, ajv (only 5 dependencies)
- **Testing**: Node.js built-in test runner (light on tests — acknowledged gap)

### Architecture Pattern: Adapter-Runner-Loader

```
┌─────────────────────────────────────────────────────────────┐
│ CLI Commands (index.ts)                                     │
│ ├── run, init, export, import, validate, audit, skills...  │
└─────────────────────────────────────────────────────────────┘
         │
         ├─→ Loader (loads agent.yaml + SOUL.md + skills)
         │
         ├─→ Runners (execute in specific framework)
         │   ├── Claude runner (.claude/hooks, etc.)
         │   ├── OpenAI runner (Python code gen)
         │   ├── CrewAI runner (YAML config)
         │   ├── Lyzr runner (HTTP API)
         │   ├── GitHub Actions runner
         │   └── 7 more...
         │
         └─→ Adapters (export to framework-specific format)
             ├── claude-code (CLAUDE.md)
             ├── system-prompt (concatenated markdown)
             ├── openai (Python)
             ├── crewai (YAML)
             ├── cursor (.cursor/rules/*.mdc)
             ├── lyzr (JSON)
             └── 7 more...
```

**Key Design Principle**: "Keep it flat. No ORMs, no DI frameworks, no deep class hierarchies. This is a CLI tool." (from CONTRIBUTING.md)

### Code Quality — Why It's "Beautifully Built"

1. **Minimal Dependencies** (only 5) — Supply chain attack surface is tiny
2. **Single Responsibility** — Each adapter/runner is self-contained (~40-400 LOC)
3. **No Premature Abstraction** — Three similar lines is better than a premature helper
4. **Honest Error Messages** — "Failed to load agent.yaml: file not found at /path" instead of bare "Error"
5. **Progressive Disclosure** — Skills show only metadata at first, full instructions on demand
6. **Spec-Driven** — Everything derives from the `agent.yaml` schema and SPECIFICATION.md
7. **Clear File Organization** — One file per CLI command, one adapter per framework, utilities logically grouped
8. **Compliance First** — SOD (Segregation of Duties) is a first-class feature, not an afterthought
9. **Self-Aware About Limits** — Every adapter documents what's "lossy" (what can't be mapped cleanly)

---

## 3. Directory Structure: The Agent Standard

Only **two files required**:

```
my-agent/
├── agent.yaml              # REQUIRED: Manifest (name, version, model, compliance)
├── SOUL.md                 # REQUIRED: Identity, personality, communication style
│
├── RULES.md                # Hard constraints, must-always/must-never
├── DUTIES.md               # Segregation of duties roles & handoff workflows
├── AGENTS.md               # Framework-agnostic fallback instructions
│
├── skills/                 # Reusable capability modules
│   └── code-review/
│       ├── SKILL.md        # Metadata + instructions
│       └── scripts/
│
├── tools/                  # MCP-compatible tool definitions (YAML + optional script)
├── workflows/              # SkillsFlow multi-step procedures
├── knowledge/              # Reference documents + embeddings
├── memory/                 # Persistent cross-session memory
│   ├── MEMORY.md           # Current state
│   └── runtime/            # Daily log, context snapshots
├── hooks/                  # Lifecycle handlers (bootstrap, teardown)
├── compliance/             # Regulatory artifacts (risk assessment, audit logs)
├── config/                 # Environment-specific overrides (dev/staging/prod)
└── agents/                 # Sub-agents (recursive structure)
    └── fact-checker/
        ├── agent.yaml
        └── SOUL.md
```

**Design Philosophy**: Convention over configuration. If you don't need compliance, don't add it. Minimal agent = 2 files. Production agent = full directory tree.

---

## 4. agent.yaml: The Manifest Schema

```yaml
spec_version: "0.1.0"
name: my-agent
version: 1.0.0
description: What this agent does

model:
  preferred: claude-opus-4-6
  fallback: [gpt-4o, claude-sonnet-4-5]
  constraints:
    temperature: 0.1
    max_tokens: 8192

extends: https://github.com/org/base-agent.git  # Agent inheritance

dependencies:                                    # Sub-agents
  - name: fact-checker
    source: ./agents/fact-checker
    version: ^1.0.0

skills: [regulatory-analysis, document-review]
tools: [search-regulations, generate-report]

delegation:
  mode: auto | explicit | router
  router: orchestrator-agent

compliance:                                      # REGULATORY MODEL (see below)
  risk_tier: high
  frameworks: [finra, federal_reserve, sec, cfpb]
  supervision:
    human_in_the_loop: always | conditional | advisory | none
    escalation_triggers:
      - confidence_below: 0.85
      - action_type: customer_communication
      - error_detected: true
    kill_switch: true
  recordkeeping:
    audit_logging: true
    retention_period: 7y
    immutable: true
  segregation_of_duties:
    roles:
      - id: analyst
        permissions: [create, submit]
      - id: reviewer
        permissions: [review, approve, reject]
    conflicts:
      - [analyst, reviewer]      # Cannot be same agent
    handoffs:
      - action: regulatory_filing
        required_roles: [analyst, reviewer]
        approval_required: true
    enforcement: strict | advisory
```

**What's Novel**: The `compliance` block has NO equivalent in LangChain, CrewAI, or OpenAI Agents. It maps directly to:
- FINRA Rules 2210 (communications), 3110 (supervision), 4511 (recordkeeping), Reg Notice 24-09
- SEC Regulations S-P (privacy), 17a-4 (retention), Reg BI (fiduciary duty)
- Federal Reserve SR 11-7 (model risk), SR 23-4 (third-party risk)
- CFPB Circular 2022-03 (fair lending), Reg S-ID (identity verification)

---

## 5. Compliance: Segregation of Duties (SOD)

This is the standout feature. GitAgent enforces multi-agent role separation at the framework level.

### Example: Compliance Analyst System

**Roles**:
- **Analyst** — creates findings (permissions: create, submit)
- **Reviewer** — verifies & approves (permissions: review, approve, reject)
- **Auditor** — maintains compliance trail (permissions: audit, report)

**Conflict Matrix** (no single agent may hold both):
```
- [Analyst, Reviewer]  → The analyst can't approve their own work
- [Analyst, Auditor]   → The analyst can't audit their own analysis
- [Reviewer, Auditor]  → The reviewer can't audit the approval
```

**Handoff Workflow**:
```
1. Analyst creates regulatory filing draft → submit
2. Reviewer verifies accuracy → approve (requires approval to proceed)
3. (Optional) Auditor logs completion
```

**Enforcement**: `strict` (blocks deployment) or `advisory` (warnings only)

**Isolation**:
- **State isolation: full** — Each agent has its own memory, no cross-reading
- **Credential segregation: separate** — Each role has distinct API keys/permissions

### Runtime Validation

```bash
gitagent validate --compliance
```

Checks:
- Are role assignments valid? (no agent assigned multiple conflicting roles)
- Are handoff workflows achievable? (can the required roles be reached in sequence)
- Does the agent isolation match the enforcement mode?

**Outcome**: `gitagent audit` produces a compliance report mapping agent configuration to specific regulatory requirements (FINRA 3110, SEC 17a-4, etc.).

---

## 6. Key Patterns & Features

### 6.1 SkillsFlow: Deterministic Multi-Step Workflows

Unlike LLM-driven orchestration (where the model decides the sequence), SkillsFlow is a **fixed YAML-defined workflow** with conditional execution.

```yaml
name: regulatory-review
steps:
  - id: classify
    skill: regulatory-analysis
    outputs: [doc_type, applicable_rules]

  - id: analyze
    depends_on: [classify]
    skill: regulatory-analysis
    inputs:
      rules: ${{ steps.classify.outputs.applicable_rules }}
    outputs: [findings, confidence_scores]

  - id: verify-facts
    depends_on: [analyze]
    agent: fact-checker
    inputs:
      claims: ${{ steps.analyze.outputs.findings }}
    outputs: [verified_findings]

  - id: human-review
    depends_on: [verify-facts]
    skill: document-review
    conditions:
      - ${{ steps.analyze.outputs.findings.critical_count > 0 }}
    compliance:
      requires_approval: true

  - id: generate-report
    depends_on: [verify-facts, human-review]
    tool: generate-report
    inputs:
      findings: ${{ steps.verify-facts.outputs.verified_findings }}

error_handling:
  on_failure: escalate
  escalation_target: chief-compliance-officer
```

**Why this matters for restaurant ops**:
- Order workflows (submit → payment → kitchen prep → delivery) are deterministic, not LLM-driven
- Inventory reconciliation (count → cost → variance analysis → reorder) follows a fixed path
- Labor scheduling has hard constraints (break laws, union rules, availability)
- Compliance checks (health inspections, audit logs) must follow a repeatable sequence

---

### 6.2 Human-in-the-Loop via Branches + PRs

When an agent learns a new skill or modifies memory:
1. Agent creates a **feature branch** (e.g., `agent/new-skill-payment-processing`)
2. Agent opens a **pull request** with changes
3. **Human reviews** the diff (code, prompts, compliance implications)
4. **Merge → agent deploys** with new skill

This pattern is built into the design but not enforced by the CLI yet.

---

### 6.3 Agent Versioning & Deployment

```bash
# Tag a stable version
git tag -a v1.2.0 -m "Adds payment compliance checks"
git push origin v1.2.0

# Promote through environments
git checkout -b deploy/staging v1.2.0     # Canary on staging
git checkout -b deploy/prod v1.2.0        # After testing, deploy to prod
```

Every change is auditable: `git log --oneline`, `git diff v1.1.0..v1.2.0`

---

### 6.4 Agent Inheritance & Composition

```yaml
# Extend a parent agent
extends: https://github.com/org/base-compliance-agent.git

# Compose with dependencies
dependencies:
  - name: fact-checker
    source: https://github.com/org/fact-checker.git
    version: ^1.0.0
    mount: agents/fact-checker
    vendor_management:
      due_diligence_date: "2026-01-15"
      soc_report: false
```

**For CarabinerOS**: A base `restaurant-agent` could have order/inventory/labor/reporting modules. Domain-specific agents (pizza shop, fine dining, catering) inherit and customize.

---

### 6.5 Shared Context & Skills via Monorepo

Root-level files are automatically shared:

```
company-agents/           # Monorepo
├── RULES.md             # Shared rules (all agents follow these)
├── DUTIES.md            # Company-wide SOD policy
├── skills/
│   ├── payment-processing/
│   ├── order-verification/
│   └── food-cost-analysis/
├── tools/
│   ├── stripe.yaml
│   ├── square.yaml
│   └── airtable.yaml
├── knowledge/
│   ├── health-code-regulations.md
│   ├── labor-laws.md
│   └── food-handling.md
└── agents/
    ├── quick-service/
    │   ├── agent.yaml
    │   └── SOUL.md
    ├── fine-dining/
    │   ├── agent.yaml
    │   └── SOUL.md
    └── catering/
        ├── agent.yaml
        └── SOUL.md
```

No duplication. One source of truth.

---

## 7. Export Adapters: The Portability Mechanism

GitAgent can export the same agent definition to 12+ frameworks:

| Adapter | Format | Use Case |
|---------|--------|----------|
| `system-prompt` | Markdown → any LLM | Universal, lowest common denominator |
| `claude-code` | CLAUDE.md | Claude Code IDE integration |
| `openai` | Python (Agents SDK) | OpenAI Agents |
| `crewai` | YAML + Python | CrewAI framework |
| `langchain` | Python | LangChain agents/chains |
| `langgraph` | Python StateGraph | LangGraph workflows |
| `opencode` | JSON + markdown | OpenCode.dev |
| `cursor` | `.cursor/rules/*.mdc` | Cursor IDE |
| `github-actions` | GitHub Actions YAML | CI/CD automation |
| `lyzr` | JSON API call | Lyzr Studio |
| `openclaw` | YAML | OpenClaw workspace format |
| `gemini` | GEMINI.md | Google Gemini CLI |
| `copilot` | Python | GitHub Copilot |

**How it works**:

```typescript
// src/adapters/system-prompt.ts
export function exportToSystemPrompt(dir: string): string {
  const manifest = loadAgentManifest(dir);
  const soul = loadFileIfExists(join(dir, 'SOUL.md'));
  const rules = loadFileIfExists(join(dir, 'RULES.md'));
  const skills = loadAllSkills(join(dir, 'skills'));

  // Concatenate into a single system prompt
  return [manifest.name, soul, rules, ...skills].join('\n\n');
}
```

**Key insight**: The adapter is just a **concatenation strategy** + framework-specific wrapping. The adapter preserves what it can, documents what it loses.

---

## 8. Code Quality & Design Decisions

### Why GitAgent is "Beautifully Built"

**1. Clarity Over Cleverness**
- No inheritance hierarchies or mixins
- One file per command, one adapter per framework
- Straightforward imperative code, not over-abstracted

**2. Minimal Dependencies**
- Only 5 runtime dependencies (js-yaml, commander, inquirer, chalk, ajv)
- Compare: LangChain has 50+, CrewAI has 30+
- Supply chain security by default

**3. Honest About Limits**
Each adapter documents what's lossy:
- "CrewAI can't model segregation of duties — will be documented in comments"
- "OpenAI SDK doesn't support multi-agent coordination — manual wiring required"
- This honesty is rare in OSS tools

**4. Spec-Driven Design**
- `spec/SPECIFICATION.md` is the source of truth, not the code
- JSON schemas in `spec/schemas/` validate conformance
- Adapters are derived from the spec, not the source
- New adapters don't require modifying the spec

**5. Progressive Disclosure**
- Skills shown as metadata only (name, description, allowed_tools)
- Full skill instructions loaded on-demand
- Prevents token explosion in large agents

**6. Test-First Naming**
- CLI commands have clear naming: `export`, `import`, `run`, `validate`, `audit`
- Each maps to a concrete, testable function
- No hidden side effects

**7. Error Messages as Documentation**
```
"Failed to load agent.yaml: file not found at /path/to/agent.yaml"
  → User knows exactly what to fix

vs.

"Error: ENOENT"
  → User is confused
```

---

## 9. Compliance Deep-Dive: Regulatory Mapping

GitAgent's compliance model maps directly to regulations, not invented abstractions.

### FINRA (Financial Industry Regulatory Authority)
- **Rule 2210** (Communications) → `communications.fair_balanced`, `no_misleading`
- **Rule 3110** (Supervision) → `supervision.human_in_the_loop`, `escalation_triggers`, `kill_switch`
- **Rule 4511** (Books and Records) → `recordkeeping.audit_logging`, `retention_period`, `immutable`
- **Reg Notice 24-09** (AI/LLM applicability) → Framework for applying existing rules

### SEC (Securities and Exchange Commission)
- **Reg BI** (Fiduciary duty) → `supervision.override_capability`
- **Reg S-P** (Privacy) → `data_governance.pii_handling: redact | encrypt | prohibit`
- **Reg S-ID** (Identity verification) → `data_governance.consent_required`
- **Rule 17a-4** (Recordkeeping) → `recordkeeping.retention_period: 6y`

### Federal Reserve
- **SR 11-7** (Model Risk Management) → `model_risk.validation_cadence`, `ongoing_monitoring`, `drift_detection`
- **SR 23-4** (Third-Party Risk) → `vendor_management.due_diligence_complete`, `soc_report_required`

### CFPB (Consumer Financial Protection Bureau)
- **Circular 2022-03** (Fair Lending) → `data_governance.bias_testing`, `lda_search`
- **Adverse Action Notices** → `data_governance.pii_handling: redact`

---

## 10. Comparison to Alternatives

### GitAgent vs. Raw YAML/JSON Config
- **YAML**: Full flexibility, zero standardization
- **GitAgent**: Community standard, validated, portable, tooling layer

### GitAgent vs. Framework-Native Code (LangChain, CrewAI, etc.)
- **Framework-Native**: Most powerful, framework-specific, not portable
- **GitAgent**: Portable, auditable, versioned, but executed *by* frameworks

### GitAgent vs. ADL (Agent Definition Language)
- **ADL**: Describes agent *interface* (inputs/outputs/tools)
- **GitAgent**: Describes how agent *behaves* (identity, rules, compliance, skills)

### GitAgent vs. CLAUDE.md
- **CLAUDE.md**: Claude Code-specific, no version history, no compliance
- **GitAgent**: Framework-agnostic, git versioning, compliance built-in, export to Claude

---

## 11. Relevance to CarabinerOS

CarabinerOS is a **restaurant management dashboard on Agent Zero** (an agentic AI framework). Here's what GitAgent offers:

### 1. **Agent Versioning & Audit Trail**
Restaurant operations are heavily regulated (health codes, labor laws, tax). GitAgent's git-native versioning means:
- Every prompt change is auditable (`git log`)
- Rollback broken agents instantly
- Proof of compliance for inspectors

### 2. **Segregation of Duties for Operations**
Restaurants need clear role separation:
- **Manager** (create orders, inventory adjustments)
- **Kitchen** (confirm receipt, prep tracking)
- **Cashier** (payment verification, reconciliation)
- **Auditor** (variance tracking, theft detection)

GitAgent's SOD model maps directly to restaurant workflows.

### 3. **Multi-Location Tenant Isolation**
Each restaurant location could be a sub-agent:
```yaml
agents:
  location-nyc:
    description: NYC flagship location
    delegation:
      mode: auto
  location-boston:
    description: Boston expansion
  location-chicago:
    description: Chicago catering hub
```

Each location inherits shared rules/skills but can override for local regulations.

### 4. **SkillsFlow for Kitchen Workflows**
Restaurant workflows are deterministic:
```yaml
steps:
  - id: validate-order
    skill: order-validation
    conditions:
      - payment_verified: true
  - id: send-to-kitchen
    depends_on: [validate-order]
    skill: kitchen-assignment
    inputs:
      order: ${{ trigger.order }}
  - id: estimate-time
    depends_on: [send-to-kitchen]
    tool: prep-time-calculator
  - id: notify-customer
    depends_on: [estimate-time]
    skill: customer-notification
```

Not LLM discretion — strict sequence with human escalation on error.

### 5. **Compliance & Health Inspection Ready**
Health departments require:
- Audit logs of food handling decisions
- Proof of temperature checks
- Labor law compliance (breaks, overtime)
- Allergen tracking

GitAgent's compliance block + audit trails = built-in regulatory readiness.

### 6. **Skills Ecosystem for Restaurants**
Reusable skills across locations:
```
skills/
├── order-fulfillment/
├── inventory-management/
├── labor-scheduling/
├── food-cost-tracking/
├── health-code-compliance/
├── customer-management/
└── financial-reconciliation/
```

One location's learning (e.g., "how to handle rushes") automatically available to others.

### 7. **Honest Delegation Strategy**
Agent Zero's framework allows arbitrary automation. GitAgent provides:
- Explicit delegation modes (auto, explicit, router)
- Human escalation triggers (low confidence, error detected)
- Kill switches for critical operations
- Compliance constraints that block unsafe decisions

This prevents AI from making unchecked food safety or labor law violations.

### 8. **Multi-Framework Export**
If you later want to move CarabinerOS to:
- LangChain (different LLM provider)
- CrewAI (better orchestration UI)
- Custom runtime (proprietary backend)

The agent definition travels with you. Not locked in.

---

## 12. Implementation Ideas for CarabinerOS

### A. Add Agent Versioning
Wrap Agent Zero's chat/memory endpoints to:
- Commit prompts/rules/skills to git on each deploy
- Tag releases (v1.2.0 = "added allergen tracking")
- Allow rollback via git checkout

### B. Multi-Location Agents with SOD
```yaml
agents:
  location-management:
    description: Location-level operations
    agents:
      manager:
        duties: [create, approve, override]
      staff:
        duties: [execute, report]
      auditor:
        duties: [verify, escalate]
    segregation_of_duties:
      conflicts:
        - [manager, auditor]
```

### C. Regulatory Compliance Block
```yaml
compliance:
  frameworks: [health_code, labor_law, food_safety]
  supervision:
    human_in_the_loop: conditional
    escalation_triggers:
      - action_type: schedule_adjustment  # Labor law approval
      - action_type: temperature_override  # Food safety approval
```

### D. SkillsFlow for Order-to-Delivery
Replace open-ended LLM orchestration with deterministic workflows.

### E. Audit Reports
`carabiner audit` generates:
- "All orders processed through payment verification"
- "No food handling decisions made below temperature threshold"
- "All labor scheduling compliant with break laws"

---

## 13. Patterns Worth Stealing

### 1. **Minimal-First Design**
Start with just `agent.yaml` + `SOUL.md`. Add directories only when needed. (Not "here's a 50-file template!")

### 2. **Honest Adapter Design**
Each adapter documents what it CAN'T do. E.g., "OpenAI SDK doesn't support multi-agent isolation — you'll need to implement this manually in Python."

### 3. **Validation as a CLI Command**
`gitagent validate` runs before deploy. Returns non-zero exit code if compliance checks fail. CI/CD friendly.

### 4. **Progressive Disclosure**
Don't load all knowledge/skills/examples into the prompt. Load on-demand. Keep initial context lean.

### 5. **Spec-First Architecture**
The spec (SPECIFICATION.md) is the source of truth. Code is derived from it. Not the other way around.

### 6. **Compliance as First-Class**
Not a side note, not a plugin, not a checkbox. Built into `agent.yaml`, validated by `gitagent validate --compliance`, audited by `gitagent audit`.

### 7. **Segregation of Duties via Roles**
Not enforced at the code level, but declared in YAML and validated at deploy time. Humans review the role matrix before merge.

---

## 14. Gaps & Honest Limitations

GitAgent has documented gaps (from CONTRIBUTING.md):

1. **Test Coverage** — "We're light on tests — help is very welcome"
2. **Adapter Fidelity** — "Most exports are lossy today"
3. **No Runtime Orchestration** — GitAgent defines identity; frameworks handle execution
4. **No Standard Memory Format** — Agents can write to `memory/MEMORY.md`, but no standard serialization/retrieval
5. **Skill Installation** — `gitagent skills add` is mentioned but not fully baked
6. **Version Pinning** — Dependencies can be pinned but no lock file (like package-lock.json) yet

---

## 15. Conclusion: Why GitAgent Matters

GitAgent solves a **real problem**: agent portability and compliance. It does this with:

- **Minimal scope** — A standard + CLI, not a runtime
- **Minimal dependencies** — 5 vs. 50+
- **Spec-driven** — Protocol not code
- **Honest about gaps** — Adapters document what they can't do
- **Compliance-native** — FINRA/SEC/Fed rules are first-class, not afterthoughts

For **CarabinerOS**, the most valuable lessons are:

1. **Versioning** — Every agent change should be git-tracked
2. **Segregation of Duties** — Roles for manager/staff/auditor with handoff workflows
3. **Deterministic Workflows** — Kitchen orders follow fixed paths, not LLM whimsy
4. **Compliance as Code** — Health codes/labor laws are agent constraints, not instructions
5. **Progressive Disclosure** — Load skills/knowledge on-demand, not upfront
6. **Honest Delegation** — Kill switches and escalation triggers for unsafe decisions

---

## References

- **GitHub**: https://github.com/open-gitagent/gitagent
- **README**: Full patterns, CLI commands, examples
- **SPECIFICATION.md**: Authoritative schema and directory structure
- **CONTRIBUTING.md**: Architecture, design philosophy, how to add adapters
- **docs/comparison.md**: Detailed comparison to ADL, raw YAML, framework-native code
- **examples/**: minimal (2-file), standard, full (production-grade with compliance)

---

**Research completed**: 2026-03-25
**Next steps**: Consider adopting GitAgent patterns for CarabinerOS agent versioning, SOD, and compliance tracking.
