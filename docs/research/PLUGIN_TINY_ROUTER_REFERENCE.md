# Tiny-Router Plugin: Architecture Reference & Command Guide

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Input (Socket.IO)                        │
│                    e.g., "86 the salmon"                              │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              API Layer: /message → ApiMessage.process()             │
│         Extract context_id, message, attachments, lifetime          │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│        Agent Layer: Agent.monologue() message loop                  │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────┐      │
│   │  message_loop_start extensions                          │      │
│   │  ├─ _10_iteration_no.py (core A0)                       │      │
│   │  ├─ _20_tiny_router.py  ★ [THIS PLUGIN] ◄──────┐       │      │
│   │  │   • Load model (lazy)                        │       │      │
│   │  │   • Classify: relation|actionability|...     │       │      │
│   │  │   • Route: canned|contextual|urgent|standard │       │      │
│   │  │   • Inject system hints or raise Exception   │       │      │
│   │  └─ (others)                                    │       │      │
│   └──────────────────────────────────────────────────┼──────┘      │
│                                              ▲       │              │
│   handle_intervention() ◄───────────────────┴───────┘              │
│   (if InterventionException raised)                                │
│        → Skip to response (don't call LLM)                         │
│                     │                                              │
│   ┌────────────────▼───────────────────────────────────┐          │
│   │  prepare_prompt()                                   │          │
│   │  (build system + history + current message)         │          │
│   └────────────────┬───────────────────────────────────┘          │
│                    │                                               │
│   ┌────────────────▼───────────────────────────────────┐          │
│   │  before_main_llm_call extensions                    │          │
│   └────────────────┬───────────────────────────────────┘          │
│                    │                                               │
│   ┌────────────────▼───────────────────────────────────┐          │
│   │  call_chat_model() ← ONLY if not canned            │          │
│   │  (LLM API call with streaming)                     │          │
│   └────────────────┬───────────────────────────────────┘          │
│                    │                                               │
│   ┌────────────────▼───────────────────────────────────┐          │
│   │  message_loop_end extensions                        │          │
│   │  (save context, organize history, etc.)            │          │
│   └────────────────┬───────────────────────────────────┘          │
│                    │                                               │
│   ┌────────────────▼───────────────────────────────────┐          │
│   │  return response                                    │          │
│   └────────────────┬───────────────────────────────────┘          │
└────────────────────┼─────────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │   Frontend (React)          │
        │   Display response         │
        └────────────────────────────┘
```

---

## Message Flow Sequence Diagram

```
User             API              Agent Loop          Tiny-Router         LLM
  │               │                  │                   │                 │
  ├─ Send msg ──> │                  │                   │                 │
  │               │ create context   │                   │                 │
  │               ├─────────────────> │                   │                 │
  │               │                  │                   │                 │
  │               │                  │ message_loop_start│                 │
  │               │                  ├──────────────────> │                 │
  │               │                  │                   │ load model      │
  │               │                  │                   │ (lazy, 1st time)│
  │               │                  │                   │                 │
  │               │                  │                   │ classify        │
  │               │                  │                   │ (<10ms)         │
  │               │                  │                   │                 │
  │               │                  │ <decision>        │                 │
  │               │                  │ <──────────────── │                 │
  │               │                  │                   │                 │
  │               │        ╔════════════════════════════════════╗          │
  │               │        ║  IF canned response: skip LLM      ║          │
  │               │        ║  ELSE inject hints, continue       ║          │
  │               │        ╚════════════════════════════════════╝          │
  │               │                  │                   │                 │
  │ ─ if canned ─ │                  │                   │                 │
  │   ◄───────────┤─ <response> ◄──── │                   │                 │
  │               │                  │                   │                 │
  │ ─ if standard ┤                  │                   │                 │
  │   │           │                  │ prepare_prompt()  │                 │
  │   │           │                  ├──────────────────> │                 │
  │   │           │                  │                   │                 │
  │   │           │                  │                   │ call_chat_model │
  │   │           │                  │                   ├───────────────> │
  │   │           │                  │                   │                 │
  │   │           │                  │ stream response   │ <──────────────┤
  │   │           │                  │ <────────────────┤                 │
  │   │           │                  │                   │                 │
  │   │           │ message_loop_end │                   │                 │
  │   │           │ (save history)   │                   │                 │
  │   │           │                  │                   │                 │
  │   └───────────┤ <response> ◄───── │                   │                 │
  │               │                  │                   │                 │
```

---

## File Structure

```
usr/plugins/tiny-router/
├── initialize.py                          # Plugin entry point
├── requirements.txt                       # Dependencies
├── download_model.py                      # Download ONNX model
│
├── artifacts/
│   └── tiny-router/                       # Downloaded model (250MB)
│       ├── config.json
│       ├── model.onnx                     # ONNX binary (main file)
│       ├── tokenizer.json
│       └── vocab.txt
│
└── runtime/
    └── python/
        ├── __init__.py
        │
        ├── extensions/
        │   ├── message_loop_start/
        │   │   └── _20_tiny_router.py     # Main extension (executes here)
        │   │
        │   └── monologue_start/
        │       └── _05_tiny_router_init.py # (future: warm-up model)
        │
        └── helpers/
            ├── __init__.py
            ├── tiny_router_model.py       # Model loader + inference
            ├── tiny_router_routing.py     # Routing decision logic
            └── tiny_router_cache.py       # (future: interaction cache)
```

---

## Classification Output Schema

```python
# What the model outputs

{
  "relation_to_previous": {
    "label": "new" | "follow_up" | "correction" | "confirmation" | "cancellation" | "closure",
    "confidence": 0.0 - 1.0
  },
  "actionability": {
    "label": "none" | "review" | "act",
    "confidence": 0.0 - 1.0
  },
  "retention": {
    "label": "ephemeral" | "useful" | "remember",
    "confidence": 0.0 - 1.0
  },
  "urgency": {
    "label": "low" | "medium" | "high",
    "confidence": 0.0 - 1.0
  },
  "overall_confidence": 0.0 - 1.0  # Average of 4 heads
}

# Examples

# Example 1: Simple confirmation
{
  "current_text": "Got it",
  "relation_to_previous": {"label": "confirmation", "confidence": 0.94},
  "actionability": {"label": "none", "confidence": 0.96},
  "retention": {"label": "ephemeral", "confidence": 0.89},
  "urgency": {"label": "low", "confidence": 0.91},
  "overall_confidence": 0.93
}

# Example 2: Urgent action
{
  "current_text": "86 the salmon NOW",
  "relation_to_previous": {"label": "new", "confidence": 0.88},
  "actionability": {"label": "act", "confidence": 0.97},
  "retention": {"label": "remember", "confidence": 0.82},
  "urgency": {"label": "high", "confidence": 0.95},
  "overall_confidence": 0.91
}

# Example 3: Follow-up with doubt
{
  "current_text": "Actually, wait, is that still up?",
  "relation_to_previous": {"label": "correction", "confidence": 0.79},
  "actionability": {"label": "review", "confidence": 0.68},
  "retention": {"label": "useful", "confidence": 0.75},
  "urgency": {"label": "medium", "confidence": 0.61},
  "overall_confidence": 0.71  # Lower confidence → use full LLM
}
```

---

## Routing Decision Tree (Flow Chart)

```
Classification
     │
     ├─ overall_confidence < 0.55
     │  └─> RoutingMode.FALLBACK (use full LLM)
     │
     ├─ actionability == "none"
     │  └─> Check if should use canned response
     │      ├─ text in CONFIRMATION_WORDS and relation=confirmation
     │      │  └─> RoutingMode.CANNED (skip LLM, return "Got it.")
     │      │
     │      └─ Short text (<20 chars) and confidence > 0.90
     │         └─> RoutingMode.CANNED
     │
     ├─ relation == "correction" and confidence > 0.80
     │  └─> RoutingMode.CORRECTION (use clarification prompt)
     │
     ├─ urgency == "high" and actionability == "act"
     │  └─> RoutingMode.URGENT (priority queue, shorter timeout)
     │
     ├─ relation == "follow_up" and history_length > 2
     │  └─> RoutingMode.CONTEXTUAL (inject context, tight window)
     │
     └─ else
        └─> RoutingMode.STANDARD (full A0 processing)
```

---

## Configuration Reference

### Settings (`usr/settings.json`)

```json
{
  "tiny_router": {
    "enabled": true,
    "confidence_threshold": 0.75,
    "enable_canned_responses": true,
    "enable_lightweight_model": false,
    "enable_context_injection": true,
    "fallback_on_error": true,
    "logging_level": "info",
    "metrics_enabled": true,
    "model_dir": "usr/plugins/tiny-router/artifacts/tiny-router"
  }
}
```

### Thresholds (In Code)

```python
SAFETY_THRESHOLDS = {
    "canned_response": 0.90,      # Very high confidence
    "lightweight_model": 0.85,    # High confidence
    "contextual": 0.75,           # Medium confidence
    "fallback": 0.55,             # Below → always use LLM
}

CANNED_RESPONSE_WORDS = {
    "yep", "yup", "yeah", "ok", "okay", "sounds good", "got it",
    "10-4", "copy that", "yes", "confirmed", "will do", "thanks",
    "thank you", "cool", "alright", "perfect", "all set", "absolutely"
}
```

---

## Command Reference

### Setup & Installation

```bash
# Download model artifacts (~250MB)
python usr/plugins/tiny-router/download_model.py

# Verify model exists
ls -lh usr/plugins/tiny-router/artifacts/tiny-router/model.onnx

# Install dependencies
pip install -r usr/plugins/tiny-router/requirements.txt
```

### Development & Testing

```bash
# Test model loading and inference
python -c "
import asyncio
from usr.plugins.tiny_router.runtime.python.helpers.tiny_router_model import get_classifier

async def test():
    clf = await get_classifier()
    result = await clf.classify('Got it')
    print(f'Actionability: {result.actionability.label}')
    print(f'Confidence: {result.overall_confidence:.2f}')

asyncio.run(test())
"

# Run routing logic tests
pytest tests/test_tiny_router_routing.py -v

# Run all tiny-router tests
pytest tests/ -k tiny_router -v

# Check logs for classifications
python run_ui.py 2>&1 | grep -i "tiny_router"
```

### Production Deployment

```bash
# Build Docker image with tiny-router
docker build -f Dockerfile.agent-zero -t carabiner-os:latest .

# Start with tiny-router enabled
docker-compose -f docker-compose.dev.yml up

# Verify model loaded in container
docker logs <container-id> | grep "Tiny-router model loaded"
```

### Debugging

```bash
# Enable debug logging
export TINY_ROUTER_DEBUG=1
python run_ui.py

# Profile inference time
python -c "
import asyncio
import time
from usr.plugins.tiny_router.runtime.python.helpers.tiny_router_model import get_classifier

async def benchmark():
    clf = await get_classifier()
    for text in ['Got it', '86 salmon', 'What is the status?']:
        start = time.time()
        result = await clf.classify(text)
        elapsed = (time.time() - start) * 1000
        print(f'{text:30} → {result.actionability.label:10} ({elapsed:.1f}ms)')

asyncio.run(benchmark())
"

# Check model size and format
file usr/plugins/tiny-router/artifacts/tiny-router/model.onnx

# Inspect model inputs/outputs with ONNX
python -c "
import onnx
model = onnx.load('usr/plugins/tiny-router/artifacts/tiny-router/model.onnx')
print('Inputs:', [inp.name for inp in model.graph.input])
print('Outputs:', [out.name for out in model.graph.output])
"
```

### Monitoring & Observability

```bash
# Watch metrics in real-time
tail -f data/logs/agent.log | grep tiny_router

# Count routing decisions
grep "Routing" data/logs/agent.log | sort | uniq -c

# Extract classification statistics
grep "Classification:" data/logs/agent.log | \
  sed 's/.*action=\([^ ]*\).*/\1/' | \
  sort | uniq -c | sort -rn

# Average inference time
grep "tiny_router_metrics" data/logs/agent.log | \
  jq .inference_time_ms | \
  awk '{sum+=$1; count++} END {print "Avg: " sum/count "ms"}'
```

---

## Dependencies & Requirements

### Python Packages

```
onnxruntime>=1.16.0      # ONNX inference (CPU/GPU)
torch>=2.0.0              # Tensor operations
transformers>=4.30.0      # Tokenizer + model utilities
huggingface-hub>=0.16.0   # Download models
numpy>=1.24.0             # Numerical computing
```

### System Requirements

- **CPU:** x86_64 or ARM (2+ cores recommended)
- **RAM:** 2GB+ (model in memory after loading)
- **Storage:** 300MB for model artifacts
- **Python:** 3.10+ (tested on 3.10, 3.11, 3.12)

### Optional (GPU)

```
onnxruntime-gpu>=1.16.0   # ONNX with CUDA support
torch-cuda                 # PyTorch with CUDA
```

---

## Inference Specifications

### Performance Characteristics

```
Model Size:       ~44M parameters
Model Format:     ONNX binary (optimize for speed)
Quantization:     INT8 (if available in artifact)
Input Length:     Max 128 tokens (auto-truncated)
Inference Time:   ~5-10ms (CPU), ~2-5ms (GPU)
Batch Size:       1 (single message at a time)
Latency:          <20ms p99 (including tokenization)
```

### Tokenization

```python
# Input to tokenizer (example)
{
  "current_text": "86 the salmon",
  "interaction": {
    "previous_text": "Table 4 needs 2 covers",
    "previous_action": "logged_order",
    "previous_outcome": "success",
    "recency_seconds": 30.0
  }
}

# Tokenization config
max_length = 128
padding = "max_length"
truncation = True
return_tensors = "np"  # NumPy arrays for ONNX
```

### Output Tensor Shapes

```
Input:
  input_ids:      (1, 128)
  attention_mask: (1, 128)
  token_type_ids: (1, 128) [optional]

Output:
  logits_relation:       (1, 6)   → 6 labels
  logits_actionability:  (1, 3)   → 3 labels
  logits_retention:      (1, 3)   → 3 labels
  logits_urgency:        (1, 3)   → 3 labels
```

---

## Integration Checklist

### Pre-Deployment

- [ ] Model artifacts downloaded and verified (250MB)
- [ ] Dependencies installed (`pip install -r requirements.txt`)
- [ ] Unit tests pass (`pytest tests/test_tiny_router_*.py`)
- [ ] Manual inference test works (<20ms)
- [ ] Extension loads without errors
- [ ] No startup delays (lazy loading working)
- [ ] Canned responses send correctly
- [ ] InterventionException properly skips LLM

### During Deployment

- [ ] Docker image builds successfully
- [ ] Model loads in container (check logs)
- [ ] First message inference works
- [ ] Canned response latency verified (<100ms total)
- [ ] Memory usage within limits (<2GB)
- [ ] No performance regression on standard messages

### Post-Deployment

- [ ] Monitor false positive rate (canned when should be LLM)
- [ ] Track average inference time (< 15ms)
- [ ] Verify % of messages routed (target: 20-30%)
- [ ] Collect user feedback on response quality
- [ ] Adjust thresholds based on results
- [ ] Plan Phase 2 fine-tuning with real data

---

## Cost Comparison

### Per-Message Costs

```
Method                    Cost/Message    Speed           Quality
────────────────────────────────────────────────────────────────
LLM Only (Opus)           $0.0004         1-3 sec         Excellent
Tiny-Router → Canned      $0.0001         <100ms          Good
Tiny-Router → Haiku       $0.00004        2-5 sec         Good
Tiny-Router → LLM Fallback $0.0004        1-3 sec         Excellent
────────────────────────────────────────────────────────────────
```

### Monthly Savings (5 locations, 500 msg/day)

```
Baseline (LLM only):
  500 msg/day × 30 days × $0.0004/msg = $6.00/day = $180/month per location
  × 5 locations = $900/month

With Tiny-Router (conservative 20% routed):
  100 canned (20%):   $0.0001/msg = $0.01/day
  400 LLM (80%):      $0.0004/msg = $0.16/day
  Total: $0.17/day = $5.10/month per location × 5 = $25.50/month

  Inference cost (server): ~$50/month (shared across all restaurants)
  Net savings: $900 - $25.50 - $50 = ~$825/month
```

---

## FAQ

**Q: Will the plugin slow down the agent?**
No. ONNX inference is <10ms, which is negligible compared to LLM roundtrip (1-3 sec). Canned responses are actually faster.

**Q: What if the classifier is wrong?**
Low confidence messages fall back to full LLM. Confidence threshold is conservative (0.9 for canned responses).

**Q: Can I customize the routing logic?**
Yes. Edit `tiny_router_routing.py` to add restaurant-specific rules, different thresholds, or new routing modes.

**Q: Does it work offline?**
Yes. Once the model is downloaded, no internet connection needed. Pure local inference.

**Q: How much storage does the model use?**
~250MB on disk (compressed ONNX format). In memory: ~300-400MB after loading.

**Q: Can I fine-tune the model?**
Yes, Phase 2 covers this. Requires labeled training data from your restaurant. See main design doc.

**Q: What if inference fails?**
Extension catches errors and falls through to standard LLM processing. No crashes.

---

## Resources

- **Main Design Doc:** `PLUGIN_TINY_ROUTER_DESIGN.md`
- **Quick Start Guide:** `PLUGIN_TINY_ROUTER_QUICK_START.md`
- **Model on Hugging Face:** https://huggingface.co/tgupj/tiny-router
- **ONNX Runtime:** https://onnxruntime.ai/
- **Agent Zero:** https://github.com/A0Zero/agent-zero

---

**Last Updated:** 2026-03-25
**Version:** 1.0 (Phase 1)
**Status:** MVP Ready for Implementation
