# Tiny-Router Plugin: Complete Documentation Index

## 📋 Document Overview

This design delivers **5 comprehensive documents** for implementing a message classifier plugin that reduces API costs by 30-40%.

### Quick Navigation

| Document | Size | Purpose | Audience | Read Time |
|----------|------|---------|----------|-----------|
| **`PLUGIN_TINY_ROUTER_QUICK_REFERENCE.txt`** | 10 KB | One-page cheat sheet | Everyone | 5 min |
| **`PLUGIN_TINY_ROUTER_SUMMARY.md`** | 15 KB | Executive summary | Decision makers | 10 min |
| **`PLUGIN_TINY_ROUTER_QUICK_START.md`** | 40 KB | Step-by-step implementation | Engineers | 45 min |
| **`PLUGIN_TINY_ROUTER_DESIGN.md`** | 120 KB | Complete architecture & specs | Architects | 60 min |
| **`PLUGIN_TINY_ROUTER_REFERENCE.md`** | 30 KB | Diagrams, commands, debugging | Engineers (during dev) | 30 min |

---

## 🚀 Getting Started (Choose Your Path)

### Path A: Executive Overview (15 minutes)
1. **Start:** `PLUGIN_TINY_ROUTER_QUICK_REFERENCE.txt` — Get the gist
2. **Then:** `PLUGIN_TINY_ROUTER_SUMMARY.md` — Understand the opportunity
3. **Next:** Decide: implement yourself or delegate?

### Path B: Technical Deep Dive (2-3 hours)
1. **Start:** `PLUGIN_TINY_ROUTER_SUMMARY.md` — Context and motivation
2. **Read:** `PLUGIN_TINY_ROUTER_DESIGN.md` — Full architecture, cost analysis, phases
3. **Reference:** `PLUGIN_TINY_ROUTER_REFERENCE.md` — Specs and diagrams
4. **Plan:** Phase 1 MVP, Phase 2 fine-tuning

### Path C: Build It Now (4-6 hours)
1. **Follow:** `PLUGIN_TINY_ROUTER_QUICK_START.md` — Step-by-step implementation
2. **Copy:** Code templates provided for all files
3. **Test:** Run manual tests, verify metrics
4. **Deploy:** Merge to feature branch, then main
5. **Reference:** `PLUGIN_TINY_ROUTER_REFERENCE.md` for commands during dev

### Path D: Delegate to Agent (30 minutes + agent time)
1. **Share all 5 documents** with the agent
2. **Request:** "Implement Phase 1 MVP on feature branch"
3. **Review:** Agent's work (diffs, tests, metrics)
4. **Merge:** Feature branch to main
5. **Plan:** Phase 2 based on collected metrics

---

## 📚 Document Details

### 1. PLUGIN_TINY_ROUTER_QUICK_REFERENCE.txt
**Best for:** Quick lookups during development

**Contains:**
- One-page project overview
- Routing decision tree
- File checklist
- Command reference
- Troubleshooting quick fixes
- Key thresholds and configs

**When to use:**
- Before starting implementation
- During debugging
- For code review
- As a team reference card

---

### 2. PLUGIN_TINY_ROUTER_SUMMARY.md
**Best for:** Deciding whether to implement, understanding the opportunity

**Contains:**
- 30-second overview
- What tiny-router does
- Architecture diagram (one extension, four decisions)
- Cost analysis and ROI
- Phase 1-3 roadmap
- Safety guarantees
- Common questions answered

**When to read:**
- First thing when exploring the plugin
- To pitch to stakeholders
- To understand phases before starting
- To answer "why should we do this?"

---

### 3. PLUGIN_TINY_ROUTER_QUICK_START.md
**Best for:** Actually implementing Phase 1

**Contains:**
- 9-step MVP implementation
- Copy-paste code for all files
- Directory structure to create
- How to download model
- Manual testing procedures
- Metrics to collect
- Troubleshooting guide

**When to follow:**
- Ready to code
- Want step-by-step guidance
- Need copy-paste templates
- Testing Phase 1

---

### 4. PLUGIN_TINY_ROUTER_DESIGN.md
**Best for:** Understanding full architecture, planning phases, cost analysis

**Contains:**
- Complete architecture (A0 message flow)
- Plugin structure and placement
- Detailed routing logic (decision tree with restaurant examples)
- Code sketches for all components
- Restaurant-specific training data strategy
- Detailed cost savings analysis
- 3-phase implementation plan (MVP → fine-tuning → full routing)
- Docker integration
- Monitoring, safety, and testing strategy
- Configuration and rollout
- Future enhancements

**When to read:**
- Want to understand "why" for each decision
- Planning multi-phase implementation
- Need to convince team of ROI
- Scaling to multiple restaurants
- Phase 2+ planning

---

### 5. PLUGIN_TINY_ROUTER_REFERENCE.md
**Best for:** Reference during development

**Contains:**
- Architecture diagram (message flow)
- Sequence diagrams (user → API → Agent → classifier → response)
- File structure (exact paths)
- Classification output schema (with examples)
- Routing decision tree (flow chart)
- Configuration reference (settings.json)
- Command reference (setup, testing, production, debugging)
- Dependencies & requirements
- Inference specifications (performance, tokenization)
- Integration checklist
- Cost comparison table
- FAQ

