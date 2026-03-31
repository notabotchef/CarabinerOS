# NotebookLM MCP Research - Document Index

Research completed: **2025-03-28** | Source repo: https://github.com/PleasePrompto/notebooklm-mcp

---

## Documents Created

### 1. **NOTEBOOKLM_CONNECTION_RESEARCH.md** (12 KB, 373 lines)
**Deep technical dive into how NotebookLM MCP works**

**Covers:**
- Complete connection mechanism (Patchright browser automation, no API)
- Authentication flow (Google OAuth → cookie persistence)
- Setup requirements (Node.js 18+, Chromium)
- Key technical details (stealth mode, session management, selectors)
- MCP tools provided (5 profiles)
- Example workflows
- Limitations & workarounds
- Security considerations

**Best for:** Understanding how the server works under the hood
**Read time:** 15-20 minutes
**Audience:** Developers, architects

---

### 2. **NOTEBOOKLM_INTEGRATION_CHECKLIST.md** (12 KB, 419 lines)
**Implementation roadmap specifically for Carabiner OS**

**Covers:**
- Why NotebookLM is perfect for restaurants (use cases: SOPs, supplier docs, cost analysis)
- Technical integration with Carabiner stack (Next.js frontend, Flask backend, PostgreSQL)
- 4-phase implementation plan (PoC → Library → Context → Automation)
- Migration path from manual lookups to autonomous research
- Blockers & mitigations (rate limits, auth expiry, browser detection)
- Docker deployment options
- Configuration for Carabiner settings.json
- Health checks & monitoring
- Testing strategy
- Cost analysis (free tier vs. Pro vs. Ultra)
- Quick start script

**Best for:** Planning integration into Carabiner OS
**Read time:** 20-25 minutes
**Audience:** Project managers, backend engineers

---

### 3. **NOTEBOOKLM_ARCHITECTURE_DIAGRAM.md** (33 KB, 700+ lines)
**Visual flowcharts and detailed architecture documentation**

**Covers:**
- High-level data flow diagram (end-to-end)
- Authentication state lifecycle (setup → queries → expiry)
- DOM interaction & response extraction (streaming detection)
- State file structure (cookies, localStorage, sessionStorage)
- Session management & pooling (memory efficiency)
- Error recovery & auto-healing scenarios
- Browser stealth measures & detection avoidance
- Carabiner OS integration points
- Cost flow & rate limiting
- Failure scenarios with recovery paths
- Summary architecture diagram

**Best for:** Visual learners, architecture review
**Read time:** 25-30 minutes (or skim diagrams only)
**Audience:** Architects, senior engineers, CTOs

---

### 4. **NOTEBOOKLM_QUICK_REFERENCE.txt** (11 KB, 350+ lines)
**Cheat sheet for quick lookup during development**

**Covers:**
- What it is (one-liner definitions)
- How it connects (quick summary)
- Key selectors (textarea.query-box-input, .to-user-container)
- Authentication summary (one-time setup, cookie persistence)
- Setup requirements (Node.js, packages, paths)
- Rate limits (50/250/500 per tier)
- Example question flow
- Security notes
- Carabiner integration points
- Best practices
- Troubleshooting quick fixes
- Resource links

**Best for:** Quick reference during implementation
**Read time:** 5-10 minutes per lookup
**Audience:** All developers

---

### 5. **NOTEBOOKLM_INDEX.md** (THIS FILE)
**Navigation guide for all research documents**

---

## Quick Navigation

### "I have 5 minutes..."
→ Read: **NOTEBOOKLM_QUICK_REFERENCE.txt** (Key Facts section)

### "I need to understand how it works..."
→ Read: **NOTEBOOKLM_CONNECTION_RESEARCH.md** (Sections 1-4)

### "I'm planning Carabiner integration..."
→ Read: **NOTEBOOKLM_INTEGRATION_CHECKLIST.md** (all sections)

### "Show me the architecture..."
→ Read: **NOTEBOOKLM_ARCHITECTURE_DIAGRAM.md** (data flow diagrams)

