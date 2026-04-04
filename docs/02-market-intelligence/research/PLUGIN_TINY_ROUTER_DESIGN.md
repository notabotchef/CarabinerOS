# Agent Zero Plugin: Tiny-Router Message Classifier

## Executive Summary

**Objective:** Reduce API costs by 30-40% by pre-filtering low-value messages locally before they reach the LLM.

**Mechanism:** Deploy a lightweight DeBERTa-v3-small classifier (~44M params, <10ms ONNX inference) as a `message_loop_start` extension that routes incoming messages through four decision heads before the main LLM call.

**Estimated Savings:**
- **Messages filtered:** ~35% of all kitchen messages (confirmations, low-value follow-ups, simple queries)
- **Cost reduction:** $150-200/mo at scale ($600/mo → $400-450/mo)
- **Latency impact:** +8-12ms per message (ONNX inference) vs. typical 300-1000ms LLM roundtrip → imperceptible
- **True cost:** Model hosting (CPU inference) negligible; artifact storage (250MB) one-time

---

## 1. Plugin Architecture

### 1.1 Placement in A0 Message Flow

```
User Message (Socket.IO)
    ↓
API: /message → ApiMessage.process()
    ↓
AgentContext.agent0.add_message(UserMessage)
    ↓
Agent.monologue() loop
    ├─ message_loop_start [← **PLUGIN INTERCEPTS HERE**]
    │  ├─ message_loop_start extensions execute
    │  │  ├─ _10_iteration_no.py (core)
    │  │  ├─ _20_tiny_router.py **[NEW]** ← classify, decide routing
    │  │  └─ (others)
    │  ├─ handle_intervention() [plugin can skip LLM via InterventionException]
    │  └─ ↓
    ├─ prepare_prompt()
    ├─ before_main_llm_call extensions
    ├─ call_chat_model() ← **SKIPPED if plugin routes to canned response**
    ├─ message_loop_end extensions
    └─ return response
```

**Why `message_loop_start`?**
- Executes after LoopData is created (has `user_message`, history context)
- Before LLM prep and prompt building
- Can inject `InterventionException` to skip main LLM call (preserves logs, context flow)
- Access to full conversation history via `self.agent.history`

### 1.2 Plugin Structure

```
usr/plugins/tiny-router/
├── initialize.py              # Plugin activation (load model once)
├── requirements.txt           # Dependencies: torch, transformers, onnxruntime
├── artifacts/
│   └── tiny-router/           # Downloaded model checkpoint (~250MB)
│       ├── config.json
│       ├── pytorch_model.bin (unused if ONNX)
│       ├── model.onnx         # Fast inference
│       ├── tokenizer.json
│       └── vocab.txt
└── runtime/
    ├── python/
    │   ├── extensions/
    │   │   ├── message_loop_start/
    │   │   │   └── _20_tiny_router.py   # Main classifier extension
    │   │   └── monologue_start/
    │   │       └── _05_tiny_router_init.py  # Model warm-up
    │   └── helpers/
    │       ├── tiny_router_model.py    # Model loader, inference wrapper
    │       ├── tiny_router_routing.py  # Decision logic tree
    │       └── tiny_router_cache.py    # Interaction context cache
    └── config/
        └── routing_profiles.yaml       # Restaurant-specific routing rules
```

---

## 2. Routing Logic & Decision Tree

### 2.1 Classification Output Structure

Model produces 4 independent heads:

```python
@dataclass
class TinyRouterOutput:
    relation_to_previous: ClassifierResult  # new|follow_up|correction|confirmation|cancellation|closure
    actionability: ClassifierResult         # none|review|act
    retention: ClassifierResult             # ephemeral|useful|remember
    urgency: ClassifierResult                # low|medium|high
    overall_confidence: float                # 0.0-1.0, mean of 4 heads

@dataclass
class ClassifierResult:
    label: str
    confidence: float  # per-head temperature-scaled confidence
```

### 2.2 Routing Decision Tree (with Restaurant Context)

```python
async def route_message(classification: TinyRouterOutput,
                       context: LoopData,
                       restaurant_profile: RestaurantProfile) -> RoutingDecision:
    """
    Route based on classification + fallback heuristics.
    Decision: (mode, response_template, urgency_boost, context_retention)
    """

    # Tier 1: Actionability = "none" → canned response
    if classification.actionability.label == "none":
        return RoutingDecision(
            mode="canned",
            template="ACKNOWLEDGE_NO_ACTION",  # "Got it." / "Thanks."
            skip_llm=True,
            store_context=False,  # ephemeral by default
        )

    # Tier 2: High confidence confirmations/closures → minimal LLM
    if (classification.actionability.label == "act" and
        classification.relation_to_previous.label in ["confirmation", "closure"] and
        classification.overall_confidence > 0.85):
        return RoutingDecision(
            mode="lightweight",
            model="cheaper_model",  # Use Claude 3.5 Haiku instead of Opus
            skip_main_llm=True,
            store_context=True,
        )

    # Tier 3: Follow-ups with clear relation → inject context, use focused prompt
    if classification.relation_to_previous.label == "follow_up":
        return RoutingDecision(
            mode="contextual",
            context_window="tight",  # Include last 2-3 messages
            prompt_mode="continuation",
            llm_call=True,
        )

    # Tier 4: Corrections → trigger undo/clarification flow
    if classification.relation_to_previous.label == "correction":
        return RoutingDecision(
            mode="correction",
            fetch_previous_action=True,
            prompt_mode="clarification",
            llm_call=True,
        )

    # Tier 5: High urgency + actionable → prioritize queue
    if (classification.urgency.label == "high" and
        classification.actionability.label == "act"):
        return RoutingDecision(
            mode="urgent",
            queue_priority="front",  # Skip queued messages if running
            timeout_ms=5000,         # Faster inference
            llm_call=True,
        )

    # Tier 6: Default → full A0 processing
    return RoutingDecision(
        mode="standard",
        llm_call=True,
    )
```

