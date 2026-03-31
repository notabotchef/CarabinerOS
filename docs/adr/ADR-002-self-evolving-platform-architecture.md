# ADR-002: Self-Evolving Platform Architecture

**Date:** 2026-03-25
**Status:** Approved
**Deciders:** Esteban Nunez (founder)

## Context

CarabinerOS is a restaurant management platform built on Agent Zero. Each restaurant gets its own A0 instance. The question: how does the platform improve itself continuously — discovering new techniques, learning from all deployments, and distributing improvements — without manual intervention?

Session 10 research surfaced 6 projects that, when combined, form a complete self-evolving loop:

| Component | Source | Role |
|-----------|--------|------|
| AgentScope | Alibaba | Multi-agent patterns, memory compression |
| tiny-router | UdaraJay | Local ML classifier for message routing |
| TurboQuant | Google Research | Edge model quantization for local LLM |
| GitAgent | open-gitagent | Versioned, auditable agent distribution |
| last30days | mvanhorn | Automated research/discovery across 10+ sources |
| Crucix | calesthio | Graceful parallel ingestion, delta engine |

## Decision

Build a self-evolving platform with 6 layers:

### Layer 1: Automated Discovery (last30days)
- Scheduled daily scan of GitHub Trending, HN, ArXiv, X, Reddit for AI/restaurant/agent developments
- Cross-source deduplication and ranking (relevance + recency + engagement)
- Produces daily R&D brief for the CarabinerOS team
- Graceful degradation: any source can fail without breaking the scan (Crucix pattern)

### Layer 2: Fleet Learning (ADR-001)
- Each restaurant logs anonymized patterns (tiny-router corrections, tool usage, operational metrics)
- Central aggregates: retrain tiny-router, identify effective prompt patterns, benchmark operations
- Privacy boundary enforced at deployment level — raw data never leaves the restaurant
- Differential privacy on all aggregates

### Layer 3: Central Intelligence
- Evaluate discoveries from Layer 1 against fleet data from Layer 2
- Determine what to adopt: new quantization techniques, better prompts, new integrations
- Build/update plugins, retrain models, refine system prompts

### Layer 4: GitAgent Distribution
- All updates packaged as git-tagged, versioned releases (GitAgent pattern)
- Segregation of duties: different roles for who can approve prompt changes vs. plugin changes
- Audit trail: every change is traceable to a specific version, reason, and approver
- Rollback capability: any restaurant can pin to a previous version

### Layer 5: Local Self-Update
- Each restaurant's A0 receives the update package
- Local compressed LLM (TurboQuant-optimized, no API call) processes the diff
- A0 "understands" what changed and generates a human-friendly summary
- Action card delivered to the operator: "I learned 3 things today..."
- No interruption to service — updates apply during quiet hours

### Layer 6: Voice-First Mobile Interface
- Primary input method for kitchen operators: voice, not typing
- A0 already has local voice recognition (STT) built in
- Mobile webapp (PWA) with voice input → tiny-router classification → A0 processing
- "86 the halibut, fire two rib-eye mid-rare" → parsed, classified, acted upon
- Action cards as the primary output on mobile (visual, glanceable, actionable)

### The Message Flow (Cost Optimization Stack)

```
Voice/text arrives at restaurant's A0
  → tiny-router classifies locally (~10ms, $0)
    → actionability=none  → canned response ($0)
    → urgency=low + act   → local LLM with TurboQuant KV cache ($0)
    → urgency=high + act  → Claude API (paid, ~40-50% of messages)
  → response via action card or voice
  → anonymized learnings → central fleet
```

Target: 50-60% of messages handled at $0 cost.

## Rationale

This architecture creates a compound competitive advantage:
- **Day 1**: CarabinerOS is a good restaurant management tool with AI
- **Day 30**: It's learned from its first restaurants, router is tuned
- **Day 365**: It's learned from hundreds of restaurants, knows every kitchen dialect, has community-built integrations, benchmarks by cuisine type
- **Day 1000**: A new competitor would need years of fleet data to match

The Tesla Autopilot analogy: each kitchen drives independently, the fleet gets smarter together. The moat isn't the code — it's the accumulated intelligence.

## Implementation Phases

1. **Now → MVP**: Build tiny-router A0 plugin (Layer 5 of cost optimization)
2. **Post-MVP**: Add fleet telemetry pipeline (Layer 2)
3. **Multi-tenant**: GitAgent distribution (Layer 4) + local self-update (Layer 5)
4. **Growth**: Automated discovery via last30days (Layer 1)
5. **Mobile launch**: Voice-first interface (Layer 6)

## Alternatives Considered

1. **Centralized model only (no local inference)**: Rejected — too expensive at scale, no offline capability
2. **Manual updates only**: Rejected — doesn't scale past 50 restaurants
3. **Open-source the full platform**: Deferred — fleet learning is the moat, open-sourcing before it's established gives away the advantage without building it

## References

- ADR-001: Fleet Learning Architecture (federated intelligence details)
- AgentScope research: `.rune/analysis-agentscope-memory-planning.md`
- tiny-router plugin design: `PLUGIN_TINY_ROUTER_DESIGN.md`
- GitAgent patterns: `GITAGENT_PATTERNS_FOR_CARABINER.md`
- TurboQuant analysis: Session 10 research notes
- last30days analysis: Session 10 research notes
- Crucix analysis: Session 10 research notes