**When to use:**
- Need to find a specific command
- Want to understand inference specs
- Looking for configuration options
- Debugging issues
- Setting up Docker

---

## 🎯 Key Takeaways

### What Tiny-Router Does
- Classifies messages into 4 heads (actionability, urgency, relation, retention) in <10ms
- Outputs confidence scores per head + overall confidence
- Enables intelligent routing based on message type

### How It Works
1. Message arrives
2. Tiny-router classifies in <10ms
3. Route based on classification + confidence:
   - High confidence + low action → Canned response (instant, $0)
   - Correction → Special clarification prompt
   - High urgency → Priority queue
   - Otherwise → Full LLM processing (fallback)

### Cost Savings
- Phase 1 (MVP): $150-200/month
- Phase 2 (fine-tuning): Additional $50-100/month
- Phase 3 (full routing): Additional $100-200/month
- Total: 40-50% cost reduction possible

### Timeline
- Phase 1: 1-2 weeks (MVP, test)
- Phase 2: 3-4 weeks (collect data, fine-tune)
- Phase 3: 5-6 weeks (model swapping, feedback)

### Safety
- Fallback to full LLM on any doubt
- 0.90 confidence threshold for canned responses
- <2% false positive rate expected
- No quality regression

---

## 📖 Reading Guide by Role

### Product Manager / Decision Maker
1. **Start:** `PLUGIN_TINY_ROUTER_QUICK_REFERENCE.txt` (5 min)
2. **Then:** `PLUGIN_TINY_ROUTER_SUMMARY.md` (10 min)
3. **Skip:** Technical docs unless needed for planning

**Questions answered:** What does it do? How much will it save? What's the timeline?

### Engineering Lead / Architect
1. **Start:** `PLUGIN_TINY_ROUTER_SUMMARY.md` (10 min)
2. **Deep dive:** `PLUGIN_TINY_ROUTER_DESIGN.md` (60 min)
3. **Reference:** `PLUGIN_TINY_ROUTER_REFERENCE.md` as needed
4. **Plan:** Phases and resource allocation

**Questions answered:** Why these design decisions? How phases interconnect? Scalability?

### Developer / Implementer
1. **Start:** `PLUGIN_TINY_ROUTER_QUICK_START.md` (follow steps 1-9)
2. **Reference:** `PLUGIN_TINY_ROUTER_REFERENCE.md` (during development)
3. **Deep dive:** `PLUGIN_TINY_ROUTER_DESIGN.md` (for context on decisions)
4. **Cheat sheet:** `PLUGIN_TINY_ROUTER_QUICK_REFERENCE.txt` (troubleshooting)

**Questions answered:** How do I implement this? What code do I write? How do I test?

### Data Scientist / ML Engineer
1. **Start:** `PLUGIN_TINY_ROUTER_DESIGN.md` section on training data
2. **Then:** Phase 2 fine-tuning strategy
3. **Reference:** Classification output schema in `PLUGIN_TINY_ROUTER_REFERENCE.md`

**Questions answered:** How is the model trained? How do I fine-tune? What training data?

### DevOps / Infrastructure
1. **Start:** `PLUGIN_TINY_ROUTER_REFERENCE.md` Docker section
2. **Then:** `PLUGIN_TINY_ROUTER_DESIGN.md` Docker integration
3. **Reference:** Command reference for deployment

**Questions answered:** How do I deploy? What are system requirements? How do I monitor?

---

## 🔗 Cross-References

### Concepts Explained Across Documents

| Concept | Summary | Quick Start | Design | Reference |
|---------|---------|-------------|--------|-----------|
| Architecture | ✓ | Mentioned | Full | Diagram |
| Routing Logic | Brief | Mentioned | Deep | Tree chart |
| Cost Analysis | ✓ | Brief | Full | Table |
| Implementation | Steps | Full | Code sketches | Commands |
| Testing | Checklist | Manual tests | Strategy | Commands |
| Docker | Brief | Brief | Full section | Commands |
| Monitoring | List | Brief | Full | Metrics |
| Phases | Overview | Phase 1 focus | All 3 phases | - |
| Fine-tuning | Mentioned | Brief | Full strategy | - |

---

## 🛠️ Practical Workflows

### Workflow 1: Quick Decision (30 min)
→ Decide if we should implement tiny-router

1. Read: `PLUGIN_TINY_ROUTER_QUICK_REFERENCE.txt` (5 min)
2. Read: `PLUGIN_TINY_ROUTER_SUMMARY.md` (10 min)
3. Skim: Cost analysis in `PLUGIN_TINY_ROUTER_DESIGN.md` (10 min)
4. Decision: Yes/No/Maybe

### Workflow 2: Plan Implementation (1 hour)
→ Figure out phases, resource allocation, timeline