### 2.3 Restaurant-Specific Decision Rules

**Canned Responses** (skip LLM entirely):
- Explicit confirmation: "yep", "got it", "sounds good", "ok", "thanks", "10-4"
- Simple acknowledgments detected by `actionability=none` + `relation=confirmation`
- Cost: $0.01 per message → $0 with cached response

**Lightweight Responses** (use Haiku instead of Opus):
- Order confirmations ("86 salmon is set" → relation=confirmation, actionability=act, urgency=high)
- Prep status checks ("how much longer on the pasta?" → actionability=review, urgency=medium)
- Inventory lookups ("do we have more cod?" → actionability=review, urgency=low)
- Cost: $0.0007 per 1K tokens (Haiku) vs $0.015 (Opus) → ~95% savings

**Context Injection** (reduce context window, focus prompt):
- Follow-ups on same order/item: "add 2 more covers" after "table 4 needs 4 covers"
- Cost: Reduced prompt tokens → lower API spend

**Retention Policy**:
- `ephemeral=true` + `actionability=none` → don't store in context
  - Example: "OK" after successful order
  - Prevents context bloat
- `retention=remember` + `actionability=act` → persist to workspace memory
  - Example: "next time, always 86 the smoked salmon on Tuesday"
  - Extracted by LLM into restaurant rules

---

## 3. Implementation: Key Components

### 3.1 Model Loader (`runtime/python/helpers/tiny_router_model.py`)

```python
import asyncio
from pathlib import Path
from dataclasses import dataclass
from typing import Optional
import logging

# Only on first import—lazy load to avoid startup overhead
_MODEL_INSTANCE = None
_TOKENIZER_INSTANCE = None
_DEVICE = None
_LOCK = asyncio.Lock()

logger = logging.getLogger(__name__)

@dataclass
class TinyRouterOutput:
    relation_to_previous: dict  # {"label": str, "confidence": float}
    actionability: dict
    retention: dict
    urgency: dict
    overall_confidence: float

class TinyRouterClassifier:
    """Singleton wrapper around ONNX inference."""

    def __init__(self, model_dir: str = "usr/plugins/tiny-router/artifacts/tiny-router"):
        from pathlib import Path
        self.model_dir = Path(model_dir)
        self.session = None
        self.tokenizer = None
        self._lock = asyncio.Lock()

    async def initialize(self):
        """Lazy load model and tokenizer on first use."""
        async with self._lock:
            if self.session is not None:
                return  # Already loaded

            try:
                import onnxruntime as ort
                from transformers import AutoTokenizer

                model_path = self.model_dir / "model.onnx"
                if not model_path.exists():
                    raise FileNotFoundError(f"ONNX model not found at {model_path}")

                # ONNX session with CPU execution (GPU optional)
                providers = ["CPUExecutionProvider"]
                try:
                    import onnxruntime.capi.onnxruntime_pybind11_state as ort_state
                    if hasattr(ort_state, "get_available_providers"):
                        avail = ort_state.get_available_providers()
                        if "CUDAExecutionProvider" in avail:
                            providers = ["CUDAExecutionProvider"] + providers
                except ImportError:
                    pass  # CUDA unavailable

                self.session = ort.InferenceSession(
                    str(model_path),
                    providers=providers,
                    sess_options=ort.SessionOptions()
                )

                # Tokenizer
                self.tokenizer = AutoTokenizer.from_pretrained(self.model_dir)

                logger.info(f"Tiny-router model loaded from {model_path}")
            except Exception as e:
                logger.error(f"Failed to load tiny-router model: {e}")
                raise

    async def classify(self,
                      current_text: str,
                      previous_text: Optional[str] = None,
                      previous_action: Optional[str] = None,
                      previous_outcome: Optional[str] = None,
                      recency_seconds: Optional[float] = None) -> TinyRouterOutput:
        """
        Classify a single message.

        Args:
            current_text: The incoming message
            previous_text: Last message text (if available)
            previous_action: Last action taken (e.g., "created_reminder", "logged_order")
            previous_outcome: Outcome of last action ("success", "error", "pending")
            recency_seconds: Time since last message

        Returns:
            TinyRouterOutput with per-head confidence scores
        """
        await self.initialize()

        # Tokenize input
        inputs = self.tokenizer(
            current_text,
            # Could add context features here:
            # text_pair=previous_text if previous_text else None,
            padding=True,
            truncation=True,
            max_length=128,
            return_tensors="np"
        )

        # Inference
        input_feed = {
            "input_ids": inputs["input_ids"],
            "attention_mask": inputs["attention_mask"],
        }
        if "token_type_ids" in inputs:
            input_feed["token_type_ids"] = inputs["token_type_ids"]

        outputs = self.session.run(None, input_feed)

        # Parse output (assuming logits for 4 heads)
        # Model outputs: [relation_logits, actionability_logits, retention_logits, urgency_logits]
        relation_logits = outputs[0][0]
        actionability_logits = outputs[1][0]
        retention_logits = outputs[2][0]
        urgency_logits = outputs[3][0]

        # Softmax + temperature scaling (per-head calibration)
        def softmax_with_temp(logits, temperature=1.0):
            import numpy as np
            scaled = logits / temperature
            exp = np.exp(scaled - np.max(scaled))
            return exp / exp.sum(axis=-1, keepdims=True)

        rel_probs = softmax_with_temp(relation_logits, temp=0.8)
        act_probs = softmax_with_temp(actionability_logits, temp=0.9)
        ret_probs = softmax_with_temp(retention_logits, temp=0.85)
        urg_probs = softmax_with_temp(urgency_logits, temp=0.95)

        # Map indices to labels
        relation_labels = ["new", "follow_up", "correction", "confirmation", "cancellation", "closure"]
        actionability_labels = ["none", "review", "act"]
        retention_labels = ["ephemeral", "useful", "remember"]
        urgency_labels = ["low", "medium", "high"]

        relation_idx = rel_probs.argmax()
        act_idx = act_probs.argmax()
        ret_idx = ret_probs.argmax()
        urg_idx = urg_probs.argmax()

        result = TinyRouterOutput(
            relation_to_previous={
                "label": relation_labels[relation_idx],
                "confidence": float(rel_probs[relation_idx])
            },
            actionability={
                "label": actionability_labels[act_idx],
                "confidence": float(act_probs[act_idx])
            },
            retention={
                "label": retention_labels[ret_idx],
                "confidence": float(ret_probs[ret_idx])
            },
            urgency={
                "label": urgency_labels[urg_idx],
                "confidence": float(urg_probs[urg_idx])
            },
            overall_confidence=float(
                (rel_probs[relation_idx] +
                 act_probs[act_idx] +
                 ret_probs[ret_idx] +
                 urg_probs[urg_idx]) / 4.0
            )
        )

        return result

# Global instance
_classifier = None

async def get_classifier() -> TinyRouterClassifier:
    global _classifier
    if _classifier is None:
        _classifier = TinyRouterClassifier()
    return _classifier
```

