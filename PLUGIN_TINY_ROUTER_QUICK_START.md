# Tiny-Router Plugin: Quick Start Implementation Guide

## 30-Second Overview

This guide walks through Phase 1 (MVP) implementation of the tiny-router message classifier as an Agent Zero extension. The plugin intercepts messages at `message_loop_start`, classifies them into 4 heads (actionability, urgency, relation, retention), and routes to canned responses, cheaper models, or special prompt modes before hitting the LLM.

**Expected time:** 4-6 hours for full Phase 1 (including testing)
**Files to create:** 8-10 files (~800 lines of code)

---

## Phase 1: MVP Implementation (Week 1-2)

### Step 1: Initialize Plugin Directory Structure

```bash
# From project root
mkdir -p usr/plugins/tiny-router/artifacts/tiny-router
mkdir -p usr/plugins/tiny-router/runtime/python/extensions/message_loop_start
mkdir -p usr/plugins/tiny-router/runtime/python/extensions/monologue_start
mkdir -p usr/plugins/tiny-router/runtime/python/helpers
mkdir -p usr/plugins/tiny-router/config

touch usr/plugins/tiny-router/initialize.py
touch usr/plugins/tiny-router/requirements.txt
touch usr/plugins/tiny-router/runtime/python/__init__.py
touch usr/plugins/tiny-router/runtime/python/helpers/__init__.py
```

### Step 2: Create `requirements.txt`

**File:** `usr/plugins/tiny-router/requirements.txt`

```
onnxruntime>=1.16.0
torch>=2.0.0
transformers>=4.30.0
huggingface-hub>=0.16.0
numpy>=1.24.0
```

### Step 3: Download Model Artifacts

**Create:** `usr/plugins/tiny-router/download_model.py`

```python
#!/usr/bin/env python3
"""Download tiny-router model from Hugging Face."""
from pathlib import Path
from huggingface_hub import snapshot_download

def main():
    artifacts_dir = Path(__file__).parent / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    print("Downloading tiny-router ONNX model...")
    try:
        snapshot_download(
            repo_id="tgupj/tiny-router",
            local_dir=str(artifacts_dir / "tiny-router"),
            repo_type="model",
        )
        print("✓ Model downloaded successfully")
    except Exception as e:
        print(f"✗ Download failed: {e}")
        print("Manual fallback: Download from https://huggingface.co/tgupj/tiny-router")

if __name__ == "__main__":
    main()
```

**Run:** `cd usr/plugins/tiny-router && python download_model.py`

### Step 4: Create Model Loader

**File:** `usr/plugins/tiny-router/runtime/python/helpers/tiny_router_model.py`

