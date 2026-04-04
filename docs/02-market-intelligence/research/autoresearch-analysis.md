# Andrej Karpathy's Autoresearch: Analysis for CarabinerOS A0 Plugin

**Date:** March 25, 2026
**Repo:** https://github.com/karpathy/autoresearch.git
**Focus:** Local model support, architecture, integration patterns for fleet mesh learning

---

## Executive Summary

Autoresearch is a **minimal, elegant framework for autonomous AI-driven LLM training research**. It enables an agent to autonomously optimize a GPT-like model within a fixed 5-minute wall-clock budget, iterating 12x/hour (~100 experiments overnight).

**Critical finding for CarabinerOS:** Autoresearch is **GPU-only (NVIDIA) by design**. The repo explicitly rejects CPU/MPS/local model support to maintain simplicity. However, forks exist for MacOS (MLX) and Windows (RTX). **For fleet mesh learning at $0 cost, we'd need to build a parallel "autoresearch-inference-agent" that runs LLM inference (not training) via Ollama/llama.cpp.**

---

## 1. What It Does

### Core Concept
Autoresearch automates **single-GPU LLM pretraining optimization**. An AI agent (Claude, Copilot, etc.) acts as an autonomous researcher:

1. **Reads context** from `program.md` (agent instructions)
2. **Modifies** `train.py` (model architecture, hyperparameters)
3. **Runs experiments** (~5 min wall-clock time per run)
4. **Evaluates** against metric: `val_bpb` (validation bits-per-byte, lower = better)
5. **Logs results** to `results.tsv` (git-tracked)
6. **Decides** to keep or discard based on improvement
7. **Repeats** indefinitely (until human stops it)

### The Workflow Loop
```
while True:
    1. Hack train.py (architecture, optimizer, LR, batch size, etc.)
    2. git commit
    3. uv run train.py > run.log 2>&1  (5 min max)
    4. Parse val_bpb from log
    5. Log results to results.tsv
    6. If improved: advance branch (keep commit)
    7. If not: git reset (discard)
    8. Sleep ~10s, loop
```

**~12 experiments/hour** → ~100 experiments in 8 hours of sleep
Perfect for: overnight research sessions, iterative optimization

---

## 2. How It Works Technically

### Architecture: 3-File System

#### **prepare.py** (389 lines, READ-ONLY)
- **Data prep**: Downloads 10 Parquet shards from Hugging Face (climbmix-400b-shuffle dataset)
- **Tokenizer**: Trains BPE tokenizer using rustbpe (vocab_size=8192)
- **Runtime utils**:
  - `Tokenizer` class (wraps tiktoken)
  - `make_dataloader()` with best-fit packing (100% token utilization, no padding)
  - `evaluate_bpb()` fixed metric (vocab-size-independent)
- **Constants** (immutable):
  - `MAX_SEQ_LEN = 2048`
  - `TIME_BUDGET = 300` (seconds, 5 min exactly)
  - `EVAL_TOKENS = 40 * 524288` (~20M tokens validation)

#### **train.py** (630 lines, AGENT-MODIFIABLE)
The **entire experimental playground**. Everything here is fair game:

**Model (GPT-like, modern design):**
- Multi-head attention with sliding window patterns (SSSL = alternating short/long)
- Value Embeddings (alternating per-layer, ResFormer style)
- Rotary embeddings (RoPE)
- RMSNorm pre-normalization
- Softcap logits (tanh clamping)

**Optimizer (Hybrid Muon + AdamW):**
- **Muon** for 2D matrix parameters (weight matrices): polar-express orthogonalization + NorMuon variance reduction
- **AdamW** for other parameters: embeddings, lm_head, per-layer scalars
- **Per-shape grouping** for Muon (different LRs per shape)
- Fused kernel ops with `@torch.compile`

**Hyperparameters (all tunable):**
```python
DEPTH = 8                      # Transformer layers
ASPECT_RATIO = 64              # model_dim = depth * ASPECT_RATIO
WINDOW_PATTERN = "SSSL"        # Attention window pattern
TOTAL_BATCH_SIZE = 2**19       # ~524K tokens/step
EMBEDDING_LR = 0.6             # Token embeddings
MATRIX_LR = 0.04               # Matrices (Muon)
WEIGHT_DECAY = 0.2             # Cautious weight decay
WARMUP_RATIO = 0.0             # LR warmup fraction
WARMDOWN_RATIO = 0.5           # LR cooldown (50% of budget)
```

