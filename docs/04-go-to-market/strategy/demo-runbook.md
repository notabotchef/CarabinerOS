# CarabinerOS NYC Demo Runbook

**Audience:** 3-location independent operators, $3M+ revenue  
**Time:** 15 minutes  
**Goal:** Operator leaves thinking "this is built for how I actually work"

---

## Pre-Demo Setup (Day Before)

**1. Reseed with their restaurant name**

```bash
python -m carabiner.db.seed_realistic --no-confirm --restaurant-name "TARGET NAME"
```

Replace `TARGET NAME` with the actual restaurant. Run this the night before — not the morning of.

**2. Start the stack**

```bash
docker compose -f docker-compose.dev.yml up
```

Verify at http://localhost:8080. Let it warm up — first load after a restart can be slow.

**3. Check the LLM key**

Open `.env`. Confirm either `ANTHROPIC_API_KEY` or `OPENROUTER_API_KEY` is set and not expired. If you rotated keys recently, test a chat message now.

**4. Stage the browser**

Have two tabs open before you walk in: the Orders page and the A0 chat. No other tabs. Full screen.

---

## Demo Flow (15 Minutes)

### 1. The 2 AM Problem (2 min)

Open the Orders page. Don't narrate the UI. Say:

> "This is what your team sees when they log in. Every PO, every vendor — the whole picture in one place. No emails, no texts to the chef."

Let them look. Don't click around. Silence is fine here.

---

### 2. Ask the Question You'd Text Your Chef at 2 AM (5 min)

Open the A0 chat (main chat, not a module chat). Type exactly:

```
What did we order from US Foods last week and are we running low on anything?
```

While A0 is responding, say:

> "It's querying your actual order history right now. Same data you'd dig through in three spreadsheets."

When the response comes back, point at the numbers. Don't read them aloud — let the operator read. Then say:

> "That's the question you'd text your chef at 2 AM. Now you don't have to."

---

### 3. Make a Change, Watch It Happen (5 min)

In the same chat, type:

```
Draft a new order for Pacific Seafood for produce replenishment based on our par levels
```

While A0 works, say:

> "It knows your par levels from the data we seeded. Watch the left side."

An action card should appear on the left panel with "Send Order" and "Edit Items" buttons. Point at it:

> "A0 drafted the order. It hasn't sent anything. That card is sitting there waiting for you."

---

### 4. The Proof (3 min)

Click over to the Orders page. Find the new draft. Say:

> "You approved nothing yet. It's a draft — it's waiting for you. Nothing in CarabinerOS fires automatically. AI drafts, you approve, then it commits. That's the whole model."

Then say the price proactively — don't wait for them to ask:

> "This is $149 a month per location. Less than one hour of your manager's time."

---

## If Something Breaks

**A0 takes too long (>30 seconds)**

> "Running locally today — in production this is faster. Let me show you what the response looks like."

Refresh. If it's still spinning, pivot to showing existing orders on the Orders page.

**Action card doesn't appear**

Don't apologize. Refresh the page. If the card is still missing, navigate to the Orders page directly — the draft order will be there. Say:

> "The card is a UI shortcut — the order itself is already in the system. Here it is."

**DB error on the chat query**

> "Let me show you the orders we already have loaded."

Close the chat, go to the Orders page, walk through the existing data. Frame it as showing the structured view instead of the conversational view.

**Wrong restaurant name in the data**

If the seed ran against the wrong name, don't point it out. The operator won't know what data is "correct." Stay on the flow.

---

## Key Messages to Land

These come from the MiroShark sim — say them out loud, in these words:

- **"Say it, don't click it"** — that 20-minute ordering grind becomes a conversation
- **"AI drafts, human approves, deterministic commit"** — nothing happens without you
- **"$149 a month per location"** — say it proactively, before they ask

**Do NOT say "built by chefs."** It came across as a marketing claim, not a proof point. Let the data do that work.

---

## Questions to Invite

After the demo, open with: "What would break this for you?"

**"What happens if the AI is wrong?"**  
Point to the action card. "That's why nothing auto-commits. The Three-Step Commit Model — draft, review, approve. If the draft is wrong, you edit it or delete it. Nothing fires until you say so." (Full framework in `docs/gtm/liability-framework.md`.)

**"How do I get my data in?"**  
"The seeder handles the initial import from your existing invoices and POS exports. After that, it stays current through your POS integration. Setup is one session."

**"Can my managers use this?"**  
"Yes — role-based access, so A0 operates within whatever permissions you set. Your managers can draft, they can't approve above their limit."
