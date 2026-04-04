# Autoresearch → CarabinerOS: Implementation Quick Reference

**TL;DR:** Autoresearch is a framework for autonomous AI-driven LLM optimization. You want to adapt its **3-file pattern + Markdown-driven instructions + git-based result tracking** for A0 plugins. The core training loop requires NVIDIA GPU; fork for inference-only (Ollama).

---

## Quick Facts

| Aspect | Value |
|--------|-------|
| **Total codebase** | ~1K lines (3 files) |
| **Modifiable file** | train.py (630 lines) |
| **Constraints file** | prepare.py (389 lines, read-only) |
| **Instructions file** | program.md (115 lines, Markdown) |
| **Hardware** | Single NVIDIA GPU only |
| **Time per experiment** | 5 minutes (wall-clock, fixed) |
| **Experiments per night** | ~100 (in 8 hours) |
| **Primary metric** | val_bpb (bits per byte, lower = better) |
| **Output format** | Git commits + TSV leaderboard |
| **Agent autonomy** | Full; explicitly states "NEVER STOP" |
| **Dependencies** | torch==2.9.1, rustbpe, tiktoken, pyarrow |
| **Language** | Python 3.10+ |

---

## The 3-File System (Steal This Pattern)

### 1. prepare.py — Read-Only Infrastructure
```python
# Purpose: Setup, data, evaluation, utilities
# Agent CANNOT modify this file

# Exports to train.py:
- MAX_SEQ_LEN = 2048          # Sequence length (constant)
- TIME_BUDGET = 300           # 5 minutes in seconds
- Tokenizer (class)           # encode/decode interface
- make_dataloader()           # Infinite data iterator
- evaluate_bpb()              # Fixed evaluation metric

# Does:
✓ Downloads data from HuggingFace Parquet shards
✓ Trains BPE tokenizer (rustbpe → tiktoken)
✓ Provides dataloader with best-fit packing (100% token utilization)
✓ Evaluates model on validation set (bits per byte)
```

**Why read-only?** Keeps agent's scope bounded. Clear separation: "data/eval = fixed", "model/optimization = mutable".

### 2. train.py — Experiment Playground
```python
# Purpose: Model, optimizer, training loop
# Agent MODIFIES ONLY THIS FILE

# Hyperparameters (all tunable):
DEPTH = 8                  # Num layers
ASPECT_RATIO = 64          # model_dim = depth * aspect_ratio
WINDOW_PATTERN = "SSSL"    # Attention window (S=short, L=long)
TOTAL_BATCH_SIZE = 2**19   # ~524K tokens per step
EMBEDDING_LR = 0.6         # Token embedding LR
MATRIX_LR = 0.04           # Matrix parameters LR (Muon)
WEIGHT_DECAY = 0.2         # Muon weight decay
WARMDOWN_RATIO = 0.5       # LR cooldown fraction
... (8 more hyperparams)

# Agent can hack:
✓ Model architecture (layer depth, hidden dims, attention type)
✓ Optimizer settings (LR, momentum, weight decay)
✓ Training loop mechanics (warmup, scheduling, batch size)
✓ Activation functions, normalization techniques
✗ Cannot add new dependencies
✗ Cannot change evaluation (evaluate_bpb is truth)
✗ Cannot exceed TIME_BUDGET
```

**Structure:**
```python
# Model: GPT with modern design
- Causal self-attention + sliding window
- Value embeddings (ResFormer pattern)
- Rotary position embeddings
- RMSNorm + softcap logits

# Optimizer: Hybrid
- Muon for 2D matrices (orthogonalization)
- AdamW for embeddings, lm_head, scalars
- Per-shape grouping for different LRs

# Training loop:
- Gradient accumulation (decouple batch size from memory)
- Dynamic LR scheduling (progress-based)
- Muon momentum scheduling (ramps 0.85 → 0.95)
- Weight decay scheduling (decay * (1 - progress))
- Early abort on NaN loss
```

### 3. program.md — Agent Instructions (Markdown)
```markdown
# autoresearch

This is an experiment to have the LLM do its own research.

## Setup
1. Agree on a run tag (e.g., `mar5`)
2. Create branch: `git checkout -b autoresearch/<tag>`
3. Read these files: README.md, prepare.py, train.py
4. Verify data: `~/.cache/autoresearch/` has shards + tokenizer
5. Initialize results.tsv with header row
6. Confirm, go.

## Experimentation Loop

LOOP FOREVER:
1. Modify train.py
2. git commit
3. uv run train.py > run.log 2>&1
4. Parse val_bpb from log: `grep "^val_bpb:" run.log`
5. Record in results.tsv (commit, val_bpb, memory_gb, status, description)
6. If val_bpb improved: advance (keep commit)
7. If not improved: git reset (discard)
8. If crash: debug or skip

NEVER STOP — keep looping until human stops you manually.
```

