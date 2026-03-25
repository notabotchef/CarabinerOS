# Rune Kit Framework Research — Executive Summary

**Research Completed**: March 21, 2026
**Status**: Comprehensive review of Rune v2.2.2
**Scope**: Full stack analysis (architecture, skills, workflows, quality gates)
**Output**: 2 reference documents (63KB comprehensive guide + 11KB quick reference)

---

## What is Rune?

Rune is a **mesh-based skill ecosystem** for AI coding assistants. It is NOT a linear tool pipeline or a rigid framework. It's a **bidirectional network** of 58 interconnected skills across 5 layers that can call each other, fail gracefully, and adapt around obstacles.

**Key Statistics**:
- 58 core skills (L0-L3)
- 14 free extension packs + 4 pro + 4 business (L4)
- 200+ mesh connections between skills
- 8 platforms supported (Claude Code, Cursor, Windsurf, Antigravity, Codex, OpenCode, OpenClaw, Generic)
- 8-phase TDD cycle (cook orchestrator)
- Phase-aware multi-session execution (one phase per session = better context)

---

## The 5-Layer Architecture

```
L0: ROUTER (1)           — skill-router enforces routing discipline
                           Routes EVERY action before execution

L1: ORCHESTRATORS (5)    — cook, team, launch, rescue, scaffold
                           Full lifecycle workflows, stateful

L2: WORKFLOW HUBS (27)   — 200+ cross-connections
                           Specific domains (debug, fix, test, review, etc.)

L3: UTILITIES (25)       — Stateless, pure capabilities
                           Validation, knowledge, reasoning, state management

L4: EXTENSION PACKS (14+) — Domain-specific instruction sets
                           @rune/ui, @rune/backend, @rune/security, etc.
```

**Key Rules**:
- L0 routes to L1-L3 (always first check)
- L1 calls L2-L3 (orchestrators coordinate)
- L2 calls L2 (cross-hub mesh) or L3 (utilities)
- L3 calls nothing (stateless, pure)
- L4 calls L3 only (domain knowledge, not orchestrators)
- Exception: team (L1) can call other L1s for meta-orchestration

---

## The Cook Workflow (8-Phase TDD)

Cook is the heart of Rune. It handles 70% of all requests and implements a full TDD cycle:

### Quick Overview
```
Phase 0: RESUME           Check for existing plan, load current phase
Phase 1: UNDERSTAND       Scout codebase, elicit requirements (BA)
Phase 1.5: L4 PACKS       Load domain-specific patterns if applicable
Phase 2: PLAN             Break into concrete steps, user approval
Phase 2.5: ADVERSARY      Red-team stress-test the plan
Phase 3: TEST             Write failing tests (TDD red)
Phase 4: IMPLEMENT        Make tests pass (TDD green)
Phase 5: QUALITY          Parallel quality gates (preflight, sentinel, review)
Phase 6: VERIFY           Lint + types + tests + build ALL must pass
Phase 7: COMMIT           Semantic git commit
Phase 8: BRIDGE           Save context, capture learnings for next session
```

### Auto-Detection (Not All Phases Always)

Cook auto-detects complexity and streamlines:

**NANO MODE** (≤3 steps, <60 chars, no logic):
- Execute directly: DO → VERIFY → DONE
- No planning, no tests, no phases
- Still verify output

**FAST MODE** (<30 LOC, single file, no security/API/DB):
- Skip Phase 2 (PLAN) and Phase 3 (TEST)
- Keep Phase 5 (PREFLIGHT + SENTINEL) and Phase 6 (VERIFY)
- All quality gates still required

**FULL MODE** (everything else):
- All 8 phases, all gates

### Key Gates (Cannot Skip)

1. Scout before planning (Phase 1→2)
2. Plan user approval (Phase 2→3)
3. Failing tests exist (Phase 3→4)
4. All tests pass (Phase 4→5)
5. Quality gates pass (Phase 5→6)
6. Verification green (Phase 6→7)
7. No secrets committed (anytime)

---

## Skill-Router (L0 Enforcement)

