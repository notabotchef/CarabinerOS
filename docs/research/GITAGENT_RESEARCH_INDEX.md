# GitAgent Research Index

**Date**: 2026-03-25
**Status**: Complete
**Source**: https://github.com/open-gitagent/gitagent (cloned, analyzed, patterns extracted)

---

## Quick Navigation

### For High-Level Overview
Start here: **[RESEARCH_GITAGENT.md](./RESEARCH_GITAGENT.md)**

Contains:
- What GitAgent is (1-page summary)
- Why it's "beautifully built" (code quality analysis)
- Architecture and tech stack
- Key patterns and features
- Regulatory compliance deep-dive
- **8 specific opportunities for CarabinerOS**

### For Implementation Details
Start here: **[GITAGENT_PATTERNS_FOR_CARABINER.md](./GITAGENT_PATTERNS_FOR_CARABINER.md)**

Contains:
- 5 patterns with concrete, runnable Python/TypeScript code examples
- Implementation roadmap (6-week phased approach)
- How to wire patterns into existing CarabinerOS architecture
- Specific file paths, function signatures, database models
- Progressive disclosure optimization

---

## The 30-Second Summary

**GitAgent** is a framework-agnostic standard for defining AI agents in git repositories. Instead of embedding agent logic in code, you describe it as structured YAML + Markdown files.

**Why it matters for restaurants**:

1. **Versioning** — Every prompt/rule change is git-tracked, auditable, rollbackable
2. **Segregation of Duties** — Manager/staff/kitchen/auditor roles are enforced, not implicit
3. **Deterministic Workflows** — Order pipelines follow fixed steps, not LLM discretion
4. **Compliance as Code** — Health codes and labor laws are agent constraints, validated at deploy time
5. **Progressive Disclosure** — Load skills/knowledge on-demand, don't bloat system prompts

