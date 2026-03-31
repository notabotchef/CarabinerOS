# Implementation Guide: Memory Compression for CarabinerOS

**For**: Cook agent implementing Phase 1
**Complexity**: Medium (token counting + Pydantic + A0 extensions)
**Time**: 2–3 days
**Files to Create**: 3
**Files to Modify**: 1
**Tests**: 8–10

---

## Architecture Overview

```
Agent Zero Loop:
  1. Agent reasons, calls tools, generates messages
  2. After LLM response: check token count
  3. If tokens > threshold (50K): trigger compression
     a. Identify old messages (exclude last 5)
     b. Call LLM: "Summarize these messages into RestaurantSummarySchema"
     c. Mark old messages as "compressed" in memory
     d. Inject summary as first message
  4. Next LLM call sees: [summary] + [recent 5 messages]
     (old messages excluded from context)
```

**Token Savings**: Old ~5000 tokens → Summary ~300 tokens (94% reduction per message)

---

## Step 1: Create RestaurantSummarySchema

**File**: `carabiner/memory/compression_schema.py`

```python
"""Pydantic models for memory compression in restaurant operations."""

from pydantic import BaseModel, Field


class RestaurantSummarySchema(BaseModel):
    """
    Structured summary for restaurant operations context.

    Used when memory token count exceeds threshold.
    Max total ~1400 chars (roughly 350 tokens when compressed).
    """

    daily_context: str = Field(
        max_length=300,
        description=(
            "Today's operational context that changes frequently.\n"
            "Include: expected covers/volume, special events, staff notes, "
            "supplier alerts, weather impact on delivery.\n"
            "Example: '120 expected covers, private event 6pm (30 ppl), "
            "Sysco delayed to 2pm, one line cook called out'"
        ),
    )

    standing_parameters: str = Field(
        max_length=350,
        description=(
            "Stable operational parameters that rarely change.\n"
            "Include: par levels by item, vendor lead times, menu specifications, "
            "cost targets, equipment status, regulatory constraints.\n"
            "Example: 'Par: beef 50lb, chicken 80lb, fish 40lb. Sysco lead: 2 days. "
            "Food cost target: 32%. Walk-in at 38F (target 35–38).'"
        ),
    )

    recent_decisions: str = Field(
        max_length=300,
        description=(
            "Recent decisions, orders, and changes made in this session.\n"
            "Include: purchase orders placed (vendor, qty, cost), menu adjustments, "
            "supplier switches, pricing changes, issues resolved.\n"
            "Example: 'Ordered 30lb prime rib from Sysco ($8.50/lb), "
            "removed beef wellington from menu, switched to Marbled Meats for ribeye '"
        ),
    )

    pending_actions: str = Field(
        max_length=200,
        description=(
            "Immediate next steps and outstanding items.\n"
            "Include: vendor follow-ups needed, staff communications pending, "
            "scheduled deliveries, waiting for approvals.\n"
            "Example: 'Await Sysco delivery 2pm, confirm private event menu by 4pm, "
            "invoice from Marbled Meats to process'"
        ),
    )

    constraints_and_learnings: str = Field(
        max_length=300,
        description=(
            "Operational constraints, lessons learned, and quality issues.\n"
            "Include: supplier minimums/limits, seasonal availability gaps, "
            "cost overruns vs. targets, quality issues, regulatory notes.\n"
            "Example: 'Sysco min order 2 cases, Marbled Meats has 10-day lead, "
            "halibut unavailable until April, ribeye variance 2oz/piece, "
            "local health code requires temp logs'"
        ),
    )


class CompressionResult(BaseModel):
    """Result of a compression operation."""

    success: bool
    summary_text: str  # Formatted for injection into messages
    tokens_before: int
    tokens_after: int
    messages_compressed: int
    messages_kept: int
```

---

## Step 2: Create CompressionManager

**File**: `carabiner/memory/compression_manager.py`

