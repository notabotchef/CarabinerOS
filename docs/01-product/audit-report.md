# Audit Report: Carabiner OS

**Date:** 2026-03-20
**Branch:** feature/action-cards
**Stack:** Python 3.10+ / Flask 3.0 / Next.js 16.2 / React 19 / PostgreSQL 16
**Framework Checks Applied:** React/Next.js, Python/Flask

---

- **Verdict**: WARNING
- **Overall Health**: 5.5/10
- **Total Findings**: 42 (CRITICAL: 0, HIGH: 8, MEDIUM: 19, LOW: 10, INFO: 5)

---

## Health Score

| Dimension      | Score    | Notes                                                    |
|----------------|:--------:|----------------------------------------------------------|
| Security       |  4/10    | 15 warnings — unauthenticated APIs, path traversal, no HTTP headers |
| Code Quality   |  6/10    | Strong frontend types; 54 silent except blocks in Python |
| Architecture   |  7.5/10  | Clean separation, no circular deps; missing pagination   |
| Performance    |  8/10    | Async throughout, good pooling; minor sequential I/O     |
| Dependencies   |  5.5/10  | 35 Python CVEs, 9 major-lagged packages; frontend clean  |
| Infrastructure |  3.5/10  | No CI/CD, no error tracking, no structured logging       |
| Documentation  |  4.5/10  | No API docs, no CHANGELOG, no ADRs, incomplete README    |
| Mesh Analytics |  N/A     | Rune just initialized — no skill invocation data yet     |
| **Overall**    | **5.5/10** | **WARNING — production-naive in ops & security**       |

---

## Phase Breakdown

| Phase          | Issues |
|----------------|--------|
| Dependencies   | 6      |
| Security       | 15     |
| Code Quality   | 8      |
| Architecture   | 5      |
| Performance    | 3      |
| Infrastructure | 7      |
| Documentation  | 5      |
| Mesh Analytics | 0      |

---

## Top Priority Actions

### CRITICAL PATH (fix before any production deployment)

1. **[SEC] Add authentication to Carabiner workspace APIs** — `python/api/carabiner_workspace.py:30-35` — `requires_auth` and `requires_csrf` both return `False`. All 9 restaurant data endpoints (`/api/orders`, `/api/invoices`, `/api/daily_pl`, etc.) are completely unauthenticated. Any caller can read all business data.

2. **[SEC] Patch 35 Python CVEs** — `pypdf` (15 CVEs, upgrade `6.0.0` → `6.9.1`), `flask` (CVE-2026-27205, `3.0.3` → `3.1.3`), `simpleeval` (sandbox escape, `1.0.3` → `1.0.5`), `langchain-core` (3 CVEs), `mcp` (1 CVE). All fixable with minor/patch bumps.

3. **[SEC] Fix path traversal in file API** — `python/api/api_files_get.py:55-63` — paths starting with `/a0/` are not canonicalized. A crafted path like `/a0/../../../etc/passwd` could escape the directory boundary.

4. **[INFRA] Add CI/CD pipeline** — No `.github/workflows/`, no automated tests on PR, no build validation. One `test.yml` running `pytest tests/` on push would catch regressions.

5. **[INFRA] Add error tracking** — No Sentry, Datadog, or any exception aggregation. Errors are silently swallowed or lost on container restart. `flask_blueprint.py:142-143` catches all exceptions and returns empty responses.

### HIGH PRIORITY (plan for next sprint)

6. **[QUALITY] Fix 54 silent `except: pass` blocks** — Concentrated in `task_scheduler.py` (5), `chats.py` (4), `files.py` (3). At minimum add `logger.exception()`. The scheduler blocks are especially dangerous — they mask cron/task failures silently.

7. **[ARCH] Add pagination to list endpoints** — `flask_blueprint.py:136-200` — all GET endpoints fetch every record. At scale (1000s of orders/invoices), responses will be massive and slow.

8. **[SEC] Move credentials out of docker-compose.dev.yml** — Hardcoded `POSTGRES_PASSWORD: carabiner` and `FLASK_SECRET_KEY=carabiner-dev-secret-key-2026` are committed to git. Move to `.env.local` (gitignored).

