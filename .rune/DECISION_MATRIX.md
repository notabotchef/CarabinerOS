# Decision Matrix: AgentScope Memory & Planning Adoption

**Quick reference for what to adopt and when.**

---

## Summary: What to Do

| Feature | Adopt? | Why | Timeline | Effort |
|---------|--------|-----|----------|--------|
| **Memory Compression** | YES (now) | 40–60% token cost reduction, ~$120–240/mo savings, 150 LOC | Week 1–2 | 1–2 days |
| **Async DB Memory Backend** | NO (post-MVP) | Cleaner scaling, but only needed multi-instance | Month 2+ | 2 weeks |
| **Formal Planning (PlanNotebook)** | MAYBE (post-MVP) | Better visibility/checkpoints for multi-day ops, but medium complexity | Month 2+ | 3 weeks |
| **Long-Term Memory (Mem0/ReMePersonal)** | NO | Overkill for MVP, complex dependencies | Month 3+ | 4+ weeks |

---

## Memory Compression: The Easy Win

### What Is It?
- Automatically summarize old messages when token count exceeds threshold (~50K tokens)
- Inject summary as first message, remove old messages from context
- Result: 40–60% token savings, A0 still remembers vendor names, par levels, recent decisions

### Why Now?
- **Token burn**: $600/month baseline → $240/month with compression
- **Easy implementation**: ~150 lines of code, no DB needed, no A0 core changes
- **Low risk**: Summary format verified in AgentScope tests, proven to preserve semantics

### How (Implementation Outline)

```python
# 1. Create RestaurantSummarySchema (Pydantic model)
class RestaurantSummarySchema(BaseModel):
    daily_context: str  # Covers, special events, staff notes
    standing_parameters: str  # Par levels, vendor info, menu specs
    recent_decisions: str  # Orders placed, menu changes, cost updates
    pending_actions: str  # Follow-ups, deliveries, approvals
    constraints_learned: str  # Supplier limits, cost overruns, issues

# 2. Create CompressionManager class
async def compress_messages(old_messages) -> str:
    # Call LLM: "Summarize these messages into RestaurantSummarySchema"
    # Return formatted summary with each field labeled

# 3. Add extension hook (extensions/30_memory_compression.py)
# After each LLM call:
#   - Check token count
#   - If > 50K, call CompressionManager.apply_compression()
#   - Replace old messages with summary + recent 5 messages

# 4. Test
# - Verify summary includes vendor names, par levels, recent orders
# - Measure token savings
# - Confirm A0 behavior unchanged (makes same decisions)
```