```python
"""Manages automatic memory compression for A0 conversations."""

import json
import logging
from datetime import datetime
from typing import Optional, Any

from pydantic import ValidationError

from carabiner.memory.compression_schema import (
    RestaurantSummarySchema,
    CompressionResult,
)

logger = logging.getLogger(__name__)


class CompressionManager:
    """
    Manages compression of conversation history for long-running restaurant
    operations. Triggered automatically when token count exceeds threshold.
    """

    def __init__(
        self,
        token_counter,  # e.g., CharTokenCounter from AgentScope
        trigger_threshold: int = 50000,
        keep_recent: int = 5,
        min_compression_ratio: float = 0.3,  # Only compress if saves >30% tokens
    ):
        """
        Initialize compression manager.

        Args:
            token_counter: Token counting function (msg_text -> int)
            trigger_threshold: Token count to trigger compression (default 50K)
            keep_recent: Number of recent messages to always keep (default 5)
            min_compression_ratio: Minimum savings % to proceed (default 30%)
        """
        self.token_counter = token_counter
        self.trigger_threshold = trigger_threshold
        self.keep_recent = keep_recent
        self.min_compression_ratio = min_compression_ratio

        self.compressed_summary = ""
        self.last_compression_time = None
        self.compression_count = 0

    async def should_compress(self, messages: list[dict]) -> bool:
        """
        Check if compression should be triggered.

        Args:
            messages: List of message dicts with 'content' field

        Returns:
            True if token count exceeds threshold and we have enough messages to compress
        """
        if len(messages) <= self.keep_recent:
            return False

        token_count = sum(
            self.token_counter.count_tokens(msg.get("content", ""))
            for msg in messages
        )

        logger.debug(
            f"Token count check: {token_count} vs threshold {self.trigger_threshold}"
        )
        return token_count > self.trigger_threshold

    async def compress_messages(
        self,
        old_messages: list[dict],
        model,  # LLM model instance (e.g., ChatModel from A0)
    ) -> Optional[str]:
        """
        Compress old messages into RestaurantSummarySchema format.

        Args:
            old_messages: Messages to compress
            model: LLM model for generating summary

        Returns:
            Formatted summary string, or None if compression failed
        """
        if not old_messages:
            return None

        # Format messages for LLM
        conversation_text = self._format_messages(old_messages)

        # Build compression prompt
        prompt = self._build_compression_prompt(conversation_text)

        try:
            # Call LLM to generate summary
            response = await model(prompt)

            # Parse response as JSON (LLM should return valid JSON)
            response_text = response.get("content", response) if isinstance(response, dict) else response
            summary_dict = json.loads(response_text)

            # Validate against schema
            schema = RestaurantSummarySchema(**summary_dict)

            # Format for injection
            formatted = self._format_summary(schema)

            logger.info(f"Compression successful: {len(old_messages)} messages → summary")
            return formatted

        except (json.JSONDecodeError, ValidationError) as e:
            logger.warning(f"Compression failed to generate valid schema: {e}")
            return None
        except Exception as e:
            logger.error(f"Compression error: {e}", exc_info=True)
            return None

    async def apply_compression(
        self,
        messages: list[dict],
        model,
    ) -> tuple[list[dict], Optional[CompressionResult]]:
        """
        Apply compression if threshold exceeded.

        Args:
            messages: Full conversation message list
            model: LLM model for generating summary

        Returns:
            (modified_messages, compression_result)
            - modified_messages: with old messages replaced by summary
            - compression_result: stats about compression, or None if not triggered
        """

        # Check if we should compress
        if not await self.should_compress(messages):
            return messages, None

        # Measure before compression
        tokens_before = sum(
            self.token_counter.count_tokens(msg.get("content", ""))
            for msg in messages
        )

        # Split into old and recent
        num_to_compress = len(messages) - self.keep_recent
        old_messages = messages[:num_to_compress]
        recent_messages = messages[num_to_compress:]

        logger.info(
            f"Compressing {len(old_messages)} old messages, "
            f"keeping {len(recent_messages)} recent"
        )

        # Generate summary
        summary_text = await self.compress_messages(old_messages, model)
        if summary_text is None:
            logger.warning("Compression failed, returning original messages")
            return messages, None

        # Build new message list: [summary] + [recent]
        summary_message = {
            "role": "user",
            "content": summary_text,
            "mark": "compressed_summary",
            "compressed_at": datetime.utcnow().isoformat(),
        }

        new_messages = [summary_message] + recent_messages

        # Measure after compression
        tokens_after = sum(
            self.token_counter.count_tokens(msg.get("content", ""))
            for msg in new_messages
        )

        # Check if compression worth it
        compression_ratio = tokens_after / tokens_before if tokens_before > 0 else 1.0
        if compression_ratio > (1.0 - self.min_compression_ratio):
            logger.warning(
                f"Compression ratio {compression_ratio:.1%} below threshold "
                f"{1.0 - self.min_compression_ratio:.1%}, keeping original"
            )
            return messages, None

        self.compressed_summary = summary_text
        self.last_compression_time = datetime.utcnow()
        self.compression_count += 1

        result = CompressionResult(
            success=True,
            summary_text=summary_text,
            tokens_before=tokens_before,
            tokens_after=tokens_after,
            messages_compressed=len(old_messages),
            messages_kept=len(recent_messages),
        )

        logger.info(
            f"Compression result: {tokens_before} → {tokens_after} tokens "
            f"({compression_ratio:.1%}), saved {tokens_before - tokens_after} tokens"
        )

        return new_messages, result

    def _format_messages(self, messages: list[dict]) -> str:
        """Format messages for LLM prompt."""
        formatted = []
        for msg in messages:
            role = msg.get("role", "unknown").upper()
            content = msg.get("content", "")
            # Truncate very long messages
            if len(content) > 500:
                content = content[:500] + "...[truncated]"
            formatted.append(f"{role}: {content}")
        return "\n\n".join(formatted)

    def _build_compression_prompt(self, conversation_text: str) -> str:
        """Build prompt for compression."""
        return f"""You are a restaurant operations assistant.
Review the conversation below and summarize the key facts into structured format.

Focus on:
1. Daily context: covers, events, staffing, supplier updates
2. Standing parameters: par levels, vendor info, menu specs, cost targets
3. Recent decisions: orders placed, menu changes, price adjustments
4. Pending actions: follow-ups, deliveries, approvals
5. Constraints & learnings: supplier limits, quality issues, seasonal gaps

Respond ONLY with a valid JSON object matching this schema:
{{
  "daily_context": "...",
  "standing_parameters": "...",
  "recent_decisions": "...",
  "pending_actions": "...",
  "constraints_and_learnings": "..."
}}

Each field max 300 chars (except standing_parameters max 350).

Conversation:
{conversation_text}"""

    def _format_summary(self, schema: RestaurantSummarySchema) -> str:
        """Format schema into injection-ready summary."""
        return f"""<system-summary>
Restaurant Operations Summary
Generated: {datetime.utcnow().isoformat()}

## Daily Context
{schema.daily_context}

## Standing Parameters
{schema.standing_parameters}

## Recent Decisions & Actions
{schema.recent_decisions}

## Pending Actions
{schema.pending_actions}

## Constraints & Learnings
{schema.constraints_and_learnings}
</system-summary>"""
```

