# ADR-001: Fleet Learning Architecture — Federated Intelligence Across CarabinerOS Deployments

**Date:** 2026-03-25
**Status:** Approved — to be built post-MVP when multi-tenant deployment begins
**Session:** 10

---

## Context

Each CarabinerOS restaurant deployment runs its own Agent Zero instance with unique, sensitive operational data: food costs, recipes, vendor relationships, staff schedules, and usage patterns. As the fleet grows, the platform faces a strategic question: how do we make the system smarter across all deployments without centralizing sensitive restaurant data?

The naive approaches are unacceptable:
- **Full centralization**: Restaurants will not accept their recipes and costs going to a central server. Legal and competitive exposure is too high.
- **No sharing**: Leaves performance gains on the table. Every restaurant would bootstrap from zero regardless of fleet size.

The model that fits is federated learning — each kitchen stays sovereign, but the fleet learns together.

---

## Decision

Implement a 4-layer federated intelligence system. Each layer is independently deployable and has standalone value.

### Layer 1: Tiny-Router Federated Training

The tiny-router is a small ONNX classifier that decides whether a user message can be handled by a lightweight path or needs full A0 LLM processing. Its accuracy directly determines token cost.

**Mechanism:**
- Each instance logs router classifications and implicit corrections. A message the router marked as skippable but A0 had to process is a misclassification signal.
- Weekly export: anonymized training pairs. All names, vendors, and dollar amounts are stripped before export. "86 the duck confit" becomes "86 the [ITEM]". "Order 5 cases of salmon" becomes "order [QTY] cases of [ITEM]".
- Central server retrains the tiny-router on aggregate data from all restaurants.
- Updated ONNX model is pushed to all deployments.

**Flywheel effect:** A pizzeria teaches the model pizza slang. A sushi bar teaches Japanese kitchen vocabulary. A steakhouse teaches butchery terms. Every new cuisine type makes the router smarter for the whole fleet.

### Layer 2: Anonymous Pattern Intelligence (Waze model)

Opt-in operational benchmarking. No restaurant sees another restaurant's data — only fleet aggregates.

**What gets shared (opt-in):**
- `restaurant_type`, `covers_per_day_bucket`, `food_cost_pct`, `waste_categories`, `ordering_patterns`, `tool_usage_distribution`, `router_skip_rate`

**What restaurants receive back:**
- "Restaurants like yours average 32% food cost — you're at 34%"
- "Similar restaurants order 23% more protein on Thursdays"
- "Your produce waste is 2x fleet average for your cuisine type"

This is the Waze model: contribute anonymized signals, receive aggregate intelligence. The more participants, the better the benchmarks.

### Layer 3: Prompt and Extension Evolution

Track which A0 prompt patterns produce the highest success rates across the fleet. Surface anti-patterns and spread winning patterns.

**Mechanism:**
- Fleet-level telemetry on tool call sequences and success rates
- Anti-pattern detection: "Calling `orders_list` before `orders_create` wastes ~400 tokens — 67% success rate vs 94% for direct create"
- Self-spreading plugins: Restaurant A's A0 builds a Toast MCP integration overnight → validated by fleet usage → made available to all restaurants
- Plugin marketplace that builds itself via A0 instances across the fleet
- Retention signal: "92% of restaurants kept the Toast plugin active after 30 days"

### Layer 4: Memory Compression Templates

A0's memory compression is generic by default. Fleet data allows per-restaurant-type compression schemas that preserve the right context for each cuisine and service style.

**Examples:**
- Fine dining: prioritize VIPs, allergies, wine pairing, tasting menu context, cover counts
- Fast casual: prioritize ticket times, delivery surge patterns, cost ceilings, prep par levels
- Coffee/bakery: prioritize morning prep windows, waste windows, seasonal menu cycles

The fleet learns what each restaurant type finds worth remembering.

---

## Privacy Architecture

This is the non-negotiable constraint that makes the whole system viable.

**Never leaves the restaurant:**
- Raw message text
- Dollar amounts (costs, prices, wages)
- Vendor names and relationships
- Staff names and schedules
- Recipe details and proprietary processes

**Opt-in export (anonymized):**
- Router classification corrections (stripped of all content)
- Operational pattern buckets (covers/day range, cuisine type, waste category distributions)
- Tool usage statistics (which tools called in which sequences)
- Plugin adoption and retention signals

**Technical enforcement:**
- Differential privacy: add calibrated noise to aggregates so no single restaurant is identifiable from fleet data
- Anonymization runs at the deployment level before any data leaves the instance
- Restaurant dashboard: full visibility into exactly what is being shared, per-category kill switch
- Central server never receives raw data — by design, not just by policy

---

## Rationale

This is the Tesla Autopilot model applied to restaurants. Each vehicle (kitchen) operates independently. The fleet gets smarter together. A new competitor starting today has zero restaurant training data. CarabinerOS starts with every deployment worth of patterns.

The competitive moat compounds:
- More restaurants → more training data → better tiny-router → lower per-restaurant token cost
- Lower cost → more restaurants can afford it → more training data
- More patterns → better benchmarks → more value demonstrated → faster sales
- More plugins → better integrations → less A0 work needed → faster completions
- More corrections → better prompts → fewer retries → less token burn

This moat is structural. It cannot be replicated by a competitor who starts fresh, regardless of their model quality or funding.

The Waze analogy is deliberate and should be used in sales conversations: "Every restaurant in the fleet is teaching the system. When you join, you're not just buying software — you're joining an intelligence network that gets smarter every week."

---

## Implementation Impact

### Required components (not yet built):

1. **Telemetry/export pipeline** — each deployment collects, anonymizes, and exports training signals on a weekly schedule. Runs as a scheduled A0 task or cron.

2. **Central model registry + aggregation service** — receives anonymized signals, retrains models, hosts updated ONNX artifacts. Separate infrastructure from the restaurant deployments.

3. **Privacy-preserving anonymization layer** — PII stripping and differential privacy noise injection before export. Must be auditable and testable.

4. **Plugin validation and distribution system** — intake, safety review, and rollout pipeline for A0-generated plugins. Requires human review gate before fleet-wide distribution.

### Build order

**Layer 1 first.** Federated tiny-router training is:
- Simplest technically (structured classification data, no text content)
- Highest immediate ROI (every improvement reduces token cost across the entire fleet)
- Easiest to make private (classification labels only, no message content)
- Required infrastructure for everything else (telemetry pipeline serves all layers)

Layers 2, 3, and 4 build on the telemetry infrastructure established in Layer 1.

### Dependencies

- Multi-tenant deployment must begin before fleet learning has statistical value. Single-restaurant pilots cannot validate fleet learning.
- Central aggregation service requires separate infrastructure decisions (hosting, auth, SLAs).
- Plugin distribution requires a human review step until automated safety tooling is proven.

---

## Alternatives Considered

**Full federated learning (gradient sharing):** Too complex, requires synchronized training rounds, significant infrastructure. The tiny-router approach is simpler and sufficient.

**Zero sharing / pure local learning:** Leaves the structural moat on the table. Each restaurant would plateau at single-deployment learning quality.

**Centralized data warehouse with PII scrubbing:** Restaurants will not accept their operational data living on a central server, scrubbed or not. Trust is the constraint, not technology.

**Opt-out instead of opt-in:** Inverted consent model increases short-term data volume but creates regulatory and trust risk. Opt-in with clear value demonstration is the right model for a B2B product serving small business owners.
