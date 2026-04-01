---
name: Self-Evolving Platform Architecture
description: The 6-layer loop — automated discovery, fleet learning, central intelligence, GitAgent distribution, local self-update via compressed LLM, voice-first mobile
type: project
---

CarabinerOS is designed as a self-evolving platform with 6 layers:

1. **Automated Discovery** (last30days-style): Daily scan of GitHub/HN/X/ArXiv for relevant developments
2. **Fleet Learning** (ADR-001): Anonymized patterns from all restaurants aggregated centrally
3. **Central Intelligence**: Evaluate discoveries + fleet data → adopt, retrain, build
4. **GitAgent Distribution**: Versioned, auditable, git-tagged updates pushed to restaurants
5. **Local Self-Update**: Each A0 uses local compressed LLM (no API) to process updates, sends Action Card to chef: "I learned 3 things today"
6. **Voice-First Mobile**: Primary input is voice (STT runs locally in A0), not typing. No chef types orders.

**Message cost stack**: Voice/text → tiny-router ($0) → skip/local LLM ($0) or API (paid). Target: 50-60% of messages at $0.

**Why:** Compound competitive advantage. New entrant has 0 fleet data. CarabinerOS has thousands of restaurants worth of patterns. The moat is accumulated intelligence, not code.

**How to apply:** Every feature should include telemetry hooks for fleet learning. Every A0 prompt change should be git-versioned. Voice input should be the default assumption for mobile UI.

**ADR:** `docs/adr/ADR-002-self-evolving-platform-architecture.md`