**Training loop:**
- Gradient accumulation to reach `TOTAL_BATCH_SIZE` per optimizer step
- Dynamic LR scheduling based on progress through 5-min budget
- Muon momentum scheduling: ramps from 0.85 → 0.95
- Weight decay decay: `WEIGHT_DECAY * (1 - progress)`
- **Early abort**: NaN loss or loss > 100 → `exit(1)`

#### **program.md** (Agent Instructions)
A Markdown "skill" that defines:
- **Setup phase**: Create branch, initialize results.tsv, verify data/tokenizer
- **Experimentation loop**: Detailed instructions on what to do each round
- **Constraints**: Can only modify `train.py`, no new packages, no eval harness changes
- **Goal**: Minimize `val_bpb` via simplicity-aware optimization
- **Autonomy rule**: "NEVER STOP" — keep looping until human stops you; don't ask for approval

---

### Output Format: Structured Logging

**Per-run summary (printed + saved to run.log):**
```
---
val_bpb:          0.997900
training_seconds: 300.1
total_seconds:    325.9
peak_vram_mb:     45060.2
mfu_percent:      39.80
total_tokens_M:   499.6
num_steps:        953
num_params_M:     50.3
depth:            8
```

**Experiment tracking (results.tsv):**
```
commit	val_bpb	memory_gb	status	description
a1b2c3d	0.997900	44.0	keep	baseline
b2c3d4e	0.993200	44.2	keep	increase LR to 0.04
c3d4e5f	1.005000	44.0	discard	switch to GeLU activation
d4e5f6g	0.000000	0.0	crash	double model width (OOM)
```

---

## 3. Local Model Support: The Hard Limitation

### Current State: GPU-ONLY

**Autoresearch explicitly does NOT support:**
- CPU training (too slow for 5-min budget on small models)
- Apple Silicon (MPS)
- AMD GPUs (uses NVIDIA-specific Flash Attention 3)
- Local LLM inference (no inference agent layer)

**Karpathy's rationale** (from README):
> "This code currently requires that you have a single NVIDIA GPU... In principle it is quite possible to support CPU, MPS and other platforms but this would also bloat the code. I'm not 100% sure that I want to take this on personally right now."

**He points to forks for non-NVIDIA:**
- `miolini/autoresearch-macos` (MLX backend)
- `trevin-creator/autoresearch-mlx` (MLX)
- `jsegov/autoresearch-win-rtx` (Windows RTX)
- `andyluo7/autoresearch` (AMD)

### Why Not Ollama/llama.cpp?

Autoresearch trains LLMs from scratch (forward + backward passes). Ollama/llama.cpp are **inference-only** frameworks. Training a model requires:
1. Gradient computation (backprop) — not supported by inference engines
2. Optimizer step updates — requires access to parameter tensors
3. Direct PyTorch model manipulation — not feasible through API layers

**Ollama could serve inference for evaluation**, but the core training loop must stay PyTorch.

---

## 4. Output Format & Integration Patterns

### What Autoresearch Produces

**Per experiment:**
1. **Git commit** with modified `train.py` (clean diffs, reviewable)
2. **run.log** (full training output, temporary, not tracked)
3. **results.tsv** (TSV spreadsheet, human-readable, NOT committed)

**At session end:**
- Branch on `autoresearch/<tag>` with N commits (one per successful experiment)
- Each commit = one improvement step
- `results.tsv` = leaderboard (val_bpb, memory, description)

### Integration Patterns for CarabinerOS

**Option A: Train-in-Agent mode (Closest to Original)**
```
CarabinerOS A0 + autoresearch plugin
├── Runs on chef's laptop/GPU (if available)
├── Autonomously optimizes a small domain LLM (restaurant ops knowledge)
├── Stores results in git (fleet can see experiments)
└── Fleet mesh shares learned models (branches → PRs → main)
```

**Option B: Inference + Local LLM (For $0 Cost)**
```
CarabinerOS A0 + autoresearch-inference-agent
├── Runs small LLM inference via Ollama (local, $0, no API keys)
├── Feeds research findings to agents (research loop != training)
├── Uses autoresearch pattern for autonomous research (not model training)
├── Agents modify research strategy (parameters.md), not model weights
└── Findings git-tracked, shared across fleet
```