### Success Metrics
- [ ] Token count per session drops to 40–60% of baseline
- [ ] A0 inventory decisions still correct (doesn't forget par levels)
- [ ] No increase in LLM calls (compression doesn't add overhead)
- [ ] Compression triggers when expected (at ~50K tokens)

### What Not to Do
- Don't use AgentScope's AsyncSQLAlchemyMemory for compression yet (use file-based for MVP)
- Don't compress real-time messages (keep last 5 messages fresh)
- Don't make compression configurable per-restaurant (start with defaults, tune later)

---

## Formal Planning (Post-MVP, Medium Value)

### What Is It?
- Structured subtask tracking: `Plan` → `SubTask[]` with state transitions
- Agent calls `create_plan()`, then `update_subtask_state()`, `finish_subtask(outcome)` as it works
- Hints guide agent: "Subtask 3 in progress. Options: continue, finish, revise, ask user"
- Checkpoints persist: if agent dies, resume from last finished subtask

### When to Consider
- **Weekly ordering**: 15–20 subtasks, multi-vendor, error-prone → HIGH value
- **Menu changes**: Multi-day, human approvals needed → MEDIUM–HIGH value
- **Event prep**: Time-bound, notifications needed → MEDIUM value
- **Daily prep**: Linear, short cycle → LOW value
- **P&L review**: Simple fetch-report → LOW value

### Restaurant-Specific Plans

```python
# Example: Weekly Ordering Plan
Plan(
    name="Weekly Ordering",
    subtasks=[
        SubTask(name="Audit inventory", description="Count onhand", expected_outcome="JSON"),
        SubTask(name="Fetch vendor pricing", description="Get Sysco costs", expected_outcome="JSON"),
        SubTask(name="Calculate order quantities", description="Par - onhand", expected_outcome="JSON"),
        SubTask(name="Validate budget", description="Stay under limit", expected_outcome="Summary"),
        SubTask(name="Place purchase orders", description="Submit to vendors", expected_outcome="Confirmations"),
        SubTask(name="Schedule deliveries", description="Confirm windows", expected_outcome="Calendar"),
    ]
)

# Example: Menu Change Plan
Plan(
    name="Menu Change (2026-04-15)",
    subtasks=[
        SubTask(name="Develop recipes", ...),
        SubTask(name="Verify ingredient availability", ...),
        SubTask(name="Cost new menu", ...),
        SubTask(name="Get chef approval", ...),  # Conditional
        SubTask(name="Train kitchen staff", ...),
        SubTask(name="Deploy to POS + website", ...),
    ]
)
```

### Why Post-MVP?
- Requires more A0 integration (tool definitions, hint logic)
- Needs frontend display components (plan cards, progress indicators)
- Can stabilize without it (agent reasoning works fine for smaller tasks)
- ROI clearer once seeing what multi-day operations actually look like

### If You Implement It
1. Build `RestaurantPlanNotebook` with above plan templates
2. Add `create_plan`, `update_subtask_state`, `finish_subtask` tools to A0
3. Create plan display components (markdown rendering, progress cards)
4. Integrate hints into A0 system prompt

---

## What NOT to Adopt

### 1. Long-Term Memory (Mem0, ReMePersonal, REmeTool)
**Why**: Overkill for MVP, complex setup

- **Mem0**: Semantic memory layer requiring external service (cost, latency)
- **ReMePersonal**: User preferences/style, but A0 doesn't have persistent user profiles yet
- **REmeTool**: Tool usage patterns, but A0 has few tools and high consistency already
- **Simpler alternative**: Embed standing parameters (par levels, vendor info, preferences) directly in system prompt → works fine

### 2. Redis/AsyncSQLAlchemyMemory Backend
**Why**: Not needed for single-instance MVP

- Only needed if deploying agents across multiple servers
- File-based memory works fine for concurrent sessions on single instance
- Migration cost: 2 weeks engineering for 80% relevance at MVP scale
- Defer to pre-scaling phase ($10K/month token burn and beyond)

### 3. Memory Marks & Multi-Mark Filtering
**Why**: Complicates compression logic

- AgentScope uses marks to categorize messages (`mark="hint"`, `mark="compressed"`)
- For CarabinerOS MVP: simpler to just remove old messages, prepend summary
- Can add marks later if needed for finer-grained memory management

---

## Timeline Recommendation

### Sprint 1 (Weeks 1–2): Memory Compression
- [ ] Implement `RestaurantSummarySchema` and `CompressionManager`
- [ ] Add `extensions/30_memory_compression.py` hook
- [ ] Write tests: verify compression triggers, summary structure, token savings
- [ ] Measure token reduction on real chat logs
- [ ] Tune `trigger_threshold` and `keep_recent` parameters
- **Owner**: Cook agent (memory compression specialist)
- **Gate**: Token savings > 35% on test logs, A0 behavior unchanged

### Sprint 2 (Weeks 3–4): Optional Enhancements
- [ ] Consider async DB memory backend (if file concurrency issues seen)
- [ ] Or: Plan phase 2 features (menus, ordering, event prep)

### Post-MVP (Weeks 5+): Planning & Scaling
- [ ] Formal planning system (if multi-day ops pain seen)
- [ ] Multi-instance deployment (if token burn > $1K/month)
- [ ] Long-term memory (if personalization needed)

---

## Key Takeaways

1. **Memory compression is a no-brainer**: $120–240/month savings, 2 days of work, low risk
2. **Formal planning is valuable but can wait**: Payoff clearer with real multi-day operations
3. **Multi-instance scaling is premature**: Only after MVP proves PMF
4. **Don't over-engineer**: File-based memory + compression >> Redis backend for MVP

**Next Step**: Dispatch `/rune:cook memory-compression` to implement phase 1.

---

## Quick Reference: Token Savings Math

```
Current: 30 agents × 20 sessions × 800K tokens = 480M tokens/month = $480/month

With compression (40% savings):
30 × 20 × 480K = 288M tokens/month = $288/month
Saves $192/month (40%)

With compression + planning (60% savings):
30 × 20 × 320K = 192M tokens/month = $192/month
Saves $288/month (60%)
```

**Reality check**: Your actual baseline is probably lower ($50–200/month). Even so, 40–60% compression is meaningful, especially as scale grows.