```python
"""Tiny-router ONNX model loader and inference wrapper."""
import asyncio
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_classifier_instance = None
_lock = asyncio.Lock()


@dataclass
class ClassifierResult:
    label: str
    confidence: float


@dataclass
class TinyRouterOutput:
    relation_to_previous: ClassifierResult
    actionability: ClassifierResult
    retention: ClassifierResult
    urgency: ClassifierResult
    overall_confidence: float


class TinyRouterClassifier:
    """Wrapper around tiny-router ONNX model."""

    RELATION_LABELS = ["new", "follow_up", "correction", "confirmation", "cancellation", "closure"]
    ACTIONABILITY_LABELS = ["none", "review", "act"]
    RETENTION_LABELS = ["ephemeral", "useful", "remember"]
    URGENCY_LABELS = ["low", "medium", "high"]

    def __init__(self, model_dir: str = "usr/plugins/tiny-router/artifacts/tiny-router"):
        from python.helpers.files import get_abs_path
        self.model_dir = Path(get_abs_path(model_dir))
        self.session = None
        self.tokenizer = None
        self._initialized = False

    async def initialize(self):
        """Lazy load model and tokenizer on first use."""
        if self._initialized:
            return

        try:
            import onnxruntime as ort
            from transformers import AutoTokenizer

            # Load ONNX model
            model_path = self.model_dir / "model.onnx"
            if not model_path.exists():
                raise FileNotFoundError(f"ONNX model not found at {model_path}")

            providers = ["CPUExecutionProvider"]
            self.session = ort.InferenceSession(
                str(model_path),
                providers=providers,
            )

            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_dir)

            self._initialized = True
            logger.info(f"Tiny-router model loaded from {model_path}")

        except Exception as e:
            logger.error(f"Failed to load tiny-router model: {e}")
            raise

    async def classify(
        self,
        current_text: str,
        previous_text: Optional[str] = None,
        previous_action: Optional[str] = None,
        previous_outcome: Optional[str] = None,
        recency_seconds: Optional[float] = None,
    ) -> TinyRouterOutput:
        """
        Classify an incoming message.

        Returns:
            TinyRouterOutput with classification for each head
        """
        await self.initialize()

        # Tokenize
        inputs = self.tokenizer(
            current_text,
            padding=True,
            truncation=True,
            max_length=128,
            return_tensors="np",
        )

        # Run inference
        input_feed = {
            "input_ids": inputs["input_ids"],
            "attention_mask": inputs["attention_mask"],
        }
        if "token_type_ids" in inputs:
            input_feed["token_type_ids"] = inputs["token_type_ids"]

        outputs = self.session.run(None, input_feed)

        # Parse outputs (4 heads)
        import numpy as np

        def softmax(logits, temp=1.0):
            scaled = logits / temp
            exp = np.exp(scaled - np.max(scaled))
            return exp / exp.sum(axis=-1, keepdims=True)

        # Temperature-scaled probabilities per head
        rel_probs = softmax(outputs[0][0], temp=0.8)
        act_probs = softmax(outputs[1][0], temp=0.9)
        ret_probs = softmax(outputs[2][0], temp=0.85)
        urg_probs = softmax(outputs[3][0], temp=0.95)

        # Get top label and confidence for each head
        rel_idx = rel_probs.argmax()
        act_idx = act_probs.argmax()
        ret_idx = ret_probs.argmax()
        urg_idx = urg_probs.argmax()

        return TinyRouterOutput(
            relation_to_previous=ClassifierResult(
                label=self.RELATION_LABELS[rel_idx],
                confidence=float(rel_probs[rel_idx]),
            ),
            actionability=ClassifierResult(
                label=self.ACTIONABILITY_LABELS[act_idx],
                confidence=float(act_probs[act_idx]),
            ),
            retention=ClassifierResult(
                label=self.RETENTION_LABELS[ret_idx],
                confidence=float(ret_probs[ret_idx]),
            ),
            urgency=ClassifierResult(
                label=self.URGENCY_LABELS[urg_idx],
                confidence=float(urg_probs[urg_idx]),
            ),
            overall_confidence=float(
                (rel_probs[rel_idx] + act_probs[act_idx] + ret_probs[ret_idx] + urg_probs[urg_idx]) / 4.0
            ),
        )


async def get_classifier() -> TinyRouterClassifier:
    """Get or create singleton classifier."""
    global _classifier_instance
    if _classifier_instance is None:
        _classifier_instance = TinyRouterClassifier()
    return _classifier_instance
```

### Step 5: Create Routing Logic

**File:** `usr/plugins/tiny-router/runtime/python/helpers/tiny_router_routing.py`