---

## Step 3: Create A0 Extension Hook

**File**: `python/extensions/30_memory_compression.py`

```python
"""
Extension: Memory compression for long-running conversations.

Triggers automatically when token count exceeds threshold.
Injects structured summary at start of message list, removes old messages.
"""

import logging
from typing import Any

from carabiner.memory.compression_manager import CompressionManager

logger = logging.getLogger(__name__)

# Global compression manager (initialized once)
_compression_manager: CompressionManager | None = None


def initialize_compression_manager(agent_context, config) -> CompressionManager:
    """Initialize compression manager with config from agent."""
    global _compression_manager

    if _compression_manager is not None:
        return _compression_manager

    # Get token counter from config (or use default)
    trigger_threshold = config.get("compression_trigger_tokens", 50000)
    keep_recent = config.get("compression_keep_recent", 5)

    logger.info(f"Initializing compression: trigger={trigger_threshold}, keep_recent={keep_recent}")

    _compression_manager = CompressionManager(
        token_counter=agent_context.token_counter,
        trigger_threshold=trigger_threshold,
        keep_recent=keep_recent,
    )

    return _compression_manager


async def after_llm_call(agent: Any, context: Any, response: Any) -> Any:
    """
    Hook: After each LLM call, check if compression needed.

    This extension hook is called after the model generates a response.
    We use it to:
    1. Check if token count exceeds threshold
    2. If yes: compress old messages
    3. Update agent memory with compressed summary
    """

    try:
        # Initialize manager if needed
        if _compression_manager is None:
            config = getattr(agent, "config", {})
            initialize_compression_manager(agent, config)

        # Get current messages from context
        # (Adjust based on A0's actual message storage location)
        messages = getattr(context, "messages", [])
        if not messages:
            return response

        # Check if compression should trigger
        should_compress = await _compression_manager.should_compress(messages)
        if not should_compress:
            return response

        logger.info("Compression triggered, applying...")

        # Apply compression
        new_messages, compression_result = await _compression_manager.apply_compression(
            messages,
            model=agent.model,
        )

        # Update context with new messages
        # (Adjust based on A0's actual message storage)
        context.messages = new_messages

        if compression_result:
            logger.info(
                f"Compression complete: "
                f"{compression_result.tokens_before} → {compression_result.tokens_after} tokens"
            )

            # Log compression event (for monitoring)
            # TODO: Add to agent metrics/logging
            agent.context.log.log(
                type="compression",
                heading=f"Memory Compressed",
                content={
                    "compressed_messages": compression_result.messages_compressed,
                    "kept_messages": compression_result.messages_kept,
                    "tokens_before": compression_result.tokens_before,
                    "tokens_after": compression_result.tokens_after,
                    "savings_percent": (
                        (compression_result.tokens_before - compression_result.tokens_after)
                        / compression_result.tokens_before * 100
                    ),
                },
            )

    except Exception as e:
        logger.error(f"Compression hook error: {e}", exc_info=True)
        # Don't fail the agent if compression has issues
        # Just log and continue

    return response
```