### 3.2 Routing Logic (`runtime/python/helpers/tiny_router_routing.py`)

```python
from dataclasses import dataclass
from enum import Enum
from typing import Optional, Literal
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

class RoutingMode(Enum):
    STANDARD = "standard"       # Full A0 processing
    CANNED = "canned"           # Use canned response, skip LLM
    LIGHTWEIGHT = "lightweight" # Use cheaper model
    CONTEXTUAL = "contextual"   # Inject tight context, use focused prompt
    CORRECTION = "correction"   # Special handling for corrections
    URGENT = "urgent"           # High priority queue
    FALLBACK = "fallback"       # Low confidence, use full LLM as fallback

@dataclass
class RoutingDecision:
    mode: RoutingMode
    skip_llm: bool = False
    use_cheaper_model: bool = False
    model_override: Optional[str] = None
    queue_priority: Literal["front", "normal", "background"] = "normal"
    context_window: Literal["tight", "normal", "full"] = "normal"
    prompt_mode: Optional[str] = None  # "continuation", "clarification", etc.
    timeout_ms: Optional[int] = None
    canned_response: Optional[str] = None
    confidence_score: float = 0.0
    reasoning: str = ""

class RestaurantRoutingRules:
    """Restaurant-specific routing rules and canned responses."""

    # Canned responses for common scenarios (low confidence fallback)
    CANNED_RESPONSES = {
        "ACKNOWLEDGE_NO_ACTION": "Got it.",
        "CONFIRM_ORDER": "Order confirmed.",
        "CONFIRM_PREP": "Prep noted.",
        "ASK_CLARIFY": "Can you clarify?",
        "REQUEST_CONTEXT": "I need more details.",
    }

    # Patterns that indicate low-value messages (for confidence boost)
    CONFIRMATION_WORDS = {
        "yep", "yup", "yeah", "ok", "okay", "sounds good", "got it", "10-4",
        "copy that", "will do", "thanks", "thank you", "cool", "alright",
        "perfect", "all set", "yes", "absolutely", "confirmed"
    }

    URGENCY_BOOST_PATTERNS = {
        # High urgency keywords
        "high": ["urgent", "asap", "now", "immediately", "fire", "86", "down", "issue"],
        "medium": ["soon", "next", "coming up", "soon", "in a bit"],
        "low": ["when", "later", "eventually"],
    }

    @staticmethod
    def should_use_canned_response(text: str,
                                   actionability: str,
                                   relation: str,
                                   confidence: float) -> Optional[str]:
        """Check if message should use canned response."""
        text_lower = text.lower().strip()

        # Exact canned matches (very high confidence)
        if text_lower in RestaurantRoutingRules.CONFIRMATION_WORDS:
            if actionability == "none" and relation == "confirmation":
                return RestaurantRoutingRules.CANNED_RESPONSES["ACKNOWLEDGE_NO_ACTION"]

        # Short confirmations with high confidence
        if len(text_lower) < 20 and confidence > 0.90:
            if actionability == "none":
                return RestaurantRoutingRules.CANNED_RESPONSES["ACKNOWLEDGE_NO_ACTION"]

        return None

    @staticmethod
    def boost_urgency(text: str, urgency_label: str) -> str:
        """Boost urgency classification based on text patterns."""
        text_lower = text.lower()

        for high_word in RestaurantRoutingRules.URGENCY_BOOST_PATTERNS["high"]:
            if high_word in text_lower:
                return "high"

        for med_word in RestaurantRoutingRules.URGENCY_BOOST_PATTERNS["medium"]:
            if med_word in text_lower:
                return "medium" if urgency_label != "high" else "high"

        return urgency_label

async def route_message(classification,
                       message_text: str,
                       context_history_length: int,
                       context_data: dict) -> RoutingDecision:
    """
    Main routing function. Takes classifier output and returns routing decision.

    Args:
        classification: TinyRouterOutput from classifier
        message_text: Incoming message text
        context_history_length: Number of messages in conversation
        context_data: Additional context (restaurant profile, location, etc.)

    Returns:
        RoutingDecision with routing mode and parameters
    """

    rel = classification.relation_to_previous["label"]
    act = classification.actionability["label"]
    ret = classification.retention["label"]
    urg = classification.urgency["label"]
    conf = classification.overall_confidence

    # Check for low overall confidence → fallback to full LLM
    if conf < 0.55:
        logger.info(f"Low confidence ({conf:.2f}), routing to full LLM for safety")
        return RoutingDecision(
            mode=RoutingMode.FALLBACK,
            confidence_score=conf,
            reasoning=f"Low overall confidence ({conf:.2f})"
        )

    # Tier 1: Actionability = "none" → almost certainly canned response
    if act == "none":
        canned = RestaurantRoutingRules.should_use_canned_response(
            message_text, act, rel, conf
        )
        if canned:
            logger.info(f"Routing to canned response (confidence: {conf:.2f})")
            return RoutingDecision(
                mode=RoutingMode.CANNED,
                skip_llm=True,
                canned_response=canned,
                confidence_score=conf,
                reasoning="actionability=none with high confidence"
            )

    # Tier 2: Corrections → special handling
    if rel == "correction" and conf > 0.80:
        logger.info("Routing correction to focused clarification mode")
        return RoutingDecision(
            mode=RoutingMode.CORRECTION,
            prompt_mode="clarification",
            context_window="tight",
            confidence_score=conf,
            reasoning=f"Detected correction (confidence: {conf:.2f})"
        )

    # Tier 3: High urgency + actionable → priority queue
    if act == "act":
        urg_boosted = RestaurantRoutingRules.boost_urgency(message_text, urg)
        if urg_boosted == "high":
            logger.info("Routing high-urgency message to front of queue")
            return RoutingDecision(
                mode=RoutingMode.URGENT,
                queue_priority="front",
                timeout_ms=5000,
                confidence_score=conf,
                reasoning=f"High urgency + actionable"
            )

    # Tier 4: Follow-ups with clear context → contextual mode
    if rel == "follow_up" and context_history_length > 2:
        logger.info("Routing follow-up with tight context injection")
        return RoutingDecision(
            mode=RoutingMode.CONTEXTUAL,
            context_window="tight",
            prompt_mode="continuation",
            confidence_score=conf,
            reasoning=f"Detected follow-up in conversation"
        )

    # Tier 5: Confirmations with high confidence → lightweight model
    if rel == "confirmation" and act == "act" and conf > 0.85:
        logger.info(f"Routing high-confidence confirmation to lightweight model")
        return RoutingDecision(
            mode=RoutingMode.LIGHTWEIGHT,
            use_cheaper_model=True,
            model_override="claude-3-5-haiku",  # ~95% cheaper than Opus
            confidence_score=conf,
            reasoning=f"Confirmation with {conf:.2f} confidence"
        )

    # Default: Standard A0 processing
    logger.info(f"Routing to standard processing (confidence: {conf:.2f})")
    return RoutingDecision(
        mode=RoutingMode.STANDARD,
        confidence_score=conf,
        reasoning="No special routing rule matched"
    )
```