```python
"""Routing decision logic based on classifier output."""
from dataclasses import dataclass
from enum import Enum
from typing import Optional, Literal
import logging

logger = logging.getLogger(__name__)


class RoutingMode(Enum):
    STANDARD = "standard"
    CANNED = "canned"
    LIGHTWEIGHT = "lightweight"
    CONTEXTUAL = "contextual"
    CORRECTION = "correction"
    URGENT = "urgent"
    FALLBACK = "fallback"


@dataclass
class RoutingDecision:
    mode: RoutingMode
    skip_llm: bool = False
    canned_response: Optional[str] = None
    confidence_score: float = 0.0
    reasoning: str = ""


class RestaurantRoutingRules:
    """Restaurant-specific routing rules."""

    CANNED_RESPONSES = {
        "ACKNOWLEDGE": "Got it.",
        "CONFIRM_ORDER": "Order confirmed.",
        "THANKS": "Thanks.",
    }

    CONFIRMATION_WORDS = {
        "yep", "yup", "yeah", "ok", "okay", "sounds good", "got it",
        "10-4", "copy", "yes", "confirmed", "will do", "thanks",
    }

    @staticmethod
    def should_use_canned(text: str, actionability: str, relation: str, confidence: float) -> Optional[str]:
        """Check if message should use canned response."""
        text_lower = text.lower().strip()

        # Exact matches
        if text_lower in RestaurantRoutingRules.CONFIRMATION_WORDS:
            if actionability == "none" and relation == "confirmation":
                return RestaurantRoutingRules.CANNED_RESPONSES["ACKNOWLEDGE"]

        # Short confirmations
        if len(text_lower) < 20 and confidence > 0.90:
            if actionability == "none":
                return RestaurantRoutingRules.CANNED_RESPONSES["ACKNOWLEDGE"]

        return None


async def route_message(
    classification,
    message_text: str,
    history_length: int,
) -> RoutingDecision:
    """
    Route message based on classifier output.

    Returns:
        RoutingDecision with routing mode and parameters
    """

    rel = classification.relation_to_previous.label
    act = classification.actionability.label
    urg = classification.urgency.label
    conf = classification.overall_confidence

    # Low confidence → fallback to LLM
    if conf < 0.55:
        return RoutingDecision(
            mode=RoutingMode.FALLBACK,
            confidence_score=conf,
            reasoning=f"Low confidence ({conf:.2f})",
        )

    # Canned responses
    if act == "none":
        canned = RestaurantRoutingRules.should_use_canned(message_text, act, rel, conf)
        if canned:
            logger.info(f"Canned response: {canned[:30]}... (confidence: {conf:.2f})")
            return RoutingDecision(
                mode=RoutingMode.CANNED,
                skip_llm=True,
                canned_response=canned,
                confidence_score=conf,
                reasoning="Actionability=none with high confidence",
            )

    # Follow-ups with context
    if rel == "follow_up" and history_length > 2:
        logger.info("Routing follow-up with tight context")
        return RoutingDecision(
            mode=RoutingMode.CONTEXTUAL,
            confidence_score=conf,
            reasoning="Detected follow-up in conversation",
        )

    # High urgency → priority
    if urg == "high" and act == "act":
        logger.info("High urgency message → front of queue")
        return RoutingDecision(
            mode=RoutingMode.URGENT,
            confidence_score=conf,
            reasoning="High urgency + actionable",
        )

    # Default
    logger.info(f"Standard processing (confidence: {conf:.2f})")
    return RoutingDecision(
        mode=RoutingMode.STANDARD,
        confidence_score=conf,
        reasoning="No special routing rule matched",
    )
```

### Step 6: Create Main Extension

**File:** `usr/plugins/tiny-router/runtime/python/extensions/message_loop_start/_20_tiny_router.py`