**Option C: Hybrid (Recommended)**
- **GPU-equipped restaurants**: Run autoresearch training locally (optimize task-specific models)
- **CPU-only**: Use inference agent + local LLM for autonomous research/analysis
- **Fleet mesh**: Share trained models + research findings across both

---

## 5. Code Quality & Architecture

### Strengths

**Elegance:**
- **3 files, ~1K lines of code** — incredibly concise
- **Single responsibility**: prepare.py (data), train.py (experiment), program.md (strategy)
- **Composable**: Agent works with Markdown instructions, not API/SDK
- **Git-native**: Results are commits, not logs; reviewable diffs

**Production-ready:**
- **Robust timing**: Wall-clock budget enforced, timeout handling
- **Memory management**: Tracks peak VRAM, handles OOM gracefully
- **Data pipeline**: Best-fit packing (100% token utilization), efficient batching
- **Gradient accumulation**: Decouples batch size from memory pressure
- **Frozen GC**: Disables Python garbage collection to avoid stalls

**Research-friendly:**
- **Metric isolation**: `val_bpb` is vocab-size-independent (fair cross-architecture comparison)
- **Simple decisions**: Keep/discard based on metric only
- **Reproducibility**: Seeded randomness, deterministic tokenizer
- **Ablation-ready**: Single file to modify = clear cause/effect

### Weaknesses (For CarabinerOS Use)

**Hard GPU requirement:**
- Non-negotiable for training; must fork for CPU/local models
- Limits deployment to restaurants with NVIDIA hardware

**Data-dependent:**
- Requires 10+ Parquet shards (~50GB+) from climbmix dataset
- Downloading/tokenization is a one-time ~2 min setup
- Could be problematic for remote restaurants on slow internet

**Simplicity as a constraint:**
- No distributed training (single GPU only)
- No checkpointing/resume (if interrupted, restart)
- No custom evaluation metrics (fixed to `val_bpb`)
- No inference utilities (focus is on training only)

**Time budget inflexibility:**
- 5 minutes is hardcoded; can't run shorter/longer experiments
- Makes results incomparable across platforms (H100 vs RTX 4090)

### Code Patterns Worth Stealing

**For A0 Plugin Development:**

1. **Read-only + editable split** (prepare.py vs train.py)
   - Agent only modifies one file
   - Clear constraints, reduced blast radius

2. **Markdown-driven instructions** (program.md)
   - Human-readable, agent-interpretable
   - Easy to version, iterate on strategy
   - **Reusable pattern for A0 plugins**

3. **Results as git commits**
   - Natural versioning, blame tracking
   - TSV leaderboard for human consumption
   - Enables fleet mesh (git-based sharing)

4. **Fixed time budget + metric**
   - Orthogonal concerns: speed vs quality
   - Predictable resource usage
   - Enables fleet scheduling

5. **Fused PyTorch ops + torch.compile**
   - Modern optimization patterns
   - ~40% MFU on H100 (room for improvement)
   - Could be leveraged for inference optimizations

---

## 6. Integration Roadmap for CarabinerOS

### Phase 1: Proof-of-Concept (Week 1-2)
```
Create: plugins/autoresearch/
├── plugin.py (A0 plugin wrapper)
├── autoresearch_lite.py (fork of train.py, simplified)
├── prepare_restaurant.py (domain-specific data prep)
└── program_restaurant.md (restaurant-specific instructions)

Goal: Run one autonomous training loop on restaurant op data
Budget: 5 min, ~12 experiments/hour
```

### Phase 2: Fleet Mesh Learning (Week 3-4)
```
Fleet coordination:
├── Each A0 runs autoresearch autonomously
├── Weekly: git push best models to fleet registry
├── Central: Aggregate improvements across locations
├── Distribute: Pull improved models to all A0s (GitAgent)
└── Metric: Track val_bpb improvements across fleet

Goal: $0 cost LLM optimization, weekly fleet-wide gains
```

### Phase 3: Inference-First Research Agent (Week 5-6)
```
Create: plugins/autoresearch-inference/
├── Runs local LLM (Ollama) for research
├── Modifies research.md (findings, hypotheses)
├── No model training, no GPU required
├── Findings aggregated -> shared via git

Goal: Restaurants without GPUs still contribute research
```

---

## 7. For Your Reference: Key Files