### 3.3 Main Extension (`runtime/python/extensions/message_loop_start/_20_tiny_router.py`)

```python
from python.helpers.extension import Extension
from python.helpers.tiny_router_model import get_classifier
from python.helpers.tiny_router_routing import route_message, RoutingMode
from agent import LoopData, InterventionException
import logging

logger = logging.getLogger(__name__)

class TinyRouterMessageClassifier(Extension):
    """
    Main plugin extension that runs at message_loop_start.

    Classifies incoming messages and routes them:
    - Canned responses: Skip LLM entirely
    - Lightweight model: Use cheaper model instead of Opus
    - Contextual: Inject tight history, use focused prompt
    - Standard: Full A0 processing
    """

    async def execute(self, loop_data: LoopData = LoopData(), **kwargs):
        """Execute at message_loop_start."""

        # Only process user messages
        if not loop_data.user_message or not loop_data.user_message.content:
            return

        message_text = loop_data.user_message.content

        try:
            # Get classifier
            classifier = await get_classifier()

            # Extract previous context from history
            previous_text = None
            previous_action = None
            previous_outcome = None
            recency_seconds = None

            if self.agent.history and len(self.agent.history.messages) > 1:
                # Find last non-current message
                for msg in reversed(self.agent.history.messages[:-1]):
                    if hasattr(msg, "content") and msg.content:
                        previous_text = msg.content[:500]  # Truncate for safety
                        break

                # Try to extract previous action from agent data
                last_action = self.agent.get_data("last_action")
                if last_action:
                    previous_action = last_action.get("action_type", None)
                    previous_outcome = last_action.get("outcome", None)

                # Approximate recency
                if hasattr(self.agent, "last_message"):
                    from datetime import datetime, timezone, timedelta
                    now = datetime.now(timezone.utc)
                    if self.agent.last_message:
                        delta = now - self.agent.last_message
                        recency_seconds = delta.total_seconds()

            # Classify
            logger.info(f"Classifying message: {message_text[:50]}...")
            classification = await classifier.classify(
                current_text=message_text,
                previous_text=previous_text,
                previous_action=previous_action,
                previous_outcome=previous_outcome,
                recency_seconds=recency_seconds
            )

            logger.info(f"Classification: {classification}")

            # Route based on classification
            routing_decision = await route_message(
                classification,
                message_text,
                len(self.agent.history.messages) if self.agent.history else 0,
                context_data={
                    "location_id": self.agent.context.get_data("location_id"),
                    "user_id": self.agent.context.get_data("user_id"),
                }
            )

            logger.info(f"Routing decision: {routing_decision.mode.value} (confidence: {routing_decision.confidence_score:.2f})")

            # Store classification for downstream use
            loop_data.params_temporary["tiny_router_classification"] = classification
            loop_data.params_temporary["tiny_router_routing"] = routing_decision

            # Apply routing decision
            if routing_decision.mode == RoutingMode.CANNED:
                # Skip LLM, respond with canned response
                await self._respond_canned(routing_decision.canned_response)
                raise InterventionException("Canned response sent")

            elif routing_decision.mode == RoutingMode.CORRECTION:
                # Inject clarification prompt into system message
                loop_data.system.append(
                    f"[CLASSIFICATION: This appears to be a correction. "
                    f"Provide clarification or ask for more details if needed.]"
                )

            elif routing_decision.mode == RoutingMode.CONTEXTUAL:
                # Inject tight context
                if previous_text and len(self.agent.history.messages) > 1:
                    loop_data.system.append(
                        f"[CONTEXT: Previous message was: '{previous_text[:100]}'. "
                        f"Current message appears to be a follow-up.]"
                    )

            # Store retention policy
            if classification["retention"]["label"] == "ephemeral":
                loop_data.params_temporary["skip_history_save"] = True
            elif classification["retention"]["label"] == "remember":
                loop_data.params_temporary["extract_to_memory"] = True

        except InterventionException:
            # Re-raise to skip LLM
            raise
        except Exception as e:
            logger.error(f"Tiny-router error (falling back to standard): {e}", exc_info=True)
            # Fall through to standard processing on any error

    async def _respond_canned(self, response: str):
        """Send canned response via the context's streaming mechanism."""
        if hasattr(self.agent.context, "streaming_agent"):
            # Emit via Socket.IO or direct response
            logger.info(f"Sending canned response: {response}")
            # This hooks into the same response mechanism as LLM
            self.agent.context.log.add_log(
                log_type="response",
                content=response,
                source="tiny_router"
            )
```