The router is the missing enforcement layer. It checks a routing table BEFORE every response involving code.

### The Routing Table

| Intent | Route To | When |
|--------|----------|------|
| Build/implement/fix | `rune:cook` | Any code change (DEFAULT) |
| Large multi-part task | `rune:team` | 5+ files or 3+ modules |
| Deploy + marketing | `rune:launch` | Ship to production |
| Modernize legacy code | `rune:rescue` | Old/messy codebase |
| New project | `rune:scaffold` | Greenfield bootstrap |
| Code review | `rune:review` | Check quality |
| Bug investigation | `rune:debug` | Find root cause |
| Database changes | `rune:db` | Schema, migrations |
| Performance | `rune:perf` | Bottleneck analysis |
| Security | `rune:sentinel` | OWASP, secrets, deps |
| Specific domain | `@rune/<pack>` | UI, backend, mobile, etc. |

### Request Classifier (Enforcement Levels)

Before routing, classify request type:

| Type | Enforcement | Action |
|------|-------------|--------|
| CODE_CHANGE | FULL | cook mandatory |
| QUESTION | LITE | Check skill first; direct answer if no match |
| DEBUG_REQUEST | FULL | debug mandatory |
| REVIEW_REQUEST | FULL | review mandatory |
| EXPLORE | LITE | scout if codebase; direct if general |

**FULL enforcement** = routing is mandatory. Writing code without skill = protocol violation.

### Routing Proof (Required)

Every code response must begin with:
```
> Routed: rune:<skill> | Type: CODE_CHANGE | Confidence: HIGH
```

This is evidence that routing occurred, not optional formatting.

---

## Team Orchestration (Parallel Workstreams)

Use when task spans 5+ files or 3+ modules. Team decomposes, assigns parallel cook instances, coordinates, merges.

### 5-Phase Flow

**Phase 1: DECOMPOSE**
- Scout modules, identify dependencies
- Plan workstreams (2-3 streams, disjoint file ownership)
- Validate: no coupled modules, explicit depends_on, total ≤3 streams

**Phase 2: ASSIGN**
- Launch parallel cook instances with NEXUS Handoff (structured context)
- Each stream: deliverables, quality expectations, evidence requirements
- Dependent streams wait for dependencies to complete

**Phase 3: COORDINATE** (Full mode only)
- Check file conflicts (git diff between worktrees)
- Verify cook report integrity (hallucination-guard)
- Evaluate subagent status (DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, BLOCKED)
- Cross-workstream review if concerns found

**Phase 4: MERGE**
- Merge sequentially (worktree-1 → main, worktree-2 → main, etc.)
- Resolve conflicts (≤3 files agent decides, >3 files ask user)
- Cleanup worktrees

**Phase 5: VERIFY**
- Run integration tests on merged main
- If fail: rollback to pre-team-merge tag

### NEXUS Handoff Template (Critical)

When dispatching agents, provide structured handoff with:
- **Metadata**: stream ID, dependencies, file ownership list
- **Context**: project, conventions, tech stack
- **Deliverables**: 3-5 explicit testable outcomes
- **Quality**: no `any`, parameterized queries, tests pass
- **Evidence**: git diff + test output required

**Never send**: Bare prompt "implement feature X"
**Always send**: NEXUS Handoff with full structure

---

## Quality Gates (HARD-GATEs)

Rune's gates are circuit breakers, not suggestions. A workflow cannot proceed without passing.

### The 8 HARD-GATEs in Cook

| Gate | Phase | Blocks | Consequence |
|------|-------|--------|------------|
| **Scout-Before-Plan** | 1→2 | Proceed to Phase 2 | Run scout first |
| **Plan Approval** | 2→3 | Proceed to Phase 3 | User must approve |
| **Failing Tests** | 3→4 | Proceed to Phase 4 | Tests must FAIL before code |
| **All Tests Pass** | 4→5 | Proceed to Phase 5 | Fix all failures |
| **Quality Gates** | 5→6 | Proceed to Phase 6 | Preflight + sentinel + review all pass |
| **Verification Green** | 6→7 | Proceed to commit | Lint, types, tests, build |
| **Completion-Gate CONFIRMED** | 5d | Proceed | All claims have evidence |
| **No Secrets** | anytime | Commit | Remove hardcoded secrets |