**Why Markdown?** Human-readable, agent-interpretable, easy to iterate without code changes. **Reusable pattern for A0 plugins.**

---

## The Experiment Loop (Autonomous Agent Flow)

```
Step 1: Setup
  ├─ Create branch: autoresearch/mar5
  ├─ Initialize results.tsv (header only)
  ├─ Verify data/tokenizer exist
  └─ Confirm with human

Step 2: First Run (Baseline)
  ├─ Run train.py as-is
  ├─ Log val_bpb to results.tsv with status=keep
  └─ Record first git commit

Step 3: Loop (Agent Autonomous)
  ├─ Idea: "Increase embedding LR from 0.6 to 0.7"
  ├─ Edit train.py: EMBEDDING_LR = 0.7
  ├─ git commit -m "increase embedding LR"
  ├─ Run: uv run train.py > run.log 2>&1 (takes 5 min + startup)
  ├─ Parse result:
  │   ├─ If val_bpb improved (lower):
  │   │   ├─ Record results to results.tsv with status=keep
  │   │   └─ Branch head = current commit (advance)
  │   ├─ If val_bpb worse:
  │   │   ├─ Record results to results.tsv with status=discard
  │   │   └─ git reset --hard HEAD~1 (discard commit)
  │   └─ If crash (NaN, OOM):
  │       ├─ Record results to results.tsv with status=crash
  │       ├─ git reset --hard HEAD~1 (discard commit)
  │       └─ Try to understand + fix, or skip idea
  ├─ Sleep ~10s
  └─ Loop back to "Idea" (NEVER STOP)

Step 4: Morning Review
  ├─ See branch: autoresearch/mar5 with ~100 commits
  ├─ See results.tsv: leaderboard of all experiments
  ├─ Best val_bpb improvements
  ├─ Memory footprint analysis
  ├─ Create PR to main if confident
  └─ Merge or archive for comparison
```

---

## Integration Architecture for CarabinerOS

### Option 1: Train-In-Agent (GPU Restaurants)
```
CarabinerOS A0
├─ plugins/autoresearch/
│   ├─ __init__.py (A0 plugin interface)
│   ├─ autoresearch_runner.py (async wrapper)
│   ├─ train_restaurant.py (fork of train.py)
│   ├─ prepare_restaurant.py (domain-specific data)
│   └─ program_restaurant.md (instructions for restaurant ops domain)
├─ Runs on restaurant's GPU (if available)
├─ Autonomously optimizes small task-specific models
├─ Pushes results to git (fleet can see experiments)
└─ Fleet mesh: PRs shared across restaurants

Startup: A0 reads program_restaurant.md, spawns training loop
Frequency: Nightly (100 experiments = 8 hours)
Cost: $0 (owned GPU), or run on cheap GPU cloud
```

### Option 2: Inference-First (CPU Restaurants)
```
CarabinerOS A0
├─ plugins/autoresearch-inference/
│   ├─ __init__.py (A0 plugin interface)
│   ├─ inference_research_agent.py
│   ├─ ollama_client.py (local LLM via Ollama)
│   └─ program_research.md (research instructions)
├─ Runs on CPU, uses local LLM (Ollama)
├─ Autonomously researches domain problems (no training)
├─ Findings stored in git (markdown documents)
├─ Fleet mesh: shared insights
└─ No NVIDIA GPU required

Startup: A0 spins up Ollama inference agent
Frequency: Continuous or scheduled
Cost: $0 (local inference)
```

### Option 3: Hybrid (Recommended)
```
Fleet of 20 restaurants
├─ 5 with NVIDIA GPUs → run autoresearch training nightly
├─ 15 without GPUs → run autoresearch-inference (Ollama-based research)
├─ Weekly fleet sync:
│   ├─ Trained models: pulled to all restaurants
│   ├─ Research findings: aggregated, shared
│   ├─ Leaderboard: best val_bpb improvements
│   └─ Next week: all restaurants start from new baseline
└─ Total fleet cost: $0 (no API keys, no cloud)
```

---

## Key Metrics & Monitoring

