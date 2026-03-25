# Rune Quick Reference Card

**For Carabiner OS (Next.js + Python/Flask + PostgreSQL)**

---

## When to Use Each Skill

| Situation | Use This | Why |
|-----------|----------|-----|
| Adding a feature | `/rune cook` | 8-phase TDD, handles 70% of requests |
| Large task (5+ files) | `/rune team` | Parallel workstreams with coordination |
| Shipping to production | `/rune launch` | Deploy + marketing orchestration |
| Modernizing old code | `/rune rescue` | Incremental refactoring with safety net |
| New project from scratch | `/rune scaffold` | 9-phase bootstrap with BA |
| Bug fix | `/rune cook bugfix` | Diagnose → fix → verify (skip planning) |
| Quick change (<30 LOC) | `/rune cook nano` or fast mode | Streamlined pipeline |
| Code review feedback | `/rune review-intake` | Process external feedback |
| Database schema change | Invoke `db` in cook Phase 4 | Migration safety, rollback script |
| Performance issue | `/rune perf` | Bottleneck analysis + optimization |
| Security concern | `/rune sentinel` | Secrets, OWASP, dependency audit |
| Unsure what to do | Ask routing layer — defaults to `cook` | skill-router will guide |

---

## Cook Phases At a Glance

```
Phase 0: RESUME         ← Check for existing plan, load current phase
Phase 1: UNDERSTAND     ← Scout codebase, elicit requirements (BA)
Phase 1.5: L4 PACKS     ← Load domain-specific patterns if applicable
Phase 2: PLAN           ← Break into concrete steps, user approval
Phase 2.5: ADVERSARY    ← Red-team stress-test the plan
Phase 3: TEST           ← Write failing tests (TDD red)
Phase 4: IMPLEMENT      ← Make tests pass (TDD green)
Phase 5: QUALITY        ← Preflight + Sentinel + Review (parallel)
Phase 6: VERIFY         ← Lint + types + tests + build
Phase 7: COMMIT         ← Semantic git commit
Phase 8: BRIDGE         ← Save context, capture learnings

GATES (Cannot skip):
  1→2: Scout done
  2→3: Plan approved
  3→4: Failing tests exist
  4→5: All tests pass
  5→6: Quality gates pass
  6→7: Verification green
  7→8: Commit complete
```

---

## Mode Auto-Detection

| Mode | When | Pipeline | Gates |
|------|------|----------|-------|
| **NANO** | ≤3 steps, <60 chars, no logic | DO → VERIFY → DONE | None, but verify output |
| **FAST** | <30 LOC, 1 file, no security/API/DB | Skip Phase 2+3, keep 5+6 | Preflight + Sentinel required |
| **FULL** | Everything else | All 8 phases | All gates |

---

## Team Decomposition (2-3 Parallel Agents)

```
Step 1: Scout modules + plan workstreams
Step 2: Validate file ownership (disjoint = no conflicts)
Step 3: Launch parallel cook instances with NEXUS Handoff
Step 4: Coordinate (check conflicts, verify reports)
Step 5: Merge sequentially + verify integration tests
Step 6: Report status + deliverables
```

**Critical**: File ownership must be disjoint. No overlaps. No coupled modules across streams.

---

## Quality Gates (HARD-GATEs)

| Gate | Location | Blocks | Fix |
|------|----------|--------|-----|
| **Scout-Before-Plan** | Phase 1→2 | Proceed to Phase 2 | Run scout |
| **Plan Approval** | Phase 2→3 | Proceed to Phase 3 | Get user approval |
| **Failing Tests** | Phase 3→4 | Proceed to Phase 4 | Tests must FAIL before code |
| **All Tests Pass** | Phase 4→5 | Proceed to Phase 5 | Fix failing tests |
| **Quality Gates** | Phase 5→6 | Proceed to Phase 6 | Preflight, Sentinel, Review all pass |
| **Verification Green** | Phase 6→7 | Proceed to commit | Lint, types, tests, build |
| **Completion-Gate CONFIRMED** | Phase 5d | Proceed | Provide evidence for all claims |
| **No Secrets** | Anytime | Block commit | Remove hardcoded secrets |