### Completion-Gate (The Lie Detector)

Validates agent claims against evidence. **Default-FAIL mindset**: assume claim is wrong unless proven.

**Three-Level Artifact Verification**:

1. **EXISTS** — File on disk, non-empty
2. **SUBSTANTIVE** — Real logic, not stub (no `Placeholder`, `TODO`, `return null`)
3. **WIRED** — Imported/called by rest of system

**Claim Validation**:
- Test "tests pass" → require actual test output with pass count
- Claim "build succeeds" → require build command output
- Claim "fixed bug" → require git diff + test proving fix
- No evidence = UNCONFIRMED = BLOCK

**Verdicts**:
- ALL CONFIRMED → proceed
- ANY CONTRADICTED → fix it
- ANY UNCONFIRMED → provide evidence

---

## Session Persistence (Cross-Session Memory)

### In-Session State (session-bridge)

Saves to `.rune/` directory:
```
.rune/
  decisions.md           — approach + trade-offs + constraints
  conventions.md         — patterns discovered
  progress.md            — task completion status
  metrics/
    skills.json          — skill usage stats, debug loops, quality results
    routing-overrides.json  — adaptive routing rules (H3)
  features/
    <name>/
      spec.md
      plan.md
      decisions.md
      status.md
```

### Cross-Session Memory (neural-memory)

Semantic vector store for learnings:

**Recall Mode** (Phase 0):
```
neural_memory.recall(
  topics=["ProjectName auth pattern", "async Python", "Socket.IO"],
  limit=5
)
```

**Capture Mode** (Phase 8):
```
neural_memory.capture(
  memories=[
    {
      "type": "decision",
      "content": "Chose async/await pattern for consistency with Socket.IO handlers",
      "tags": ["carabiner", "python", "async"],
      "priority": 7
    }
  ]
)
```

### Multi-Session Resume (Phase-Aware)

```
Session 1: Opus creates master plan + phase files
          .rune/plan-auth.md
          .rune/plan-auth-phase1.md
          .rune/plan-auth-phase2.md
          .rune/plan-auth-phase3.md

Session 2: Phase 0 detects plan → loads ONLY Phase 2 → executes Phase 2-7
          (Does NOT load Phase 1, 3 — too much context)

Session 3: Phase 0 resumes → loads Phase 3 → executes

Result: One phase per session = small context = better code from any model
```

---

## The Mesh (200+ Connections)

Rune's key differentiator. Instead of linear pipelines (A → B → C, B fails = stuck), the mesh allows skills to call each other bidirectionally.

### Cross-Hub Mesh (L2 ↔ L2)

Examples:
- `plan` ↔ `brainstorm` (creative ↔ structure)
- `fix` ↔ `debug` (fix root cause ↔ find root cause)
- `test` → `debug` (test fails → debug)
- `review` → `test` (untested edge case found → write test)
- `review` → `fix` (bug found → fix it)

### Error Handling & Resilience

| If this fails... | Try this instead... | Reasoning |
|---|---|---|
| debug can't find cause | problem-solver | Different reasoning approach |
| docs-seeker can't find | research | Broader search surface |
| scout can't find files | research + docs-seeker | Find docs about project |
| test can't run (env broken) | deploy → fix env → test | Environmental issue |

### Loop Prevention (Safety)

```
Rule 1: No self-calls
Rule 2: Max 2 visits per skill per chain
Rule 3: Max chain depth 8
Rule 4: If blocked → escalate to L1 orchestrator
```

---

## Verification Pipeline

### Universal Verification (All Languages)

`rune:verification` handles TypeScript, Python, Rust, Go, Java:

```
1. LINT         — eslint, ruff, clippy, golangci-lint, checkstyle
2. TYPE-CHECK   — tsc, mypy, cargo check, go vet, javac
3. TESTS        — jest, pytest, cargo test, go test, junit
4. BUILD        — npm run build, python -m build, cargo build, go build
```