### "I'm stuck on a problem..."
→ Check: **NOTEBOOKLM_QUICK_REFERENCE.txt** (Troubleshooting section)

---

## Key Facts at a Glance

| Question | Answer | Source |
|----------|--------|--------|
| **How does it connect?** | Patchright (Chromium browser automation), NO API | Connection Research, §1 |
| **How does auth work?** | Google OAuth → browser login → cookies saved locally for 24h | Connection Research, §2 |
| **Setup time?** | ~5 minutes (one manual Google login) | Quick Reference |
| **Rate limits?** | 50/day free, 250/day Pro ($50/mo), 500/day Ultra | Integration Checklist |
| **Best use cases?** | SOPs, supplier docs, cost analysis, compliance references | Integration Checklist |
| **For Carabiner?** | Knowledge module + context piggybacking + action cards | Integration Checklist, §1 |
| **Implementation phases?** | PoC (3h) → Integration (2d) → Library (5d) → Ops (3d) | Integration Checklist, §2 |
| **Docker?** | Sidecar container with volume mounts for state persistence | Integration Checklist, §5 |
| **Cost/month?** | $0-500 depending on tier (recommend Pro: $50/mo) | Integration Checklist, §10 |

---

## Document Structure Summary

```
NOTEBOOKLM_INDEX.md (you are here)
├── Quick links by use case
├── Key facts table
└── Document relationships

NOTEBOOKLM_QUICK_REFERENCE.txt
├── What is it?
├── How it connects (quick summary)
├── How it authenticates (quick summary)
├── Setup checklist
├── Rate limits
├── MCP tools
├── Example flow
├── Security notes
├── Carabiner integration points
├── Best practices
└── Troubleshooting

NOTEBOOKLM_CONNECTION_RESEARCH.md
├── 1. Connection Mechanism (architecture, interaction flow)
├── 2. Authentication Method (OAuth, cookie persistence, auto-login)
├── 3. Setup Requirements (system, installation, configuration)
├── 4. Technical Details (library, timeouts, selectors)
├── 5. MCP Tools Provided (all profiles)
├── 6. Security Considerations (what's transmitted, risks)
├── 7. Comparison to Alternatives (vs web search, RAG, etc)
├── 8. Limitations & Workarounds (24h expiry, rate limits, detection)
├── 9. Example Flow (detailed walkthrough)
└── Summary (quick reference table)

NOTEBOOKLM_INTEGRATION_CHECKLIST.md
├── Quick Facts (tech stack, why it's good for restaurants)
├── Why NotebookLM for Carabiner OS (use cases)
├── Technical Integration Points (frontend, backend, database)
├── Implementation Phases (PoC → Library → Context → Ops)
├── Migration Path (from manual to autonomous)
├── Blockers & Mitigations (rate limits, auth, detection)
├── Docker Deployment (sidecar, subprocess options)
├── Configuration for Carabiner (settings.json, env vars)
├── Health Checks & Monitoring (daily tasks, endpoints)
├── Testing Strategy (unit tests, integration tests)
├── Cost Analysis (free vs Pro vs Ultra)
├── Success Metrics (adoption, queries, quality, latency)
└── Next Steps (immediate through polish phases)

NOTEBOOKLM_ARCHITECTURE_DIAGRAM.md
├── High-Level Data Flow
├── Authentication State Lifecycle
├── DOM Interaction & Response Extraction
├── State File Structure
├── Session Management & Pooling
├── Error Recovery & Auto-Healing
├── Browser Stealth & Detection Avoidance
├── Integration with Carabiner OS
├── Cost Flow & Rate Limiting
├── Failure Scenarios & Recovery
└── Summary Architecture
```

---

## Research Methodology

**Source Repository:** https://github.com/PleasePrompto/notebooklm-mcp