---

## Evidence Requirements (Completion-Gate)

Every claim needs proof:

| Claim | Required Evidence |
|-------|-------------------|
| "Tests pass" | `npm test` output with pass count |
| "Build succeeds" | Build command output, exit 0 |
| "No lint errors" | Linter output (even if empty) |
| "Fixed bug" | Git diff + test proving fix |
| "Implemented feature" | Files created/modified matching plan |
| "No security issues" | Sentinel report with PASS verdict |
| "Tests cover X%" | Coverage tool output with % |

**HARD-GATE**: No output = UNCONFIRMED = BLOCKED. Get the output or fix it.

---

## NEXUS Handoff (For Team Dispatch)

When launching parallel cook agents, provide this structure:

```markdown
## NEXUS Handoff: Stream [A/B/C]

Metadata: ID, dependencies, file ownership list
Context: Project name, task, conventions
Deliverables: 3-5 explicit outcomes (testable)
Quality: Tests must pass, no `any`, parameterized queries
Evidence: git diff + test output required

Do NOT just say: "implement feature X"
DO provide: full structured handoff
```

---

## Python Async Flags

**If Phase 1 detects async Python** (≥3 of: `async def`, `await`, `aiosqlite`, `aiohttp`, `asyncio.run`):

- New code defaults to `async def`
- No blocking calls in async:
  - `time.sleep()` → `asyncio.sleep()`
  - `requests` → `httpx.AsyncClient`
  - Threads → `asyncio.gather()`
- Verify `pytest-asyncio` installed
- Check `asyncio_mode = "auto"` in `pyproject.toml`

---

## Three-Level Artifact Verification

Every file must pass:

1. **EXISTS** — File on disk, non-empty
2. **SUBSTANTIVE** — Real logic, not stub (`Placeholder`, `TODO`, `NotImplementedError`, `return null`)
3. **WIRED** — Imported/called by rest of system

If Level 2 = stub → "Existence Theater" (created but not implemented)
If Level 3 = unused → dead code

---

## Session Persistence

**In-Session** (session-bridge):
- `.rune/decisions.md` — approach + trade-offs
- `.rune/progress.md` — task completion
- `.rune/conventions.md` — patterns discovered
- `.rune/metrics/skills.json` — usage stats

**Cross-Session** (neural-memory):
- Recall (Phase 0): Get past decisions, patterns, solutions
- Capture (Phase 8): Store 2-5 memories with cognitive language
- Tags: `[project, tech, topic]` | Priority: 5-10

**Multi-Session Resume**:
- Phase 0 detects `.rune/plan-*.md` files
- Loads ONLY current phase (not all phases)
- Resumes from current phase instead of restarting

---

## Cost Optimization

| Model | Use When | Cost |
|-------|----------|------|
| **Haiku** | Scan, search, validate (L3) | ~$0.0002/1k |
| **Sonnet** | Write, edit, generate (default) | ~$0.003/1k |
| **Opus** | Architecture, security, orchestration | ~$0.015/1k |

**Typical feature**: $0.05-0.15 (vs $0.60 all-opus)

---

## Error Recovery Chain

```
DEBUG-FIX LOOP (max 3 attempts):
  Error → debug → fix → test → if still fail → repeat (max 3x)

RE-PLAN GATE (max 1 attempt):
  Still failing → re-invoke plan with delta → user approval → resume

BRAINSTORM RESCUE (max 1 attempt):
  Plan also fails → brainstorm(mode="rescue") → 3-5 alternatives → user picks → restart Phase 2

ESCALATE TO USER:
  All above exhausted → present full context + options
```

---

## Anti-Patterns (Never Do)