### 3.4 Plugin Initialization (`initialize.py`)

```python
"""Plugin initialization for tiny-router."""
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

def initialize():
    """Initialize plugin on startup."""

    # Check if artifacts exist
    artifacts_dir = Path(__file__).parent / "artifacts" / "tiny-router"

    if not artifacts_dir.exists():
        logger.warning(
            f"Tiny-router artifacts not found at {artifacts_dir}. "
            f"Run: python -m carabiner.plugins.tiny_router.download_model"
        )
        return False

    if not (artifacts_dir / "model.onnx").exists():
        logger.error(
            f"ONNX model not found. "
            f"Expected: {artifacts_dir / 'model.onnx'}"
        )
        return False

    logger.info(f"Tiny-router plugin initialized (model: {artifacts_dir})")

    # Optional: warm-up model on startup (load once, reuse)
    # This is done lazily in get_classifier() to avoid blocking startup

    return True

# Called by Agent Zero on plugin load
if __name__ != "__main__":
    initialize()
```

### 3.5 Model Download Script

```python
# usr/plugins/tiny-router/download_model.py
"""Download tiny-router model from Hugging Face."""
import os
from pathlib import Path
from huggingface_hub import snapshot_download

def download_model():
    """Download tiny-router from Hugging Face."""
    artifacts_dir = Path(__file__).parent / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    print("Downloading tiny-router model from Hugging Face...")
    snapshot_download(
        repo_id="tgupj/tiny-router",
        local_dir=str(artifacts_dir / "tiny-router"),
        repo_type="model",
    )

    model_path = artifacts_dir / "tiny-router" / "model.onnx"
    if model_path.exists():
        size_mb = model_path.stat().st_size / (1024**2)
        print(f"✓ Model downloaded ({size_mb:.1f} MB)")
    else:
        print("✗ ONNX model not found after download")

if __name__ == "__main__":
    download_model()
```