**Not applicable**: Framework portability (we're only using Agent Zero) and financial compliance (FINRA/SEC). **Highly applicable**: Operational patterns.

---

## The 5 Most Useful Patterns

### 1. Agent Versioning
**Goal**: Every agent change is git-tagged, auditable, rollbackable.

**Implementation**: 3 hours
- Wrap Flask startup to capture `git describe --tags` from `.agents/order-fulfillment/`
- Log version + commit hash in all API responses
- Add rollback endpoint (git checkout tag, restart Flask)

**Why it matters**: Health inspectors ask "show me the rules your system was following on Tuesday." With versioning, you can. Without it, you can't.

**File**: [GITAGENT_PATTERNS_FOR_CARABINER.md § 1](./GITAGENT_PATTERNS_FOR_CARABINER.md#1-agent-versioning-pattern)

### 2. Segregation of Duties
**Goal**: Manager can't audit their own overrides. Kitchen can't approve food safety rules.

**Implementation**: 1 week
- Define roles in `DUTIES.md` (manager, staff, kitchen, auditor)
- Add SOD validator to Flask startup
- Implement escalation handler for conflicting roles
- Create `AgentHandoff` database model + logging

**Why it matters**: Prevents single-person control of critical operations. Required for insurance, compliance, and operational safety.

**File**: [GITAGENT_PATTERNS_FOR_CARABINER.md § 2](./GITAGENT_PATTERNS_FOR_CARABINER.md#2-segregation-of-duties-sod-pattern)

### 3. Deterministic Workflows (SkillsFlow)
**Goal**: Order pipeline follows fixed steps (validate → payment → inventory → kitchen → notify).

**Implementation**: 2 weeks
- Build workflow executor in Python (reads YAML, evaluates conditions, executes steps)
- Create `order-pipeline.yaml` as template
- Add `/api/orders/{id}/timeline` endpoint
- Build frontend timeline widget

**Why it matters**: Reduces error handling complexity, makes debugging transparent, enables auditing.

**File**: [GITAGENT_PATTERNS_FOR_CARABINER.md § 3](./GITAGENT_PATTERNS_FOR_CARABINER.md#3-deterministic-workflows-skillsflow-pattern)

### 4. Compliance as Code
**Goal**: Health code rules (temperatures, allergens, time-temperature control) are enforced by the agent.

**Implementation**: 1 week
- Create `HealthCodeValidator` class with temperature/allergen/time checks
- Wire validation into order execution workflow
- Generate audit reports for health inspectors
- Build compliance dashboard

**Why it matters**: If you can't prove compliance, you can't pass inspection. Automated validation = consistent proof.

**File**: [GITAGENT_PATTERNS_FOR_CARABINER.md § 4](./GITAGENT_PATTERNS_FOR_CARABINER.md#4-compliance-as-code-pattern)

### 5. Progressive Disclosure
**Goal**: Load only the skills/knowledge the agent needs for the current action.

**Implementation**: 3-4 hours
- Index knowledge documents (always_load vs. on-demand)
- Implement selective context loading based on action type
- Measure token savings + response latency

**Why it matters**: Reduces prompt bloat, speeds up responses, saves on token costs.

**File**: [GITAGENT_PATTERNS_FOR_CARABINER.md § 5](./GITAGENT_PATTERNS_FOR_CARABINER.md#5-progressive-disclosure-pattern)

---

## Recommended Reading Order

1. **[RESEARCH_GITAGENT.md § 1-4](./RESEARCH_GITAGENT.md#1-what-is-gitagent)** (20 min)
   - Understand what GitAgent is
   - Why it's well-designed
   - Architecture overview

2. **[RESEARCH_GITAGENT.md § 10-11](./RESEARCH_GITAGENT.md#10-relevance-to-carabiner-os)** (15 min)
   - See 8 specific opportunities for CarabinerOS
   - Understand which patterns matter most

3. **[GITAGENT_PATTERNS_FOR_CARABINER.md](./GITAGENT_PATTERNS_FOR_CARABINER.md)** (30-45 min)
   - Dive into each of the 5 patterns
   - See runnable code examples
   - Understand implementation steps

4. **[RESEARCH_GITAGENT.md § 5-9](./RESEARCH_GITAGENT.md#5-compliance-segregation-of-duties-sod)** (optional, 20 min)
   - Deep-dive on compliance/SOD if interested
   - Regulatory mapping (which rules map to which fields)

---

## TL;DR for Executives

**GitAgent teaches us that good agent design requires:**

1. **Version control as default** — Every prompt, rule, and skill change is tracked
2. **Role-based separation** — Duties are declared and enforced, not implicit
3. **Deterministic workflows** — Critical paths (orders, inventory, labor) don't vary based on LLM mood
4. **Compliance integration** — Rules (health codes, labor laws) are part of the agent, not post-hoc checks
5. **Lean prompts** — Load context selectively, don't bloat with everything

**For CarabinerOS**, this means:
- Restaurant managers can audit "what was the system told to do on Tuesday?"
- Orders follow predictable, auditable workflows
- Health inspectors can see proof of compliance
- Labor scheduling respects break laws by design, not luck
- AI-driven operations become verifiable, not mysterious

**Effort**: 6 weeks for full implementation. Start with versioning (day 1-2) + workflows (week 1-3).

---

## Code Examples Quick Reference

### Versioning
- [Agent.yaml with version field](./GITAGENT_PATTERNS_FOR_CARABINER.md#for-carabiner-os)
- [Flask wrapper to log version](./GITAGENT_PATTERNS_FOR_CARABINER.md#implementation)

### SOD
- [DUTIES.md example with roles/conflicts](./GITAGENT_PATTERNS_FOR_CARABINER.md#proposed-approach-1)
- [SOD validator Python code](./GITAGENT_PATTERNS_FOR_CARABINER.md#implementation-1)

### Workflows
- [order-pipeline.yaml](./GITAGENT_PATTERNS_FOR_CARABINER.md#proposed-approach-2)
- [WorkflowExecutor class](./GITAGENT_PATTERNS_FOR_CARABINER.md#implementation-2)
- [Frontend timeline component](./GITAGENT_PATTERNS_FOR_CARABINER.md#implementation-2)

### Compliance
- [health-code.md](./GITAGENT_PATTERNS_FOR_CARABINER.md#for-carabiner-os-2)
- [HealthCodeValidator class](./GITAGENT_PATTERNS_FOR_CARABINER.md#implementation-3)

### Progressive Disclosure
- [knowledge/index.yaml](./GITAGENT_PATTERNS_FOR_CARABINER.md#proposed-approach-4)
- [Selective context loading](./GITAGENT_PATTERNS_FOR_CARABINER.md#implementation-4)

---

## Key Insights

### Why GitAgent is "Beautifully Built"

From [RESEARCH_GITAGENT.md § 8](./RESEARCH_GITAGENT.md#8-code-quality--design-decisions):

1. **Clarity over cleverness** — No deep hierarchies, one file per command
2. **Minimal dependencies** — 5 vs. 50+ for alternatives (supply chain security)
3. **Honest about limits** — Every adapter documents what's "lossy"
4. **Spec-driven** — SPECIFICATION.md is the source of truth, not the code
5. **Progressive disclosure** — Skills shown as metadata only, full instructions on-demand

### Most Relevant for Restaurants

From [RESEARCH_GITAGENT.md § 11](./RESEARCH_GITAGENT.md#11-relevance-to-carabiner-os):

- **Versioning + audit trail** — Required for regulatory proof
- **Segregation of duties** — Maps to manager/staff/kitchen/auditor roles
- **Deterministic workflows** — Orders, inventory, labor follow fixed paths
- **Compliance-as-code** — Health codes and labor laws are enforced, not documented
- **Progressive disclosure** — Reduces prompt bloat and token usage

---

## Not Applicable (But Useful Conceptually)

From [RESEARCH_GITAGENT.md § 2](./RESEARCH_GITAGENT.md#tech-stack--architecture):

- **Framework portability** — We only use Agent Zero, don't need to export to 12 frameworks
- **Financial compliance** — FINRA/SEC rules don't apply to restaurants (but the *pattern* of compliance-as-code does)
- **Agent ecosystem/registry** — We're not building a marketplace of agents

**But the underlying patterns are universally applicable.**

---

## Implementation Roadmap

From [GITAGENT_PATTERNS_FOR_CARABINER.md § 6](./GITAGENT_PATTERNS_FOR_CARABINER.md#6-implementation-roadmap):

- **Phase 1: Versioning** (Week 1-2, 3-5 hours)
- **Phase 2: SOD** (Week 2-3, 4-6 hours)
- **Phase 3: Workflows** (Week 3-5, 20-30 hours)
- **Phase 4: Compliance** (Week 5-6, 10-15 hours)
- **Phase 5: Progressive Disclosure** (Week 6, 3-4 hours)

**Total**: ~6 weeks, no impact on existing functionality (all additive).

---

## Questions to Ask

1. **Should we adopt GitAgent as a tool?** → Probably not. The spec is great, but we don't need framework portability.
2. **Should we adopt GitAgent patterns?** → Absolutely. Versioning, SOD, workflows, compliance-as-code are all improvements.
3. **Which pattern first?** → Versioning (simplest, highest compliance value). Then workflows (operational clarity).
4. **How do we know we're done?** → When every agent change is git-tagged, every workflow step is auditable, and health inspectors can ask "prove you followed the rules" and we show them a git log.

---

## References

- **Original repo**: https://github.com/open-gitagent/gitagent
- **Documentation in repo**:
  - `README.md` — Quick start, patterns, CLI commands
  - `spec/SPECIFICATION.md` — Authoritative schema
  - `CONTRIBUTING.md` — Architecture, design philosophy
  - `docs/comparison.md` — Detailed comparison to alternatives
  - `examples/` — minimal (2-file), standard, full (production-grade)

---

**Research completed by**: Researcher Agent
**Date**: 2026-03-25
**Status**: Ready for architectural review and implementation planning