### val_bpb (Validation Bits Per Byte)
- **What it measures:** How many bits of information needed to encode 1 byte of validation text
- **Lower is better:** 0.90 BPB is excellent, 1.0 is baseline, 1.1 is poor
- **Vocab-size-independent:** Fairly compares models with different vocab sizes
- **Fixed evaluation:** Always on 20M validation tokens from pinned shard

### Other Metrics from Log
```
val_bpb:          0.997900   ← Primary metric
training_seconds: 300.1      ← Always ~5 min (fixed budget)
total_seconds:    325.9      ← Includes startup/eval overhead
peak_vram_mb:     45060.2    ← Memory footprint (~44 GB)
mfu_percent:      39.80      ← Model FLOPs utilization (H100)
total_tokens_M:   499.6      ← Tokens seen in 5 min
num_steps:        953        ← Optimizer steps
num_params_M:     50.3       ← Model size
depth:            8          ← Current hyperparameter
```

### results.tsv Leaderboard
```
commit        val_bpb    memory_gb  status  description
a1b2c3d       0.997900   44.0       keep    baseline
b2c3d4e       0.993200   44.2       keep    increase LR to 0.04
c3d4e5f       1.005000   44.0       discard switch to GeLU activation
d4e5f6g       0.000000   0.0        crash   double model width (OOM)
```

---

## Critical Constraints (Don't Violate)

| Constraint | Reason | Violating = Agent Fails |
|-----------|--------|--------------------------|
| Don't modify prepare.py | Read-only infrastructure | Evaluation metric becomes unreliable |
| Don't add dependencies | Keeps scope tight, reproducible | uv sync fails; experiment aborts |
| Don't change TIME_BUDGET | Fixed 5 min enables fleet scheduling | Incomparable results across runs |
| Don't change evaluation metric | val_bpb is ground truth | Can't measure improvement objectively |
| Don't distribute training | Single GPU by design | Adds complexity, breaks autonomy |
| Don't modify train.py outside loop | Agent edits only, systematically | Changes aren't tracked; reproducibility lost |

---

## Hyperparameter Tuning: The Levers

### Quick Scaling Guide (From README)

**For smaller compute (Macbooks, CPUs):**

```python
# Reduce model size
DEPTH = 4 instead of 8                    # Fewer layers
MAX_SEQ_LEN = 256 instead of 2048         # Shorter context
VOCAB_SIZE = 1024 instead of 8192         # Smaller vocab
TOTAL_BATCH_SIZE = 2**14 instead of 2**19 # 16K instead of 524K

# Use simpler data
# Switch to TinyStories dataset (less entropy)

# Simplify attention
WINDOW_PATTERN = "L" instead of "SSSL"    # No sliding window complexity
```

### Experimental Levers (High Impact)

| Lever | Range | Impact |
|-------|-------|--------|
| DEPTH | 4-16 | Model capacity; controls ~everything |
| MATRIX_LR | 0.01-0.1 | Optimizer stability; high sensitivity |
| EMBEDDING_LR | 0.2-1.0 | Token embedding learning; moderate |
| WARMDOWN_RATIO | 0.0-0.7 | LR decay schedule; mild-moderate |
| WINDOW_PATTERN | "SSSL", "LLLL", "L" | Attention pattern; tradeoff speed vs. capacity |
| WEIGHT_DECAY | 0.0-0.4 | Regularization; prevents overfitting |

### Example Progression
```
Experiment 1: Baseline (DEPTH=8, MATRIX_LR=0.04)
  → val_bpb: 0.9979

Experiment 2: Increase depth (DEPTH=10)
  → val_bpb: 0.9950 ✓ (keep, improvement!)

Experiment 3: Increase depth more (DEPTH=12)
  → val_bpb: 0.9945 ✓ (keep, larger improvement!)

Experiment 4: Increase depth too much (DEPTH=14)
  → OOM crash (keep memory in mind)

Experiment 5: Back to DEPTH=12, try higher LR (MATRIX_LR=0.05)
  → val_bpb: 0.9948 ✗ (worse, discard; reset to prev)

Experiment 6: DEPTH=12, try lower WARMDOWN (0.3 instead of 0.5)
  → val_bpb: 0.9944 ✓ (keep)
```

---

## For Your Fork: Restaurant-Specific Adaptations