---

## Step 4: Update Agent Configuration

**File to Modify**: `usr/settings.json`

Add compression config:

```json
{
  "agent_zero": {
    ...
    "compression": {
      "enabled": true,
      "trigger_tokens": 50000,
      "keep_recent": 5,
      "min_compression_ratio": 0.3
    },
    ...
  }
}
```

Or env var overrides:
```bash
export A0_SET_compression_trigger_tokens=50000
export A0_SET_compression_keep_recent=5
export A0_SET_compression_enabled=true
```

---

## Step 5: Write Tests

**File**: `tests/test_memory_compression.py`

```python
"""Tests for memory compression."""

import json
import pytest
from unittest.mock import Mock, AsyncMock, patch

from carabiner.memory.compression_schema import (
    RestaurantSummarySchema,
    CompressionResult,
)
from carabiner.memory.compression_manager import CompressionManager


class TestCompressionSchema:
    """Test RestaurantSummarySchema validation."""

    def test_valid_schema(self):
        """Schema accepts valid data."""
        schema = RestaurantSummarySchema(
            daily_context="120 covers expected",
            standing_parameters="Par: beef 50, chicken 80",
            recent_decisions="Ordered prime rib from Sysco",
            pending_actions="Await delivery 2pm",
            constraints_and_learnings="Sysco lead: 2 days",
        )
        assert schema.daily_context == "120 covers expected"

    def test_daily_context_max_length(self):
        """daily_context field limited to 300 chars."""
        with pytest.raises(ValueError):
            RestaurantSummarySchema(
                daily_context="x" * 301,  # Over limit
                standing_parameters="test",
                recent_decisions="test",
                pending_actions="test",
                constraints_and_learnings="test",
            )

    def test_standing_parameters_max_length(self):
        """standing_parameters field limited to 350 chars."""
        with pytest.raises(ValueError):
            RestaurantSummarySchema(
                daily_context="test",
                standing_parameters="x" * 351,  # Over limit
                recent_decisions="test",
                pending_actions="test",
                constraints_and_learnings="test",
            )


class TestCompressionManager:
    """Test CompressionManager logic."""

    @pytest.fixture
    def token_counter(self):
        """Mock token counter: 1 token per 4 chars."""
        def count(text):
            return max(1, len(text) // 4)
        return count

    @pytest.fixture
    def manager(self, token_counter):
        """Create compression manager."""
        return CompressionManager(
            token_counter=token_counter,
            trigger_threshold=100,  # Low for testing
            keep_recent=2,
        )

    @pytest.mark.asyncio
    async def test_should_not_compress_below_threshold(self, manager):
        """No compression if token count below threshold."""
        messages = [
            {"content": "Short msg 1"},
            {"content": "Short msg 2"},
        ]
        result = await manager.should_compress(messages)
        assert result is False

    @pytest.mark.asyncio
    async def test_should_compress_above_threshold(self, manager):
        """Compression triggered if token count above threshold."""
        messages = [
            {"content": "x" * 200},  # 50 tokens
            {"content": "y" * 200},  # 50 tokens
            {"content": "z" * 200},  # 50 tokens
            {"content": "w" * 200},  # 50 tokens
            # Total: 200 tokens > 100 threshold
        ]
        result = await manager.should_compress(messages)
        assert result is True

    @pytest.mark.asyncio
    async def test_should_not_compress_few_messages(self, manager):
        """No compression if fewer messages than keep_recent."""
        messages = [
            {"content": "msg1"},
            {"content": "msg2"},  # Only 2 messages, keep_recent=2
        ]
        result = await manager.should_compress(messages)
        assert result is False

    @pytest.mark.asyncio
    async def test_compress_messages_success(self, manager):
        """compress_messages generates valid summary."""
        old_messages = [
            {"content": "Ordered 50lb beef from Sysco"},
            {"content": "Delivery expected Tuesday"},
        ]

        # Mock LLM response
        mock_model = AsyncMock()
        mock_model.return_value = {
            "content": json.dumps({
                "daily_context": "Tuesday delivery from Sysco",
                "standing_parameters": "Par: beef 50lb",
                "recent_decisions": "Ordered beef",
                "pending_actions": "Await delivery",
                "constraints_and_learnings": "Sysco 2-day lead",
            })
        }

        summary = await manager.compress_messages(old_messages, mock_model)

        assert summary is not None
        assert "Tuesday delivery" in summary
        assert "<system-summary>" in summary

    @pytest.mark.asyncio
    async def test_apply_compression_returns_tuple(self, manager):
        """apply_compression returns (messages, result)."""
        messages = [
            {"content": "x" * 200},
            {"content": "y" * 200},
            {"content": "z" * 200},
            {"content": "w" * 200},
            {"content": "Recent msg"},
        ]

        mock_model = AsyncMock()
        mock_model.return_value = {
            "content": json.dumps({
                "daily_context": "Summary",
                "standing_parameters": "Params",
                "recent_decisions": "Decisions",
                "pending_actions": "Actions",
                "constraints_and_learnings": "Constraints",
            })
        }

        new_messages, result = await manager.apply_compression(messages, mock_model)

        assert isinstance(new_messages, list)
        assert isinstance(result, CompressionResult)
        assert result.success is True
        assert result.messages_compressed == 3
        assert result.messages_kept == 2

    @pytest.mark.asyncio
    async def test_compression_summary_cached(self, manager):
        """Manager caches last summary."""
        messages = [{"content": "x" * 300}] * 5

        mock_model = AsyncMock()
        mock_model.return_value = {
            "content": json.dumps({
                "daily_context": "Summary",
                "standing_parameters": "Params",
                "recent_decisions": "Decisions",
                "pending_actions": "Actions",
                "constraints_and_learnings": "Constraints",
            })
        }

        _, _ = await manager.apply_compression(messages, mock_model)

        assert manager.compressed_summary != ""
        assert "Summary" in manager.compressed_summary


class TestCompressionIntegration:
    """Integration tests with realistic data."""

    @pytest.mark.asyncio
    async def test_real_restaurant_compression(self):
        """Test compression with realistic restaurant conversation."""
        # Token counter: ~1 token per 4 chars
        token_counter = lambda text: max(1, len(text) // 4)

        manager = CompressionManager(
            token_counter=token_counter,
            trigger_threshold=1000,
            keep_recent=3,
        )

        # Simulate long conversation
        messages = [
            {
                "role": "user",
                "content": "What's our par for beef? We need to order this week.",
            },
            {
                "role": "assistant",
                "content": "Our par for beef is 50lbs. Current stock is 15lbs, so we need 35lbs.",
            },
            {
                "role": "user",
                "content": "Call Sysco and get a quote for 35lbs of prime rib at 2-inch thickness.",
            },
            {
                "role": "assistant",
                "content": "Called Sysco. Prime rib is $8.50/lb, so 35lbs = $297.50. Lead time 2 days.",
            },
            {
                "role": "user",
                "content": "That's over budget by $50. Can we check Marbled Meats instead?",
            },
            {
                "role": "assistant",
                "content": "Marbled Meats: $7.80/lb = $273 total. Lead time 3 days. That's under budget.",
            },
            {
                "role": "user",
                "content": "Great, place the order with Marbled Meats. Also, remove beef wellington from menu.",
            },
            {
                "role": "assistant",
                "content": (
                    "Ordered 35lbs prime rib from Marbled Meats ($273). "
                    "Menu updated: beef wellington removed."
                ),
            },
        ]

        # Simulate LLM response for compression
        mock_model = AsyncMock()
        mock_model.return_value = {
            "content": json.dumps({
                "daily_context": "None (general ordering)",
                "standing_parameters": "Par beef: 50lbs. Current: 15lbs. Food cost target: 32%",
                "recent_decisions": "Ordered 35lbs prime rib from Marbled Meats ($273, $7.80/lb, 3-day lead). Removed beef wellington menu item.",
                "pending_actions": "Await Marbled Meats delivery in 3 days",
                "constraints_and_learnings": "Sysco $8.50/lb over budget. Marbled Meats $7.80/lb fits. Lead times: Sysco 2d, Marbled 3d.",
            })
        }

        # Should not compress initially (few messages)
        should_compress = await manager.should_compress(messages[:2])
        assert should_compress is False

        # Should compress when all messages added
        should_compress = await manager.should_compress(messages)
        assert should_compress is True

        # Apply compression
        new_messages, result = await manager.apply_compression(messages, mock_model)

        # Verify result
        assert result.success is True
        assert result.messages_compressed == 5  # First 5 messages compressed
        assert result.messages_kept == 3  # Last 3 kept
        assert result.tokens_before > result.tokens_after
        assert len(new_messages) == 4  # 1 summary + 3 recent
```