9. **[SEC] Add HTTP security headers** — No `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, or `Strict-Transport-Security` on any response. Add via Flask middleware or nginx config.

10. **[QUALITY] Extract shared restaurant page pattern** — 9 module pages (327–498 lines each) duplicate the same fetch/filter/table structure. Create a `<DataModulePage>` component.

### MEDIUM PRIORITY (tech debt reduction)

11. **[PERF] Use `asyncio.gather()` for parallel queries** — `carabiner/api/hq.py:51-54` fetches org, locations, inbox sequentially. `reporting.py:255-280` fetches P&L and budgets separately. Both can be parallelized.

12. **[QUALITY] Split `route_event` in websocket_manager.py** — CC=49 (recommended max: 10). Decompose into handler resolution, payload normalization, and dispatch.

13. **[QUALITY] Break up `use-chat.ts`** — 361 lines, 16 git changes. Extract message parsing, subscription management, and API calls into separate modules.

14. **[DB] Add missing indexes** — `Item.category` (used in GROUP BY), `Invoice.invoice_number` (search key). Run Alembic migration.

15. **[DEPS] Remove unused packages** — `flask-basicauth` (commented out in `run_ui.py`), `newspaper3k` (zero imports). Deduplicate `crontab` (listed twice in `requirements.txt`).

16. **[INFRA] Add `.env.example`** — No template for required environment variables. New developers have to guess what's needed.

17. **[INFRA] Add structured logging** — No JSON logging, no log levels configured. Adopt `structlog` or `python-json-logger`.

18. **[DOCS] Generate API documentation** — No OpenAPI/Swagger spec. Add auto-generated docs at `/api/docs`.

19. **[A11Y] Add `prefers-reduced-motion` support** — Framer Motion animations have no reduced-motion checks despite multiple animation effects.

---

## Detailed Phase Reports

### Phase 1: Dependencies

**Score: 5.5/10**

#### Python — 35 CVEs across 14 packages

| Priority | Package | Pinned | Fix Version | CVEs |
|----------|---------|--------|-------------|------|
| Immediate | `pypdf` | 6.0.0 | 6.9.1 | 15 CVEs |
| Immediate | `flask` | 3.0.3 | 3.1.3 | CVE-2026-27205 |
| Immediate | `simpleeval` | 1.0.3 | 1.0.5 | CVE-2026-32640 (sandbox escape) |
| Immediate | `mcp` | 1.22.0 | 1.26.0 | CVE-2025-66416 |
| Immediate | `lxml_html_clean` | 0.3.1 | 0.4.4 | 3 CVEs |
| Short-term | `langchain-core` | 0.3.49 | 1.2.11+ | 3 CVEs (co-upgrade with community/splitters) |
| Short-term | `fastmcp` | 2.13.1 | 3.1.1 | 2 CVEs |
| No fix | `diskcache`, `nltk`, `onnx` | — | — | 4 CVEs total |

**Major-lagged packages:** `openai` (v1 → v2), `litellm` (v1 → v2), `langchain-core` (0.3 → 1.2), `sentence-transformers` (3.0 → 5.3)

**Unused:** `flask-basicauth`, `newspaper3k`. **Duplicate:** `crontab` listed twice.

**Frontend:** 0 vulnerabilities. 5 packages outdated (all minor/patch). Clean.

---

### Phase 2: Security

**Score: 4/10** — 0 BLOCK, 15 WARN, 5 INFO

| ID | Finding | File | Severity |
|----|---------|------|----------|
| W-06 | Carabiner APIs have zero authentication | `carabiner_workspace.py:30-35` | HIGH |
| W-07 | Path traversal in file API (no canonicalization) | `api_files_get.py:55-63` | HIGH |
| W-08 | 35 Python CVEs in dependencies | `requirements.txt` | HIGH |
| W-01 | Hardcoded DB credentials in docker-compose | `docker-compose.dev.yml:7-9` | MEDIUM |
| W-02 | Hardcoded Flask secret key | `docker-compose.dev.yml:26` | MEDIUM |
| W-04 | Session cookie missing `Secure`/`HttpOnly` | `run_ui.py:57-65` | MEDIUM |
| W-05 | CSRF cookie missing `Secure` flag | `csrf.ts:18` | MEDIUM |
| W-09 | Backend binds 0.0.0.0 in Docker (bypasses nginx) | `docker-compose.dev.yml:24` | MEDIUM |
| W-10 | No HTTP security headers | `run_ui.py` | MEDIUM |
| W-11 | `render_template_string` risk (SSTI) | `run_ui.py:207` | MEDIUM |
| W-12 | Empty MCP server token could bypass API key auth | `settings.json:83` | MEDIUM |
| W-13 | PostgreSQL port exposed on host | `docker-compose.dev.yml:5` | LOW |
| W-14 | Auth disabled when unconfigured (no warning) | `run_ui.py:167-168` | LOW |
| W-03 | `usr/.env` and `settings.json` git-tracked | `.gitignore:35,76` | LOW |
| W-15 | Docker override not guarded (composite W-09+W-14) | `run_ui.py:433` | LOW |

---

### Phase 3: Code Quality

**Score: 6/10**

#### Complexity Hotspots (CC ≥ 25)

| CC | File | Function |
|----|------|----------|
| 49 | `websocket_manager.py:470` | `route_event` |
| 45 | `file_tree.py:25` | `file_tree` |
| 34 | `memory_consolidation.py:112` | `_process_memory_with_consolidation` |
| 34 | `knowledge_import.py:33` | `load_knowledge` |
| 28 | `run_ui.py:259` | `configure_websocket_namespaces` |
| 27 | `api_message.py:31` | `process` |

#### Module Health

| Module | Grade | Key Issue |
|--------|-------|-----------|
| `frontend/src/lib/` | **A** | Clean types, 4 unused exports |
| `frontend/src/components/` | **B** | 1 `any` type (acceptable) |
| `frontend/src/hooks/` | **B-** | `use-chat.ts` too large (361 lines) |
| `frontend/src/app/` (pages) | **C** | 9 pages duplicate fetch/filter/table pattern |
| `carabiner/` | **B** | Good separation, some error swallowing |
| `python/helpers/` | **C-** | 5 files >700 lines, 54 silent except blocks |
| `agent.py` | **C** | 1011 lines, 74 dependents |

#### TypeScript Discipline
Only **1 `any`** in entire frontend (`workspace-table.tsx:22`). Excellent type hygiene.

#### Silent Error Swallowing
**54 `except: pass` blocks** across Python backend. Worst: `task_scheduler.py` (5), `chats.py` (4), `files.py` (3).

---

### Phase 4: Architecture

**Score: 7.5/10**

- **Folder structure**: Clean two-layer separation (Agent Zero core + Carabiner domain). No circular dependencies.
- **API consistency**: All GET-only, consistent JSON format, `?location_id` filtering. But bare `except Exception` swallows errors and no pagination on list endpoints.
- **Database**: 39 foreign keys properly defined, composite indexes on high-traffic columns. Missing indexes on `Item.category` and `Invoice.invoice_number`.
- **Frontend state**: Hooks pattern works well, no prop drilling. Minor concern: Socket.IO listener deduplication via `useRef` is fragile.

---

### Phase 5: Performance

**Score: 8/10**

- **Async I/O**: All handlers properly async with `asyncpg`. No blocking operations detected.
- **Connection pooling**: Well-configured (`pool_size=10`, `max_overflow=20`, `pool_pre_ping=True`).
- **Bundle**: Clean dependencies, no large utility imports. Framer Motion (200KB) is the biggest dep.
- **Sequential I/O**: `hq.py:51-54` fetches 3 independent things sequentially. `reporting.py:255-280` fetches P&L and budgets separately. Both should use `asyncio.gather()`.
- **Code splitting**: No explicit `dynamic()` or `<Suspense>` boundaries. Next.js handles route-level splitting automatically, but component-level lazy loading is missing.

---

### Phase 6: Infrastructure

**Score: 3.5/10**

| Check | Status | Notes |
|-------|--------|-------|
| CI/CD | **Missing** | No GitHub Actions, GitLab CI, or any pipeline |
| Docker | Functional | Health checks present, but no `.dockerignore`, runs as root |
| Env config | Weak | No `.env.example`, no startup validation |
| Logging | Minimal | No structured logging, no JSON format |
| Health checks | Basic | `/api/health` exists but doesn't verify DB connectivity |
| Error tracking | **Missing** | No Sentry, Datadog, or exception aggregation |

---

### Phase 7: Documentation

**Score: 4.5/10**

| Check | Status |
|-------|--------|
| README | Present but Agent Zero-focused, not Carabiner-specific |
| API docs | **Missing** — no OpenAPI/Swagger |
| CHANGELOG | **Missing** |
| LICENSE | Present |
| CONTRIBUTING | **Missing** |
| ADRs | Empty template in `.rune/decisions.md` |
| New developer onboarding | Gaps in DB setup, env config, API usage |

---

### Phase 8: Mesh Analytics

**Status:** Rune just initialized. 11 sessions tracked, 0 skill invocations recorded. No chains data. Insufficient data for mesh health scoring.

Re-run `/rune metrics` after 10+ skill-driven sessions for meaningful analytics.

---

## Positive Findings

1. **Excellent TypeScript discipline** — only 1 `any` in the entire frontend. Strong type safety culture.
2. **Clean async architecture** — all DB operations use `asyncpg` with proper pooling. No blocking I/O in request handlers.
3. **No circular dependencies** — clean unidirectional imports across all layers (API → DB → Domain).
4. **Well-structured domain separation** — Carabiner extends Agent Zero without modifying core files.
5. **OKLCH color system** — perceptually uniform color space with proper dark/light mode tokens.
6. **Frontend dependency hygiene** — 0 vulnerabilities, lean dependency list, no dead-weight libraries.
7. **Docker health checks** — proper `healthcheck` with `start_period`, `depends_on` with `service_healthy` conditions.

---

## Follow-up Timeline

- **WARNING verdict** → re-audit in 1 month after addressing HIGH findings
- Priority: Security (W-06, W-07) → Dependencies (CVE patches) → CI/CD → Error tracking
- Next audit should include Lighthouse accessibility scan and load testing

---

Report generated: 2026-03-20