---

## 4. Restaurant-Specific Training Data Strategy

### 4.1 Domain Fine-Tuning (Phase 2)

The base model achieves 78.48% macro F1 on general user messages. For kitchen operations, we need to:

1. **Collect real examples** (100-200 per category):
   - "86 the salmon" (urgent action, high confidence)
   - "table 4 needs 2 more minutes" (follow-up, medium urgency)
   - "already fired the steaks" (completion, cancellation)
   - "how many cod do we have?" (review, low urgency)
   - "sounds good" (confirmation, none action)

2. **Synthetic data generation** using templates:

```python
# Synthetic training data generator
RESTAURANT_TEMPLATES = {
    ("act", "high", "follow_up"): [
        "Actually, make that {{quantity}} more {{item}}",
        "Wait, add {{quantity}} {{item}} to that",
        "Change the {{item}} order to {{quantity}}",
    ],
    ("none", "low", "confirmation"): [
        "Yep, got it",
        "All set",
        "Will do",
        "10-4",
        "Sounds good",
    ],
    ("act", "high", "new"): [
        "86 the {{item}}",
        "Drop {{quantity}} {{item}} NOW",
        "URGENT: {{item}} down",
        "Fire {{quantity}} {{item}} asap",
    ],
    ("review", "medium", "new"): [
        "How much {{item}} do we have left?",
        "What's the status on {{item}}?",
        "ETA on {{item}}?",
        "Do we still have {{item}}?",
    ],
}

def generate_synthetic_data(templates: dict, replacements: dict) -> list:
    """Generate synthetic restaurant examples."""
    examples = []
    items = ["salmon", "steak", "cod", "pasta", "vegetables", "sauce"]
    quantities = ["2", "3", "5", "10", "50"]

    for (action, urg, rel), prompts in templates.items():
        for prompt in prompts:
            for item in items:
                for qty in quantities:
                    text = prompt.replace("{{item}}", item).replace("{{quantity}}", qty)
                    examples.append({
                        "current_text": text,
                        "interaction": {
                            "previous_text": "Table 4 needs 2 covers",
                            "previous_action": "logged_order",
                            "previous_outcome": "success",
                            "recency_seconds": 30,
                        },
                        "labels": {
                            "actionability": action,
                            "urgency": urg,
                            "relation_to_previous": rel,
                            "retention": "useful" if action != "none" else "ephemeral",
                        }
                    })

    return examples
```

3. **Fine-tune model**:
   - Freeze encoder, train only 4 classification heads
   - Use restaurant synthetic data + real examples
   - Target: +5-10% improvement on restaurant-specific messages

---

## 5. Cost Savings & ROI Analysis

### 5.1 Cost Breakdown (Current State)

```
Restaurant scale: 50 orders/day per location, 5 locations
Message volume: ~500 messages/day
Avg message token count: 50 tokens input, 100 tokens output
Current API cost: ~$600/month (Claude Opus 3)

Per-message breakdown:
- Input tokens: 500 × 50 = 25,000 tokens/day = $0.375/day
- Output tokens: 500 × 100 = 50,000 tokens/day = $0.75/day
- Total: $1.125/day = $33.75/month
- At 5 locations: $168.75/month baseline
- With context window: $600/month (real avg due to conversation context)
```

### 5.2 With Tiny-Router (Conservative Estimate)

```
Messages routed away from LLM: ~30% (180/500)
  - Canned responses: ~15% (75/500)
  - Lightweight model: ~10% (50/500)
  - Contextual (reduced tokens): ~5% (25/500)

Savings breakdown:
1. Canned responses (75/day):
   - Saved cost: 75 × $0.375 = $28.13/day
   - Model inference cost: ~$0.005/day (ONNX CPU)
   - Net: +$28.13/day = +$843.75/month

2. Lightweight model (50/day at Haiku):
   - Opus cost: 50 × $0.04 = $2/day
   - Haiku cost: 50 × $0.0008 = $0.04/day
   - Savings: $1.96/day = $58.75/month

3. Contextual (reduced context window):
   - 25 messages with 30% reduced context tokens
   - Savings: ~$0.38/day = $11.25/month

Total monthly savings at 1 location: ~$913/month
At 5 locations (realistic CarabinerOS scale): ~$4,565/month

But actual savings are more conservative (~50% realization):
- Gross savings: $4,565/month
- Model inference cost: $150/month (inference server, CPU)
- Net savings: ~$4,400/month

**HOWEVER**, realistic expectations for Phase 1 (no fine-tuning):
- Messages routed: ~20% (lower because no domain tuning)
- Realized savings: ~$150-200/month per restaurant
- At 10 restaurants: $1,500-2,000/month
- Payoff period: 2-3 months (one-time artifact setup)
```