---

## Step 6: Testing Checklist

Before submitting for code review:

- [ ] All unit tests pass: `pytest tests/test_memory_compression.py -v`
- [ ] Schema validation works: invalid data rejected
- [ ] Compression triggers at right token count
- [ ] Token counter accurate (test with known messages)
- [ ] Summary format valid JSON, parses to RestaurantSummarySchema
- [ ] Compression preserves vendor names, par levels, recent decisions
- [ ] Token savings measured (> 30% reduction)
- [ ] Extension hook integrates with A0 (no crashes)
- [ ] Formatting looks good in logs
- [ ] Edge cases handled: empty messages, single message, LLM errors

---

## Step 7: Deployment

1. **Merge to feature branch**: `feat/memory-compression`
2. **Test on staging** (if available): run agent with compression enabled
3. **Monitor metrics**:
   - Token count per session (should drop 40–60%)
   - LLM response quality (should be unchanged)
   - Compression event frequency (should be ~1 per 8-hour session)
4. **Tune thresholds** based on observations:
   - If compressing too early: increase `trigger_threshold`
   - If not compressing enough: decrease `trigger_threshold`
   - If losing important context: increase `keep_recent`
5. **Merge to main** once validated

---

## Troubleshooting

### Problem: "Compression fails, LLM returns invalid JSON"
- **Solution**: Update LLM prompt to be more explicit about JSON format
- **Fallback**: Log error, skip compression, continue without summary

### Problem: "Summary doesn't include vendor names"
- **Solution**: Update compression prompt to explicitly mention vendors
- **Alternative**: Feed most recent messages to LLM for summary (focus on recent decisions)

### Problem: "Token count increases after compression"
- **Solution**: Check summary length, reduce max_length fields
- **Alternative**: Use more aggressive summarization (fewer fields)

### Problem: "Agent forgets par levels after compression"
- **Solution**: Move par levels to system prompt (standing parameters)
- **Alternative**: Update `standing_parameters` field description

---

## Success Criteria (Gate)

**Merge approval requires:**
1. Token savings > 35% on test logs
2. All tests passing
3. No increase in LLM call count
4. Summary captures: vendor names, par levels, recent orders, pending deliveries
5. A0 behavior unchanged (makes same decisions)
6. Extension hook doesn't crash agent loop
7. Code reviewed + approved by Esteban

---

## Next Steps After Merge

1. Deploy to production
2. Monitor token burn for 1 week
3. Calculate actual savings
4. Write up findings in `.rune/post-implementation-review.md`
5. Plan Phase 2 (if any adjustments needed) or Phase 3 (planning system)