### hallucination-guard (Code Verification)

Verifies code is real, not hallucinated:
1. Imports exist
2. API signatures match
3. Framework methods are real (React hooks, Django views, etc.)

### sast (Static Analysis Security Testing)

Deep security analysis:
- SQL injection patterns
- XSS vulnerabilities
- CSRF validation
- Cryptographic weakness
- Hardcoded credentials
- Unsafe deserialization

---

## Recommended Workflow for Carabiner OS

### Adding a Feature (JWT Auth System)

```
/rune cook "Add JWT authentication with login/register/reset"

Phase 0: Resume? (No master plan)
Phase 1: Scout detects Next.js + Python/Flask + Socket.IO
         BA elicits requirements (multi-tenant? roles? OAuth?)
         Decision: async-first Python detected
Phase 1.5: @rune/backend pack loads API auth patterns
Phase 2: Plan produces 3-phase master plan (backend → frontend → integration)
         User approves
Phase 2.5: Adversary tests: JWT expiration, token refresh edge cases
Phase 3: Test writes 15 failing tests (async Python)
Phase 4: Fix implements AsyncAuthService with pytest-asyncio
         All tests pass
Phase 5: Quality gates (parallel) — all pass
Phase 6: Verification — mypy, pytest, build all green
Phase 7: Commit — feat(auth): add JWT authentication
Phase 8: Bridge — save approach, capture pattern

NEXT SESSION:
Phase 0: Resume detects Phase 2 (frontend) → load ONLY Phase 2
Phase 3-7: Frontend implementation

FINAL SESSION:
Phase 0: Resume detects Phase 3 (integration)
Phase 3-7: Integration tests → complete
```

### Parallel Optimization (Team)

```
/rune team "Optimize dashboard: frontend + backend in parallel"

DECOMPOSE:
  Stream A: Frontend — code splitting, lazy loading
  Stream B: Backend — API caching, N+1 fixes
  Dependency: B before A (API ready first)

ASSIGN:
  Launch cook instances with NEXUS Handoff
  Stream B gets deliverables: API response <500ms, no N+1 queries

COORDINATE:
  Check for conflicts (none — disjoint files)
  Verify cook reports

MERGE:
  Merge B → main
  Merge A → main

VERIFY:
  Integration tests pass
  Dashboard loads <2s total
```

---

## Key Takeaways for Proper Rune Usage

1. **Always route through skill-router** — check routing table before EVERY response involving code
2. **Use cook for code changes** — 70% of requests, handles everything from bugfixes to large features
3. **Use team for large tasks** — 5+ files, parallel workstreams with proper decomposition
4. **Honor ALL HARD-GATEs** — they are circuit breakers, not suggestions
5. **Provide evidence for claims** — completion-gate will validate
6. **Phase-aware execution** — one phase per session, load only current phase
7. **Structured handoffs for team** — NEXUS templates, not bare prompts
8. **Decision logging** — save choices to `.rune/` for cross-session recall
9. **Scope discipline** — define boundaries before coding, no out-of-scope changes
10. **Cross-session persistence** — session-bridge saves state, neural-memory saves learnings

---

## Anti-Patterns (What NOT to Do)

| Anti-Pattern | Why It Fails |
|---|---|
| Skip quality gates | Gates are safety mechanisms, not bureaucracy |
| "I'll follow patterns mentally" | Mental application misses constraints |
| Read 10+ files before writing | Analysis paralysis — write first, iterate |
| Merge without verification | Integration bugs hide at merge time |
| Nano mode for security files | .env, auth, crypto need full pipeline |
| Bare prompts to agents | NEXUS Handoff required for team dispatch |
| Ignore sentinel CRITICAL | Security issues block commits |
| Overlapping file ownership | Team will have merge conflicts |
| Skip Phase 8 Bridge | Next session loses context |

---

## File Locations (In Rune Repo)