```python
"""Main tiny-router extension that runs at message_loop_start."""
import logging
from python.helpers.extension import Extension
from agent import LoopData

logger = logging.getLogger(__name__)


class TinyRouterMessageClassifier(Extension):
    """Classify messages and route them accordingly."""

    async def execute(self, loop_data: LoopData = LoopData(), **kwargs):
        """Execute at message_loop_start."""

        # Only process user messages
        if not loop_data.user_message or not loop_data.user_message.content:
            return

        message_text = loop_data.user_message.content

        try:
            # Import here to avoid circular imports
            from usr.plugins.tiny_router.runtime.python.helpers.tiny_router_model import get_classifier
            from usr.plugins.tiny_router.runtime.python.helpers.tiny_router_routing import route_message, RoutingMode

            # Get classifier and classify
            classifier = await get_classifier()
            classification = await classifier.classify(current_text=message_text)

            logger.info(
                f"Classification: action={classification.actionability.label} "
                f"urgency={classification.urgency.label} "
                f"conf={classification.overall_confidence:.2f}"
            )

            # Route
            decision = await route_message(
                classification,
                message_text,
                len(self.agent.history.messages) if self.agent.history else 0,
            )

            # Store for downstream use
            loop_data.params_temporary["tiny_router_classification"] = {
                "actionability": classification.actionability.label,
                "urgency": classification.urgency.label,
                "relation": classification.relation_to_previous.label,
                "retention": classification.retention.label,
                "confidence": classification.overall_confidence,
            }
            loop_data.params_temporary["tiny_router_decision"] = decision.mode.value

            # Apply decision
            if decision.mode == RoutingMode.CANNED:
                # Send canned response
                self.agent.context.log.add_log(
                    log_type="response",
                    content=decision.canned_response,
                    source="tiny_router",
                )
                logger.info(f"Sent canned response: {decision.canned_response}")

                # Skip LLM by raising InterventionException
                from agent import InterventionException
                raise InterventionException("Canned response sent via tiny_router")

            elif decision.mode == RoutingMode.CONTEXTUAL:
                # Inject context hint for LLM
                loop_data.system.append(
                    "[CONTEXT: This appears to be a follow-up to the previous message.]"
                )

            elif decision.mode == RoutingMode.URGENT:
                # Mark for priority processing
                loop_data.params_temporary["priority"] = "high"

            # Store retention policy
            if classification.retention.label == "ephemeral":
                loop_data.params_temporary["skip_history_save"] = True

        except Exception as e:
            logger.error(f"Tiny-router error: {e}", exc_info=True)
            # Fall through to standard processing on error
```

### Step 7: Create Plugin Initializer

**File:** `usr/plugins/tiny-router/initialize.py`

```python
"""Plugin initialization."""
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


def initialize():
    """Initialize tiny-router plugin."""
    artifacts_dir = Path(__file__).parent / "artifacts" / "tiny-router"

    # Check if model exists
    if not artifacts_dir.exists():
        logger.warning(
            f"Tiny-router artifacts not found at {artifacts_dir}. "
            f"Download with: python usr/plugins/tiny-router/download_model.py"
        )
        return False

    if not (artifacts_dir / "model.onnx").exists():
        logger.warning(f"ONNX model not found at {artifacts_dir / 'model.onnx'}")
        return False

    logger.info("Tiny-router plugin initialized")
    return True


# Run on import
initialize()
```

### Step 8: Add to Settings

**File:** `usr/settings.json` (add to existing)

```json
{
  "tiny_router": {
    "enabled": true,
    "confidence_threshold": 0.75,
    "enable_canned_responses": true,
    "enable_context_injection": true,
    "logging_level": "info"
  }
}
```

### Step 9: Create Tests

**File:** `tests/test_tiny_router_routing.py`

```python
"""Tests for tiny-router routing logic."""
import pytest
from usr.plugins.tiny_router.runtime.python.helpers.tiny_router_routing import (
    route_message,
    RoutingMode,
)


@pytest.mark.asyncio
async def test_route_canned_response():
    """Test routing of low-action confirmations to canned response."""
    classification = type('obj', (object,), {
        'relation_to_previous': type('obj', (object,), {'label': 'confirmation'})(),
        'actionability': type('obj', (object,), {'label': 'none'})(),
        'urgency': type('obj', (object,), {'label': 'low'})(),
        'retention': type('obj', (object,), {'label': 'ephemeral'})(),
        'overall_confidence': 0.95,
    })()

    decision = await route_message(classification, "Got it", 5)
    assert decision.mode == RoutingMode.CANNED
    assert decision.skip_llm == True


@pytest.mark.asyncio
async def test_route_low_confidence_fallback():
    """Test fallback to LLM on low confidence."""
    classification = type('obj', (object,), {
        'relation_to_previous': type('obj', (object,), {'label': 'new'})(),
        'actionability': type('obj', (object,), {'label': 'act'})(),
        'urgency': type('obj', (object,), {'label': 'high'})(),
        'retention': type('obj', (object,), {'label': 'useful'})(),
        'overall_confidence': 0.50,
    })()

    decision = await route_message(classification, "Some message", 5)
    assert decision.mode == RoutingMode.FALLBACK
```

---

## Testing Phase 1

### Manual Testing