1. Read: `PLUGIN_TINY_ROUTER_SUMMARY.md` (10 min)
2. Read: Phase sections in `PLUGIN_TINY_ROUTER_DESIGN.md` (40 min)
3. Check: Implementation steps in `PLUGIN_TINY_ROUTER_QUICK_START.md` (10 min)
4. Plan: Resource allocation and timeline

### Workflow 3: Implement Phase 1 (4-6 hours)
→ Get MVP working

1. Follow: Steps 1-9 in `PLUGIN_TINY_ROUTER_QUICK_START.md` (4-6 hours)
2. Reference: `PLUGIN_TINY_ROUTER_REFERENCE.md` for commands (as needed)
3. Consult: `PLUGIN_TINY_ROUTER_DESIGN.md` code sections (as needed)
4. Check: `PLUGIN_TINY_ROUTER_QUICK_REFERENCE.txt` troubleshooting (if stuck)

### Workflow 4: Debug & Optimize (1-2 hours)
→ Fix issues, improve performance

1. Start: `PLUGIN_TINY_ROUTER_QUICK_REFERENCE.txt` troubleshooting
2. Reference: Commands in `PLUGIN_TINY_ROUTER_REFERENCE.md`
3. Check: Configuration in `PLUGIN_TINY_ROUTER_DESIGN.md`
4. Deep dive: Relevant section of `PLUGIN_TINY_ROUTER_DESIGN.md`

### Workflow 5: Plan Phase 2 (1 hour)
→ Fine-tuning strategy and data collection

1. Read: Phase 2 section in `PLUGIN_TINY_ROUTER_DESIGN.md` (30 min)
2. Read: Training data section in `PLUGIN_TINY_ROUTER_DESIGN.md` (20 min)
3. Plan: Data collection and labeling (10 min)

---

## 📊 Metrics & Monitoring

### Phase 1 Success Metrics
From `PLUGIN_TINY_ROUTER_QUICK_REFERENCE.txt`:
- Model loads without errors ✓
- <20ms average inference time ✓
- 20-25% of messages routed ✓
- <2% false positive rate ✓
- 0 production crashes ✓

### Phase 2 Targets
From `PLUGIN_TINY_ROUTER_DESIGN.md`:
- Canned response accuracy: 96%+
- Overall F1 score: 85%+
- 30-40% messages routable
- $150-250/month savings

### Phase 3 Goals
From `PLUGIN_TINY_ROUTER_DESIGN.md`:
- 35-40% messages routable
- 40-50% cost reduction
- Self-improving (feedback loop)

---

## ❓ FAQ

**Q: Which document should I read first?**
A: Start with `PLUGIN_TINY_ROUTER_QUICK_REFERENCE.txt` (5 min), then `PLUGIN_TINY_ROUTER_SUMMARY.md` (10 min).

**Q: Can I skip the design doc?**
A: If implementing Phase 1 only, yes. If planning phases or fine-tuning, read Phase sections.

**Q: Where's the code?**
A: `PLUGIN_TINY_ROUTER_QUICK_START.md` has copy-paste templates. `PLUGIN_TINY_ROUTER_DESIGN.md` has detailed code sketches.

**Q: What if I'm new to Agent Zero?**
A: Read the architecture section in `PLUGIN_TINY_ROUTER_DESIGN.md` first, then the A0 docs (agent.py, helpers/extension.py).

**Q: How do I monitor in production?**
A: See monitoring section in `PLUGIN_TINY_ROUTER_DESIGN.md` and commands in `PLUGIN_TINY_ROUTER_REFERENCE.md`.

**Q: Can I implement Phase 2 without Phase 1?**
A: No. Phase 1 is the MVP foundation. Phase 2 requires Phase 1 metrics to guide fine-tuning.

---

## 📝 Document Status

| Document | Status | Last Updated | Version |
|----------|--------|--------------|---------|
| PLUGIN_TINY_ROUTER_QUICK_REFERENCE.txt | ✓ Complete | 2026-03-25 | 1.0 |
| PLUGIN_TINY_ROUTER_SUMMARY.md | ✓ Complete | 2026-03-25 | 1.0 |
| PLUGIN_TINY_ROUTER_QUICK_START.md | ✓ Complete | 2026-03-25 | 1.0 |
| PLUGIN_TINY_ROUTER_DESIGN.md | ✓ Complete | 2026-03-25 | 1.0 |
| PLUGIN_TINY_ROUTER_REFERENCE.md | ✓ Complete | 2026-03-25 | 1.0 |

**Design Status:** MVP Ready for Implementation
**Timeline:** Phase 1 in 1-2 weeks, Phase 2 in 3-4 weeks, Phase 3 in 5-6 weeks

---

## 🚀 Next Steps

1. **Decide:** Read summary, make go/no-go decision
2. **Plan:** Identify owner (engineer/agent), timeline, phases
3. **Implement:** Follow quick-start guide for Phase 1
4. **Test:** Run metrics, measure baseline
5. **Plan Phase 2:** Schedule fine-tuning with real data
6. **Scale:** Phase 3 when Phase 2 complete

---

**Start here → `PLUGIN_TINY_ROUTER_QUICK_REFERENCE.txt` (5 min)**

Then pick your path above based on your role.