```
/tmp/rune-repo/
├── skills/
│   ├── cook/SKILL.md                — Full 8-phase TDD cycle (25KB)
│   ├── team/SKILL.md                — Parallel orchestration (3KB)
│   ├── skill-router/SKILL.md        — Routing enforcement (8KB)
│   ├── verification/SKILL.md        — Universal verification
│   ├── completion-gate/SKILL.md     — Claim validation (THE LIE DETECTOR)
│   └── [55 other skills]
├── agents/
│   ├── cook.md                      — Cook agent definition
│   ├── team.md                      — Team agent definition
│   └── [50+ other agent definitions]
├── docs/
│   ├── ARCHITECTURE.md              — Full 5-layer model
│   ├── SKILL-TEMPLATE.md            — How to write skills
│   ├── EXTENSION-TEMPLATE.md        — How to write packs
│   └── [14+ other docs]
├── extensions/
│   ├── ui/PACK.md                   — @rune/ui (design system)
│   ├── backend/PACK.md              — @rune/backend (API patterns)
│   ├── devops/PACK.md               — @rune/devops (Docker, CI/CD)
│   └── [11+ other packs]
├── RUNE_COMPREHENSIVE_GUIDE.md      — This research (63KB)
└── RUNE_QUICK_REFERENCE.md          — Quick lookup (11KB)
```

---

## Deliverables

### 1. RUNE_COMPREHENSIVE_GUIDE.md (63KB)

**Complete technical reference covering**:
- Executive summary
- Full skill catalog (all 58 skills with descriptions)
- Cook workflow (8-phase TDD, auto-detection, gates)
- skill-router (routing table, request classifier, enforcement)
- Mesh architecture (5-layer model, cross-hub connections, resilience)
- Quality gates (all 8 HARD-GATEs, completion-gate details)
- Team orchestration (5-phase decomposition, NEXUS handoff, merge strategy)
- Agent dispatch best practices (file ownership, code contracts, structured handoff)
- Session persistence (session-bridge, neural-memory, multi-session resume)
- Verification pipeline (universal verification, hallucination-guard, sast)
- Recommended workflows for Next.js + Python + PostgreSQL
- Common patterns and anti-patterns
- Troubleshooting guide

### 2. RUNE_QUICK_REFERENCE.md (11KB)

**Fast lookup card**:
- When to use each skill (quick decision table)
- Cook phases at a glance
- Mode auto-detection (nano/fast/full)
- Team decomposition flow
- Quality gates (all 8 with fixes)
- Evidence requirements
- NEXUS handoff structure
- Python async flags
- Three-level artifact verification
- Session persistence summary
- Error recovery chain
- Anti-patterns
- Routing flowchart
- Pre-start checklist
- Stack-specific recommendations
- Command reference
- Troubleshooting flow

---

## Bottom Line

Rune is **not just another AI framework**. It is a **disciplined, resilient system** for building software reliably with AI agents. Its key innovations:

1. **Mesh instead of pipeline** — failures don't cascade, skills route around obstacles
2. **Phase-aware execution** — large tasks split across sessions, one phase at a time, amateur-proof
3. **Quality gates as circuit breakers** — not suggestions, hard blocks that cannot be bypassed
4. **Evidence-first validation** — claims require proof (test output, diffs, build logs)
5. **Cross-session persistence** — decisions, patterns, and learnings survive session boundaries
6. **Adaptive routing** — auto-detects complexity and streamlines (nano, fast, full modes)
7. **Structured handoffs** — NEXUS templates prevent context loss in multi-agent workflows

For Carabiner OS, this means:

- Build features safely with full TDD discipline
- Parallelize large tasks (auth + dashboard + reporting)
- Never commit without passing verification
- Resume mid-feature across sessions without context loss
- Catch hallucinated code before it ships

The framework is designed for teams that value **correctness over speed** and **resilience over convenience**.

---

**Research Completed**: March 21, 2026
**Documents Generated**: 2 reference guides (74KB total)
**Repository**: https://github.com/rune-kit/rune
**Recommendation**: Read the quick reference first, then dive into comprehensive guide as needed.