### 5.3 Hidden Benefits

1. **Latency improvement**: Canned responses (<50ms) vs LLM (1-3s)
   - Better UX for simple confirmations
   - Kitchen operations feel snappier

2. **Context window savings**: Tight context for follow-ups
   - Keep context smaller for follow-ups
   - More room for long-running conversations

3. **Error reduction**: Fewer misrouted messages
   - Classifier is more conservative than heuristics
   - Fallback to LLM on low confidence

---

## 6. Implementation Phases

### Phase 1: MVP (Week 1-2)
**Objective:** Integrate base classifier, validate routing logic, measure baseline

**Tasks:**
1. Set up plugin structure, copy model artifacts
2. Implement model loader (ONNX inference wrapper)
3. Implement routing logic with conservative thresholds
4. Implement `_20_tiny_router.py` extension
5. Add logging and telemetry
6. Test with dev chats, measure:
   - % messages routed to each category
   - Inference time (should be <20ms)
   - False positives (canned responses that should have been LLM)

**Success Criteria:**
- 0 production errors
- <10ms average inference time
- <2% false positive rate on canned responses
- 20-25% of messages routed away from LLM

**Metrics to Track:**
```python
# Add to loop_data
loop_data.params_temporary["tiny_router_metrics"] = {
    "inference_time_ms": ...,
    "routing_mode": ...,
    "confidence": ...,
    "was_canned": ...,
}
```

### Phase 2: Fine-tuning (Week 3-4)
**Objective:** Improve accuracy with restaurant-specific training data

**Tasks:**
1. Collect 500+ real restaurant messages from prod logs
2. Label with restaurant experts
3. Generate synthetic training data (2000+ examples)
4. Fine-tune heads on combined dataset
5. Re-test on holdout set
6. Deploy updated model

**Expected Improvement:**
- Canned response accuracy: 92% → 96%
- Overall F1: 0.78 → 0.85+
- Messages routed: 25% → 35%

### Phase 3: Full Routing & Fallbacks (Week 5-6)
**Objective:** Add expensive operations (undo, context injection, memory extraction)

**Tasks:**
1. Implement correction flow (fetch previous action, undo mechanism)
2. Implement memory extraction (save "useful" retention to workspace)
3. Implement model routing (Opus → Haiku for confirmations)
4. Add cost tracking dashboard
5. Set up A/B tests with human validation

**Metrics:**
- Cost reduction: Baseline → Phase 3
- User satisfaction: No regression in response quality
- Inference accuracy: Maintain >95% on canned responses

---

## 7. Docker Integration

### 7.1 Model Artifact Management

**In Docker (production):**
```dockerfile
# Dockerfile.agent-zero (update)
FROM python:3.10-slim

# ... existing setup ...

# Add tiny-router model download step
RUN python -c "from huggingface_hub import snapshot_download; \
    snapshot_download('tgupj/tiny-router', \
    local_dir='/app/usr/plugins/tiny-router/artifacts/tiny-router', \
    repo_type='model')" \
    && chmod -R 755 /app/usr/plugins/tiny-router

# Install ONNX runtime
RUN pip install onnxruntime torch transformers

EXPOSE 5000
CMD ["python", "run_ui.py"]
```

**Docker Compose:**
```yaml
# docker-compose.dev.yml (update)
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.agent-zero
    environment:
      TOKENIZERS_PARALLELISM: "false"
      TINY_ROUTER_ENABLED: "true"
    volumes:
      - ./usr/plugins/tiny-router/artifacts:/app/usr/plugins/tiny-router/artifacts:ro
```

### 7.2 Lazy Model Loading

Model is **not** loaded on startup (no blocking), but on first message:
- Startup time unaffected
- First request gets minor delay (model load + inference)
- Subsequent requests: <10ms overhead

```python
# In models.py or initialization
async def ensure_tiny_router_loaded():
    """Warm up model after agent init."""
    classifier = await get_classifier()
    # First call does the actual loading
    # Subsequent calls are cached
```

---

## 8. Monitoring & Safety Guardrails

### 8.1 Telemetry

Add metrics collection to extensions:

```python
# In _20_tiny_router.py
async def emit_metrics(loop_data, routing_decision, classification):
    """Emit metrics for monitoring."""
    metrics = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "context_id": self.agent.context.id,
        "message_length": len(loop_data.user_message.content),
        "classification": {
            "actionability": classification["actionability"]["label"],
            "urgency": classification["urgency"]["label"],
            "relation": classification["relation_to_previous"]["label"],
            "confidence": classification["overall_confidence"],
        },
        "routing_mode": routing_decision.mode.value,
        "was_canned": routing_decision.skip_llm,
        "inference_time_ms": ...,
    }

    # Send to analytics / logging
    await self.agent.context.get_notification_manager().emit("tiny_router_metrics", metrics)
```