**Absolute paths at clone time:**
- `/tmp/autoresearch/train.py` (630 lines, the playground)
- `/tmp/autoresearch/prepare.py` (389 lines, data + eval)
- `/tmp/autoresearch/program.md` (115 lines, agent instructions)
- `/tmp/autoresearch/README.md` (full setup + design rationale)
- `/tmp/autoresearch/pyproject.toml` (torch 2.9.1, rustbpe, tiktoken)

**Dependencies (no surprises):**
```
kernels>=0.11.7          # Flash Attention 3
torch==2.9.1             # PyTorch (CUDA 12.8)
rustbpe>=0.1.0           # BPE tokenizer
tiktoken>=0.11.0         # Tokenizer encoding
pyarrow>=21.0.0          # Parquet reading
requests>=2.32.0         # HTTP download
```

---

## 8. Architecture Decisions Worth Noting

### Why Muon Optimizer?
- **2D matrices**: RMSprop-like but with SVD orthogonalization (improves generalization)
- **1D + scalars**: Standard AdamW (stable, well-studied)
- **Per-shape grouping**: Different weight distributions → different LRs
- **Fused kernels**: torch.compile reduces overhead ~10%

### Why Sliding Window Attention?
```
SSSL pattern:
- Layer 0: Short window (2048/2 = 1024)
- Layer 1: Short window (1024)
- Layer 2: Short window (1024)
- Layer 3: Long window (2048, causal)
Repeat for 8 layers

Tradeoff: Cheaper computation vs. some long-range loss
Karpathy's finding: Minor val_bpb cost (~0.005) for 3x speedup
```

### Why Value Embeddings?
- **ResFormer innovation**: Alternate layers get learned value embeddings
- **Gated mix**: `v_new = v_old + gate * v_embedding`
- **Per-head**: Different gates per attention head
- **Simplicity win**: Minimal params, improves generalization

### Why 5-Minute Budget?
- **H100 constraint**: In 5 min, train ~1000 steps, reach meaningful convergence
- **Overnight viability**: 100 experiments in 8 hours
- **Platform-fairness**: Results optimized for YOUR hardware, not comparable cross-platform
- **Agent autonomy**: Enough time to run, verify, decide without human intervention

---

## 9. Limitations & Cautions

### For CarabinerOS Fleet Mesh

| Limitation | Impact | Mitigation |
|-----------|--------|-----------|
| GPU-only | Most restaurants can't run training locally | Build inference-agent variant; GPU restaurants lead, others consume |
| Data download | 50GB+ per location; slow on rural internet | Download once, cache in fleet registry, distribute pre-processed |
| 5-min fixed | Can't run shorter experiments on weak GPUs | Fork for custom time budgets; document platform-specific values |
| No checkpointing | If interrupted, lose progress | Accept loss; short 5-min cycles = recovery fast |
| Metric locked | Can't optimize for domain-specific losses | Fork `evaluate_bpb()` in your domain variant |
| No inference code | Can't sample from trained models | Add generation utilities; Karpathy's nanochat has inference utils |

### For Your Implementation

1. **Don't try to run autoresearch on MacBooks** — refer users to MLX fork
2. **Don't try to add Ollama support to training** — use it for inference verification only
3. **Don't ignore the platform-specificity** — an H100 autoresearch run is incomparable to RTX 4090
4. **Don't extend beyond train.py** — constraints are features (reviewability, scope)
5. **Don't train multi-GPU** — completely changes the architecture; use nanochat parent repo instead

---

## Conclusion

**Autoresearch is a masterclass in autonomous AI research automation.** Its elegance comes from ruthless simplification:
- One GPU, one file, one metric
- Agent modifies only train.py; agent instructions in Markdown
- Results are git commits, not logs
- Fixed 5-min budget enables fleet coordination

**For CarabinerOS:**
- ✅ **Pattern: Adopt the 3-file system + Markdown-driven instructions for A0 plugins**
- ✅ **Pattern: Git-native results for fleet mesh sharing**
- ✅ **Pattern: Autonomous loops (program.md's "NEVER STOP" rule)**
- ❌ **Direct use: Training requires GPU; fork for local models**
- ✅ **Hybrid: GPU restaurants train, all restaurants share findings + inference**

**Next step:** Build `autoresearch-restaurant` (domain-specific fork) + `autoresearch-inference-agent` (local LLM research loop, $0 cost).

---

**Research conducted:** 2026-03-25
**Repo cloned from:** https://github.com/karpathy/autoresearch.git (commit snapshot)
**Focus areas analyzed:** Architecture, LLM support, integration patterns, code quality