**Files Analyzed:**
- `src/index.ts` - MCP server initialization & request handlers
- `src/auth/auth-manager.ts` - Authentication & state persistence (1,107 lines)
- `src/session/browser-session.ts` - Browser automation & question submission (703 lines)
- `src/tools/handlers.ts` - MCP tool implementations (892 lines)
- `src/session/shared-context-manager.ts` - Browser context pooling (472 lines)
- `src/utils/page-utils.ts` - DOM response extraction (476 lines)
- `src/utils/stealth-utils.ts` - Human-like behavior simulation (499 lines)
- `src/config.ts` - Configuration management (306 lines)
- `package.json` - Dependencies (Patchright, MCP SDK, etc.)
- `README.md` - Official documentation (14 KB)
- `/docs/*` - Usage guides, configuration, troubleshooting

**Total Code Analyzed:** ~7,971 lines of TypeScript

---

## Key Discoveries

### ✅ What Makes NotebookLM Unique
1. **Zero Hallucinations:** Refuses to answer if info not in documents
2. **Semantic Understanding:** Gemini pre-indexes docs (not keyword search)
3. **Multi-Source Correlation:** Connects information across 50+ documents
4. **Citation-Backed:** Every answer includes source references
5. **No Infrastructure:** No vector DB, embeddings, or chunking needed
6. **One-Time Setup:** Upload docs once, query forever (until 24h auth expiry)

### ✅ For Carabiner OS Integration
1. **Perfect Use Cases:** SOPs, supplier docs, cost analysis, compliance
2. **Low Cost:** $0-50/month depending on usage tier
3. **Realistic ROI:** One good decision from NotebookLM answers > $50/month
4. **Context Piggybacking:** Can prepend current inventory/invoice state
5. **Action Cards Integration:** Answers can trigger action cards automatically
6. **Phased Implementation:** Can roll out gradually (PoC → full integration)

### ⚠️ Important Limitations
1. **Rate Limit:** 50 queries/day free (can switch Google accounts)
2. **Auth Expiry:** 24-hour cookie timeout (can automate refresh)
3. **Browser Detection:** Google may flag bot traffic (use dedicated account)
4. **Manual Login:** Initial setup requires user interaction
5. **Single Notebook:** Can only query one at a time (but can switch)

### 🔧 Technical Details
1. **No API:** Uses Patchright (Chromium) browser automation + DOM scraping
2. **DOM Selectors:** Primary = `textarea.query-box-input`, `.to-user-container .message-text-content`
3. **Streaming Detection:** Hash-based text comparison (detects while Gemini is typing)
4. **Session Pooling:** Shared Chromium context (memory efficient)
5. **Auto-Recovery:** Automatically recreates browser if it crashes

---

## Implementation Roadmap (Recommended)

```
Week 1: Proof of Concept
├─ Install locally: claude mcp add notebooklm...
├─ Create test NotebookLM notebook
├─ Ask 5+ test questions
└─ Document setup process

Week 2: Design & Planning
├─ Design Knowledge module UI (frontend)
├─ Plan backend integration (Flask route)
├─ Choose deployment strategy (Docker sidecar)
└─ Draft settings.json config

Week 3: Backend Integration
├─ Create Flask /api/knowledge/ask route
├─ Spawn NotebookLM MCP as subprocess
├─ Handle auth & rate limit errors
├─ Add Socket.IO streaming

Week 4: Frontend Implementation
├─ Build Knowledge module page
├─ Chat interface for queries
├─ Results display (cards/panels)
├─ Notebook selector

Week 5: Context & Automation
├─ Add context piggybacking (inventory/invoices)
├─ Auto-select notebooks (by tag)
├─ Cache answers (1h TTL)
├─ Health checks

Week 6: Monitoring & Launch
├─ Add daily monitoring tasks
├─ Track metrics (adoption, cost, quality)
├─ Documentation for users
└─ Gradual rollout to restaurants
```

---

## Next Steps

1. **Read the full research:**
   - Start with **NOTEBOOKLM_CONNECTION_RESEARCH.md**
   - Then **NOTEBOOKLM_INTEGRATION_CHECKLIST.md**
   - Reference **NOTEBOOKLM_ARCHITECTURE_DIAGRAM.md** as needed

2. **Run a PoC:**
   - Install: `claude mcp add notebooklm npx notebooklm-mcp@latest`
   - Create test notebook at notebooklm.google.com
   - Ask test questions via Claude Code
   - Document blockers/learnings

