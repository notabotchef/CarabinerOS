# Autoresearch Research Documentation

This directory contains comprehensive analysis of Andrej Karpathy's **autoresearch** project for potential integration into CarabinerOS as an Agent Zero plugin for fleet mesh learning.

## Document Structure

### 1. **AUTORESEARCH_SUMMARY.txt** (START HERE)
**13KB, structured quick reference**
- Executive summary of findings
- Key facts (architecture, metrics, constraints)
- 3-file system overview
- Experiment loop walkthrough
- Local model support limitations
- Output format & integration patterns
- Implementation roadmap (3 phases)
- Hyperparameter tuning guide
- Critical constraints (don't violate)
- Restaurant-specific adaptation checklist

**Best for:** Quick lookup, understanding at a glance, decision-making

---

### 2. **autoresearch-analysis.md** (DEEP DIVE)
**16KB, comprehensive technical analysis**
- What it does (autonomous research, 12x/hour experiments)
- How it works technically (architecture, data pipeline, optimizer)
  - `prepare.py` (389 lines, read-only)
  - `train.py` (630 lines, agent-modifiable)
  - `program.md` (115 lines, Markdown instructions)
- Local model support analysis (GPU-only limitation, why not Ollama)
- Output format & integration patterns
- Code quality assessment (strengths & weaknesses)
- Integration roadmap (3-phase plan)
- Key files & dependencies
- Architecture decisions & rationale
- Limitations & cautions
- Conclusion & next steps

**Best for:** Understanding the system deeply, architecture decisions, evaluating trade-offs

---

### 3. **autoresearch-implementation-quickstart.md** (HOW-TO)
**16KB, practical implementation guide**
- Quick facts table
- The 3-file system (steal this pattern)
- Experiment loop with code walkthrough
- Integration architecture (3 options: train-in-agent, inference-first, hybrid)
- Key metrics & monitoring
- Constraint list
- Hyperparameter tuning guide with examples
- Restaurant-specific adaptations (code-ready examples)
- Debugging common issues
- Resources for deep dive
- Implementation checklist
- TL;DR for implementation

**Best for:** Building your fork, implementing A0 plugin, testing, debugging

---

## Key Findings Summary

### What Autoresearch Does
Autonomous AI-driven LLM optimization on single NVIDIA GPU:
- Agent reads `program.md` (Markdown instructions)
- Agent modifies `train.py` (model, hyperparameters)
- Runs 5-minute training loop (fixed wall-clock time)
- Evaluates against `val_bpb` metric
- Keeps improvements, discards failures
- ~12 experiments/hour → ~100 overnight
- Results tracked as git commits (reviewable)

### The 3-File Pattern (STEAL THIS)
```
prepare.py      → Read-only infrastructure (data, eval, utilities)
train.py        → Experiment playground (agent modifies this)
program.md      → Agent instructions in Markdown (easy to version)
```

### Critical Finding: Local Model Support
- ✗ **Autoresearch is GPU-only** (NVIDIA required for training)
- ✗ **Cannot use Ollama/llama.cpp** (they're inference-only; training needs backprop)
- ✓ **Alternative:** Build `autoresearch-inference-agent` (Ollama for research, not training)
- ✓ **Hybrid:** GPU restaurants train, CPU restaurants research via local LLM

### Integration for CarabinerOS Fleet

**Phase 1:** Domain-specific fork (prepare_restaurant.py, train_restaurant.py, program_restaurant.md)

**Phase 2:** Deploy to GPU restaurants, weekly fleet sync

**Phase 3:** CPU restaurants use inference-only agent (Ollama, $0 cost)

**Result:** Fleet-wide learning, $0 cost, uses owned hardware

---

## Quick Reference: The 3-File System

| File | Lines | Role | Agent Can Modify? |
|------|-------|------|-------------------|
| `prepare.py` | 389 | Data prep, tokenizer, eval, utilities | ✗ No |
| `train.py` | 630 | Model, optimizer, training loop | ✓ Yes |
| `program.md` | 115 | Agent instructions in Markdown | ✓ Yes (human writes) |

---

## Key Metrics to Track

| Metric | Good | Excellent | What It Means |
|--------|------|-----------|-----------------|
| `val_bpb` | <1.0 | <0.90 | Bits per byte (lower is better) |
| `training_seconds` | ~300 | 300 | 5-minute fixed budget (should be stable) |
| `peak_vram_mb` | <50GB | <40GB | Memory footprint |
| `mfu_percent` | >30% | >40% | Model FLOPs utilization (efficiency) |
| `num_steps` | ~950 | ~1000 | Steps completed in 5 min |

---

## Hyperparameter Tuning Levers

**For smaller compute (CPU/MacBook):**
- DEPTH = 4 (not 8)
- MAX_SEQ_LEN = 256 (not 2048)
- TOTAL_BATCH_SIZE = 2**14 (not 2**19)
- WINDOW_PATTERN = "L" (not "SSSL")

**High-impact levers:**
- DEPTH (4-16) → model capacity
- MATRIX_LR (0.01-0.1) → optimizer stability
- EMBEDDING_LR (0.2-1.0) → token embedding learning

---

## Critical Constraints (Don't Violate)

| Constraint | Why | Breaking It Causes |
|-----------|-----|-------------------|
| Don't modify `prepare.py` | Read-only infrastructure | Evaluation becomes unreliable |
| Don't add dependencies | Keeps scope tight | `uv sync` fails |
| Don't change TIME_BUDGET | Fixed 5 min enables scheduling | Results become incomparable |
| Don't change eval metric | `val_bpb` is ground truth | Loss of objectivity |
| Don't distribute training | Single GPU by design | Breaks autonomy |

---

## Implementation Phases

### Phase 1: Proof-of-Concept (Week 1-2)
- Fork autoresearch for restaurant ops domain
- Run on single GPU restaurant
- Goal: 10+ successful experiments

### Phase 2: Fleet Mesh Learning (Week 3-4)
- Deploy to GPU-equipped restaurants
- Weekly fleet sync (git-based)
- Leaderboard tracking
- Cost: $0

### Phase 3: Inference-First (Week 5-6)
- Build inference-agent variant (Ollama)
- Deploy to CPU-only restaurants
- All locations contribute (training OR research)

---

## Resource Locations

**In CarabinerOS repo:**
- `/Users/estebannunez/Projects/carabiner-os/docs/research/AUTORESEARCH_SUMMARY.txt` (this summary)
- `/Users/estebannunez/Projects/carabiner-os/docs/research/autoresearch-analysis.md` (deep dive)
- `/Users/estebannunez/Projects/carabiner-os/docs/research/autoresearch-implementation-quickstart.md` (how-to)

**External:**
- GitHub: https://github.com/karpathy/autoresearch.git
- Parent (inference utils): https://github.com/karpathy/nanochat

---

## Reading Order

1. **First time?** Start with `AUTORESEARCH_SUMMARY.txt` (5-10 min read)
2. **Want details?** Read `autoresearch-analysis.md` (15-20 min read)
3. **Ready to code?** Use `autoresearch-implementation-quickstart.md` (reference as needed)

---

## Next Steps

- [ ] Read AUTORESEARCH_SUMMARY.txt (this session)
- [ ] Clone autoresearch locally and run baseline
- [ ] Design restaurant-specific fork
- [ ] Test 1 full loop (setup → 5-10 experiments)
- [ ] Prototype A0 plugin interface
- [ ] Plan fleet distribution strategy
- [ ] Build inference-only variant for CPU restaurants

---

## Questions Answered

**Q: Can we use Ollama/llama.cpp for $0 cost?**
A: Not for training (requires backprop, parameter updates). But build `autoresearch-inference-agent` for research loops using Ollama inference.

**Q: Is autoresearch GPU-only?**
A: Yes, by design. Karpathy explicitly rejects CPU/MPS support to maintain simplicity. Forks exist (MacOS, Windows). We'd fork for CPU inference-agent.

**Q: How often can we run experiments?**
A: ~12 per hour. If 5-minute budget, then 100+ per night (8 hours).

**Q: Can we train multi-GPU?**
A: No. Single GPU by design. Use parent repo (nanochat) for distributed.

**Q: What's the total codebase?**
A: ~1K lines across 3 files. Very minimal. Elegant.

**Q: Can we run on restaurant laptops?**
A: If they have NVIDIA GPU. For CPU: build inference-agent variant (no training, Ollama-based).

**Q: How do we share results across fleet?**
A: Git-based. Each restaurant pushes branch (autoresearch/tag). Fleet pulls improved models via GitAgent. Weekly aggregation.

---

**Generated:** 2026-03-25
**Research Status:** Complete, ready for implementation
**Estimated Implementation Time:** 2-3 weeks (phases 1-2), 1 week additional (phase 3)
**Cost Impact:** $0 (uses owned hardware, no API keys)