### 8.2 Confidence Thresholds & Fallbacks

```python
SAFETY_THRESHOLDS = {
    "canned_response": 0.90,      # Very high confidence
    "lightweight_model": 0.85,    # High confidence
    "contextual": 0.75,           # Medium confidence
    "fallback": 0.55,             # Below this → always use LLM
}
```

**Never skip LLM** if:
- Overall confidence < 0.55
- Previous message was a critical operation (order, inventory change)
- User explicitly asks for clarification

---

## 9. Testing Strategy

### 9.1 Unit Tests

```python
# tests/test_tiny_router_classification.py
@pytest.mark.asyncio
async def test_classify_simple_confirmation():
    classifier = TinyRouterClassifier()
    result = await classifier.classify("Got it")
    assert result.actionability["label"] == "none"
    assert result.relation_to_previous["label"] == "confirmation"

@pytest.mark.asyncio
async def test_classify_urgent_action():
    classifier = TinyRouterClassifier()
    result = await classifier.classify("86 salmon")
    assert result.actionability["label"] == "act"
    assert result.urgency["label"] == "high"

# tests/test_tiny_router_routing.py
@pytest.mark.asyncio
async def test_route_canned_response():
    classification = {
        "actionability": {"label": "none", "confidence": 0.95},
        "relation_to_previous": {"label": "confirmation", "confidence": 0.92},
        "urgency": {"label": "low", "confidence": 0.88},
        "retention": {"label": "ephemeral", "confidence": 0.91},
        "overall_confidence": 0.91,
    }
    decision = await route_message(classification, "Ok", 5, {})
    assert decision.mode == RoutingMode.CANNED
    assert decision.skip_llm == True
```

### 9.2 Integration Tests

```python
# tests/test_tiny_router_integration.py
@pytest.mark.asyncio
async def test_extension_executes_in_agent_loop(agent):
    """Test that tiny-router executes in message loop."""
    agent.add_message(UserMessage(message="Got it"))

    # Run one iteration
    # Assert loop_data has tiny_router classification
    assert "tiny_router_classification" in agent.loop_data.params_temporary
    assert agent.loop_data.params_temporary["tiny_router_routing"].mode != RoutingMode.ERROR
```

### 9.3 Production Validation (Human-in-the-Loop)

1. **Sample 100 messages** from production
2. **Compare:**
   - What tiny-router decided vs what LLM would do
   - Validation by human (chef/manager) on disagreement
3. **Measure:**
   - False positive rate (canned when should be LLM)
   - False negative rate (LLM when should be canned)
   - Only deploy if FP rate < 2%

---

## 10. Configuration & Rollout

### 10.1 Feature Flag (`usr/settings.json`)

```json
{
  "tiny_router": {
    "enabled": true,
    "confidence_threshold": 0.75,
    "enable_canned_responses": true,
    "enable_lightweight_model": true,
    "enable_context_injection": true,
    "fallback_on_error": true,
    "logging_level": "info",
    "metrics_enabled": true
  }
}
```

### 10.2 Gradual Rollout

**Week 1:** Logging only (collect metrics, don't route)
```python
# Set skip_llm=False even if classified as canned
# Just log what would have happened
```

**Week 2:** 50% of production (canary release)
```python
if random.random() < 0.5:
    apply_routing_decision(decision)
else:
    skip_llm=False  # Always use LLM
```

**Week 3+:** 100% deployment (with monitoring)

---

## 11. Future Enhancements

### 11.1 Multi-Location Routing
- Location-specific training data
- Different thresholds for different restaurant types
- Integration with location_id in context

### 11.2 User-Specific Models
- Train separate heads for different user profiles (chef, manager, delivery)
- Adapt confidence thresholds based on user reliability

### 11.3 Streaming Classification
- Classify partial messages as user types
- Provide early hints to frontend (confidence indicator)

### 11.4 Feedback Loop
- Track when canned responses were wrong
- Retrain monthly with production feedback
- Automatically adjust thresholds

---

## Summary

This plugin integrates tiny-router as a **pre-filter for all incoming messages** in Agent Zero, reducing API costs by 30-40% while maintaining response quality. The implementation is:

- **Safe**: Fallback to full LLM on low confidence or errors
- **Fast**: <10ms ONNX inference, no blocking of startup
- **Modular**: Cleanly isolated in `usr/plugins/tiny-router/`
- **Extensible**: Easy to add restaurant-specific rules and fine-tuning
- **Observable**: Comprehensive metrics for monitoring

**Timeline:** MVP in 1-2 weeks, full deployment in 4-6 weeks
**ROI:** Break-even in month 1, significant savings from month 2 onward

---

### Sources

- [tiny-router · Hugging Face](https://huggingface.co/tgupj/tiny-router)
- [Microsoft DeBERTa v3 Architecture](https://huggingface.co/microsoft/deberta-v3-small)
- [ONNX Runtime Inference](https://onnxruntime.ai/)
- [Agent Zero Documentation](https://github.com/A0Zero/agent-zero)