| Anti-Pattern | Why Bad |
|---|---|
| Skip quality gates | Gates are circuit breakers, not suggestions |
| "I'll apply patterns mentally" | Mental application misses constraints |
| Read 10+ files before writing | Analysis paralysis — write first, iterate |
| Merge without verification | Integration bugs hidden at merge time |
| Claim "done" without proof | Completion-gate will block |
| Nano mode for security files | .env, auth, crypto must use full pipeline |
| Bare prompts to agents | NEXUS Handoff required for team dispatch |
| Ignore sentinel CRITICAL | Security issues must be fixed before commit |
| Overlapping file ownership | Team will have merge conflicts |

---

## Routing Decision Flowchart

```
Does request modify code?
  → YES: Invoke cook (or team if 5+ files)
  → NO: Check routing table for domain skill

Is it clearly a specific task?
  → YES: Route to matching L2 hub (review, deploy, design, etc.)
  → NO: Route to cook (default)

Is it a domain-specific task?
  → YES: Load L4 pack (e.g., @rune/backend for API)
  → NO: Proceed with L1/L2 routing

Route via Skill tool, then follow skill's workflow exactly
```

---

## Checklist: Before You Start

- [ ] Is this a code change? → Route to cook
- [ ] Is it a multi-file task? → Consider team
- [ ] Do I have a plan? → cook Phase 2 produces one
- [ ] Are there tests? → cook Phase 3 writes them
- [ ] Did I check routing table? → skill-router enforces
- [ ] Do I have evidence for claims? → completion-gate requires it
- [ ] Are there scope boundaries? → Phase 2 defines them
- [ ] Is this a multi-session task? → Phase 8 saves context

---

## Your Stack Recommendations

### Next.js Frontend
- Use `@rune/ui` pack (design system patterns)
- Phase 2 always includes design phase for new UI
- Component tests required (jest/vitest)
- Storybook patterns for components

### Python/Flask Backend
- Phase 1 detects async → flags async-first Python
- @rune/backend pack for API patterns
- pytest-asyncio for async tests
- Verify parameterized queries (no SQL injection)

### PostgreSQL Database
- Phase 4 detects schema changes → invoke `db` skill
- Migration script + rollback script required
- Test in test DB first (verification Phase 6)
- Alembic for version control

### Socket.IO Integration
- Async Python + async TypeScript
- Phase 5 security: CSRF token validation
- hallucination-guard verifies event handlers exist
- Tests cover connection + authentication

---

## Quick Command Reference

```bash
# Start implementation (choose chain)
/rune cook                    # Full TDD (default)
/rune cook feature            # New feature
/rune cook bugfix             # Bug fix
/rune cook refactor           # Code refactor
/rune cook security           # Security-sensitive
/rune cook hotfix             # Urgent fix
/rune cook nano               # Trivial task

# Parallel work
/rune team "description"      # Multi-agent orchestration

# Specific tasks
/rune plan "description"      # Create plan only
/rune review                  # Code review
/rune debug "error message"   # Find root cause
/rune test                    # Write tests
/rune sentinel                # Security scan
/rune perf                    # Performance check
/rune launch                  # Deploy + market
/rune scaffold "project"      # New project

# Utility
/rune onboard                 # Initialize .rune/
/rune audit                   # Full health check
/rune docs init               # Generate docs
```

---

## When Stuck: Troubleshooting Flow

```
Cook blocked?
  → Is it a gate issue? (scout, plan approval, tests, verification)
    → YES: Address gate, resume
    → NO: Continue

Analysis paralysis (5+ reads, no writes)?
  → STOP: Either write code OR report BLOCKED with specific missing piece

Tests fail, max debug loops hit?
  → Invoke brainstorm(mode="rescue")
  → Get alternatives, user picks, restart Phase 2

Completion-gate blocks?
  → Read evidence table, provide missing output or fix issue

Team merge conflict?
  → File ownership overlap in Phase 1 (should not happen)
  → Resolve manually or re-decompose

Memory error in async Python?
  → Replace blocking calls: requests→httpx, time.sleep→asyncio.sleep

Sentinel CRITICAL?
  → STOP, fix immediately, re-run, only then proceed
```

---

**Version**: Rune 2.2.2
**Updated**: March 2026
**For**: Carabiner OS (Next.js + Python + PostgreSQL)
