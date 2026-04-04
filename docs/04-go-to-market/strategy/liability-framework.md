# CarabinerOS Liability Framework
### When the AI is wrong, here's exactly what happens

> Publish this before anyone asks. The question "who eats the variance?" was raised in Sim 2 at round 24 and never answered. It will be the first question every operator asks during a demo.

---

## The Three-Step Commit Model

```
AI DRAFTS  →  HUMAN APPROVES  →  DETERMINISTIC COMMIT
```

**AI Drafts:** CarabinerOS generates a purchase order suggestion based on sales data, par levels, usage history, and supplier pricing. It shows its work — every quantity, every line item, with the reasoning visible.

**Human Approves:** A human — the GM, chef, or owner — reviews and approves before anything leaves the system. No PO fires automatically. No order is placed without a human touch.

**Deterministic Commit:** Once approved, the commit is exact and auditable. What you approved is what gets sent. No drift, no re-optimization after the fact.

---

## Who Is Responsible for What

| Scenario | Who's Responsible | What Happens |
|---|---|---|
| AI suggests wrong quantity, human approves without checking | **Operator** | Operator made the call. CarabinerOS generated a suggestion; the human confirmed it. |
| AI generates a suggestion based on bad data the operator provided | **Operator** | Garbage in, garbage out — same as any other back-office tool. |
| AI system bug causes a commit to differ from what was approved | **CarabinerOS** | We own this. Audit log is the source of truth. We will make it right. |
| Supplier delivers incorrectly after a correct PO was sent | **Supplier** | The PO is the paper trail. Our commit log is the proof. |

**The short version:** CarabinerOS is a draft tool, not an autonomous agent. The human is always the final authority.

---

## The Audit Trail

Every action in CarabinerOS generates a timestamped log:
- What the AI suggested
- What the human changed (if anything)
- Who approved
- When it was committed
- What was sent to the supplier

This log is exportable and yours. It is not held hostage to your subscription.

---

## What CarabinerOS Is Not

- **Not autonomous purchasing.** No order leaves without human approval.
- **Not a black box.** Every suggestion shows reasoning.
- **Not a replacement for your GM.** It's a draft tool that makes your GM faster.

---

## The Honest Limitation

Like any software, CarabinerOS can have bugs. When it does, the audit log makes the root cause visible. We do not hide behind "the AI decided" — every commit is traceable to a human approval event.

---

*Source: Sim 2 liability question, round 24 — "If your agent handles ordering, what happens when it hallucinates a quantity... Who eats that variance?"*
*Publish as a public-facing doc before NRA Show launch. Do not bury in FAQ.*