3. **Plan integration:**
   - Review **NOTEBOOKLM_INTEGRATION_CHECKLIST.md** phases
   - Design Knowledge module UI
   - Estimate effort vs. ROI
   - Allocate resources

4. **Design architecture:**
   - Decide on sidecar (Docker) vs. subprocess
   - Plan state persistence (volume mounts)
   - Design Flask integration
   - Plan Socket.IO streaming

5. **Reference during implementation:**
   - Use **NOTEBOOKLM_QUICK_REFERENCE.txt** for quick lookups
   - Check **NOTEBOOKLM_ARCHITECTURE_DIAGRAM.md** for error scenarios
   - Refer to configuration sections in **NOTEBOOKLM_INTEGRATION_CHECKLIST.md**

---

## Questions Answered by Each Document

### NOTEBOOKLM_CONNECTION_RESEARCH.md
- What is NotebookLM MCP?
- How does it connect to NotebookLM? (no API?)
- How does authentication work?
- What are setup requirements?
- How are responses extracted from the web UI?
- What are the MCP tools?
- How secure is it?
- What are the limitations?

### NOTEBOOKLM_INTEGRATION_CHECKLIST.md
- Why is NotebookLM good for Carabiner OS?
- What are the implementation phases?
- What are the blockers?
- How do I deploy it with Docker?
- What should I monitor?
- How much will it cost?
- How do I test it?
- What's the success metrics?

### NOTEBOOKLM_ARCHITECTURE_DIAGRAM.md
- Show me the data flow (visual)
- How does auth state work (lifecycle)?
- How does it extract responses from DOM?
- How does session pooling work?
- What happens if the browser crashes?
- How does stealth mode work?
- Where are my cookies stored?
- What are failure scenarios?

### NOTEBOOKLM_QUICK_REFERENCE.txt
- What's the key facts? (quick summary)
- What are the selectors I need to know?
- What timeouts matter?
- How do I troubleshoot X?
- What are the best practices?
- What's the cost?
- What are the rate limits?

---

## File Locations

All documents are in your Carabiner OS project directory:

```
/Users/estebannunez/Projects/carabiner-os/
├── NOTEBOOKLM_INDEX.md (this file)
├── NOTEBOOKLM_CONNECTION_RESEARCH.md (12 KB)
├── NOTEBOOKLM_INTEGRATION_CHECKLIST.md (12 KB)
├── NOTEBOOKLM_ARCHITECTURE_DIAGRAM.md (33 KB)
└── NOTEBOOKLM_QUICK_REFERENCE.txt (11 KB)
```

---

## Document Quality Metrics

| Metric | Value |
|--------|-------|
| **Total lines** | 1,853 |
| **Total size** | ~78 KB |
| **Code analyzed** | 7,971 lines (TypeScript) |
| **Source repo files** | 20+ |
| **Diagrams** | 10+ (ASCII + descriptions) |
| **Code examples** | 15+ |
| **Use cases documented** | 6+ |
| **Failure scenarios covered** | 5+ |
| **Integration phases** | 4 |
| **Cost scenarios** | 3 |

---

## Version History

| Date | Research | Status |
|------|----------|--------|
| 2025-03-28 | Initial research (v1) | ✅ Complete |
| — | PoC validation | 🔄 Pending |
| — | Implementation review | 🔄 Pending |

---

## Contact & Further Research

**GitHub Repo:** https://github.com/PleasePrompto/notebooklm-mcp
**NotebookLM:** https://notebooklm.google.com
**MCP Spec:** https://modelcontextprotocol.io
**Issues/Support:** https://github.com/PleasePrompto/notebooklm-mcp/issues

**For Carabiner OS Integration Questions:**
- Refer to **NOTEBOOKLM_INTEGRATION_CHECKLIST.md** implementation phases
- Check **NOTEBOOKLM_QUICK_REFERENCE.txt** troubleshooting section
- Review **NOTEBOOKLM_ARCHITECTURE_DIAGRAM.md** for technical details

---

**Research completed by:** Claude Code Research Agent
**Date:** 2025-03-28
**Confidence Level:** High (analyzed production code + documentation)