### prepare_restaurant.py Changes
```python
# Instead of climbmix-400b (generic web data):
# Use restaurant operations data

# Option 1: Synthetic
SPECIAL_DATASET = "restaurant-ops-synthetic"
# Data format: recipes, orders, inventory updates, labor schedules
# Tokenizer still BPE, same vocab

# Option 2: Real
# Aggregate anonymized order histories, menu changes, cost data
# From participating restaurants in CarabinerOS

# Keep same structure:
- MAX_SEQ_LEN = 2048 (or tune down if CPU)
- TIME_BUDGET = 300 (or 60 for quick iterations)
- EVAL_TOKENS = config
- Tokenizer = BPE
```

### program_restaurant.md Changes
```markdown
# autoresearch-restaurant

Autonomous research for restaurant operations ML.

## Domain: Kitchen Operations
- Optimize model for:
  ✓ Recipe representations (ingredients → steps)
  ✓ Order processing (order → kitchen display)
  ✓ Inventory tracking (stock → depletion predictions)
  ✓ Labor scheduling (shifts → task distribution)

## Baseline Model
DEPTH = 6 (smaller than generic; restaurant ops simpler)
WINDOW_PATTERN = "L" (no sliding window; orders are short context)
...

## Success Metrics
- val_bpb on restaurant test set < 0.8 (very good for domain)
- Memory < 20GB (fits RTX 4090)
- Training time stable (no OOM crashes)

## Simplicity Rules
- A 0.001 val_bpb improvement from deleting code? Keep.
- A 0.001 val_bpb improvement from adding 50 lines? Discard.
```

---

## Debugging: Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| **uv sync fails** | Missing CUDA 12.8 or Python 3.10 | Use `pip install` instead; adjust torch version |
| **"No parquet files found"** | prepare.py not run | Run `uv run prepare.py` once |
| **Loss is NaN** | Gradient explosion (bad LR) | Lower MATRIX_LR or EMBEDDING_LR, re-run |
| **OOM after 20 steps** | Model too large for GPU | Lower DEPTH, ASPECT_RATIO, or TOTAL_BATCH_SIZE |
| **val_bpb not improving** | Hyperparams plateaued | Try larger LR changes, different WINDOW_PATTERN |
| **Run exceeds 10 minutes** | TIME_BUDGET misconfigured | Check startup time; if persistent, kill + reset |
| **Git conflicts** | Agent rebased on old baseline | Unlikely; agent doesn't use git pull. Just reset. |

---

## Resources for Deep Dive

1. **Autoresearch repo:** https://github.com/karpathy/autoresearch.git
2. **Nanochat (parent):** https://github.com/karpathy/nanochat (has inference utilities)
3. **Muon optimizer:** https://github.com/kyegomez/muon (paper + implementation)
4. **Flash Attention 3:** kernels library (Hopper GPUs)
5. **BPE tokenizer:** rustbpe + tiktoken libraries

---

## Checklist: Before Integrating into CarabinerOS

- [ ] Clone autoresearch, run baseline locally
- [ ] Understand 3-file pattern (prepare, train, program)
- [ ] Read program.md; internalize "NEVER STOP" autonomy rule
- [ ] Design restaurant-specific fork (prepare_restaurant, train_restaurant)
- [ ] Create program_restaurant.md with domain-specific instructions
- [ ] Test 1 full loop: setup → 10 experiments → review results.tsv
- [ ] Measure end-to-end time (startup + 5 runs + eval)
- [ ] Document platform-specific values (H100 baseline ≠ RTX 4090)
- [ ] Plan fleet distribution (GPU vs CPU restaurants)
- [ ] Design git-native result sharing (branches → PRs → aggregation)
- [ ] Prototype inference-only variant (Ollama) for CPU restaurants
- [ ] Write A0 plugin interface (async, scheduling, monitoring)

---

## TL;DR for Implementation

**Autoresearch in 30 seconds:**
1. Agent reads program.md (Markdown instructions)
2. Agent modifies train.py (model, hyperparameters, optimizer)
3. Agent runs 5-min training loop, evaluates on val_bpb
4. If better: keep commit, advance branch
5. If worse: discard commit, revert
6. Repeat forever (NEVER STOP)
7. Result: 100 experiments overnight, git history of improvements

**For CarabinerOS:**
- Fork for restaurant ops domain (smaller models, special data)
- GPU restaurants train autonomously
- CPU restaurants use inference-only variant (Ollama)
- Weekly fleet sync: share trained models + insights
- Total cost: $0 (no API keys, uses owned hardware)

---

**Generated:** 2026-03-25 (from full source analysis)
**Ready to implement:** Yes, pattern is clear and battle-tested