```bash
# 1. Test model loading
python -c "
import asyncio
from usr.plugins.tiny_router.runtime.python.helpers.tiny_router_model import get_classifier

async def test():
    clf = await get_classifier()
    result = await clf.classify('Got it')
    print(f'Classification: {result}')

asyncio.run(test())
"

# 2. Run pytest
pytest tests/test_tiny_router_routing.py -v

# 3. Start server and test with dev chat
python run_ui.py &
cd frontend && pnpm dev
# Send messages: "Got it", "86 salmon", "what's the status?"
# Check logs for tiny_router classifications
```

### What to Check

1. **Model loads:** Check startup logs for "Tiny-router model loaded"
2. **Classifications appear:** Look for "Classification: action=..." in logs
3. **Canned responses work:** Message "Got it" should get instant response
4. **Fallback works:** No crashes on error, falls through to standard processing

---

## Metrics to Collect (Phase 1)

Add to extension to track:

```python
# In _20_tiny_router.py before return
loop_data.params_temporary["tiny_router_metrics"] = {
    "inference_time_ms": ...,
    "routing_mode": decision.mode.value,
    "was_canned": decision.skip_llm,
    "confidence": classification.overall_confidence,
}
```

Then aggregate in logs:
- % of messages routed to CANNED (target: 15-20%)
- % of messages routed to CONTEXTUAL (target: 5-10%)
- Average inference time (target: <15ms)
- False positive rate on canned responses (track via user feedback)

---

## Checklist for Phase 1 Completion

- [ ] Directory structure created
- [ ] Model downloaded and verified (~250MB)
- [ ] `tiny_router_model.py` loads and infers successfully
- [ ] `tiny_router_routing.py` makes routing decisions
- [ ] `_20_tiny_router.py` executes in message loop
- [ ] No startup errors
- [ ] Canned responses work end-to-end
- [ ] Tests pass (routing logic, model loading)
- [ ] <20ms average inference time verified
- [ ] Metrics logged to console
- [ ] 0 production crashes

---

## Common Issues & Troubleshooting

### Issue: "ModuleNotFoundError: No module named 'onnxruntime'"
**Solution:** Install dependencies
```bash
pip install -r usr/plugins/tiny-router/requirements.txt
```

### Issue: "ONNX model not found"
**Solution:** Download model
```bash
python usr/plugins/tiny-router/download_model.py
```

### Issue: "ImportError: circular imports"
**Solution:** Move imports to `execute()` method (already done in example)

### Issue: "Agent crashes after canned response"
**Solution:** InterventionException must be raised before returning from execute()

### Issue: Slow inference (>50ms)
**Solution:**
- Check if CPU is overloaded
- Try GPU inference (add CUDAExecutionProvider)
- Profile with `torch.profiler`

---

## Phase 2: Fine-tuning (Later)

Once Phase 1 is stable and collecting metrics:

1. Collect 200-500 real restaurant messages from logs
2. Generate 2000+ synthetic examples
3. Fine-tune model heads
4. Retrain deployment
5. Measure improvement (target: +5% canned routing)

**See main design doc for full Phase 2 details.**

---

## Next Steps

1. **Fork/branch:** Create feature branch `feat/tiny-router-mvp`
2. **Implement:** Follow steps 1-9 above
3. **Test:** Run manual and automated tests
4. **Deploy:** Merge to main after validation
5. **Monitor:** Watch metrics for 1 week
6. **Iterate:** Adjust thresholds based on results

---

## Files Summary

| File | Purpose | Lines |
|------|---------|-------|
| `requirements.txt` | Dependencies | 5 |
| `initialize.py` | Plugin startup | 25 |
| `download_model.py` | Model download script | 25 |
| `tiny_router_model.py` | Model loading + inference | 150 |
| `tiny_router_routing.py` | Routing decision logic | 100 |
| `_20_tiny_router.py` | Main A0 extension | 80 |
| `test_tiny_router_routing.py` | Unit tests | 40 |
| **Total** | | **425** |

---

**Questions?** See `PLUGIN_TINY_ROUTER_DESIGN.md` for full architecture details, cost analysis, and Phase 2+ planning.
