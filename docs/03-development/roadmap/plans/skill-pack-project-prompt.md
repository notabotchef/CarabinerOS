# Project Prompt: CarabinerOS Restaurant Ops Skill Pack

> Copy this entire file as the initial prompt in a new Claude Code session, in a new empty project directory.

---

## Who I Am

I'm Esteban — a chef who codes. I ran kitchens at Roister (Michelin, Alinea Group, Chicago), Kama West Loop, Maybourne Beverly Hills, Celele (Colombia), and other fine dining restaurants. I tracked daily food cost at Roister for 153 weeks using an Excel spreadsheet. I built prep lists by hand for every station. I processed vendor invoices at 7am with coffee and a stack of delivery slips. I ran menu engineering matrices on paper before I knew the BCG framework had a name.

Now I'm building CarabinerOS — an AI-powered restaurant management platform. I have deep operator knowledge encoded in planning docs, data models, agent role prompts, and competitive research across 9 restaurant modules.

## What We're Building

A **restaurant operations skill pack** for OpenClaw / Claude Code / NanoClaw / NemoClaw — the personal AI agent ecosystem. This is a standalone product, separate from CarabinerOS. Think of it as the knowledge of a seasoned GM distilled into AI skills that any operator can install.

### Products to Create

1. **10 standalone skills** (`.claude/skills/` format — SKILL.md files)
2. **1 Claude Code / OpenClaw plugin** that bundles all skills with a unified CLI
3. **README, packaging, and Gumroad listing copy**

### Target Customer

Independent restaurant operators (1-3 locations, 50-150 seats). The person who is the chef, GM, accountant, and marketing department all in one. They use Claude Code or OpenClaw as their AI assistant and want restaurant-specific capabilities without building a full platform.

### Competitive Context

There's a $49 "OpenClaw Restaurant Ops" skill pack on Gumroad with 10 generic skills (prep forecasting, food cost analysis, review management, scheduling, HACCP). It's written by someone who researched restaurant ops. Ours is written by someone who lived it. Our skills should feel like they were written by a sous chef, not a consultant.

---

## The 10 Skills

### Skill 1: Food Cost Tracker

**Purpose:** Daily food cost tracking and budget management.

**Core Knowledge to Encode:**

The Roister Method (how I actually tracked cost at a Michelin restaurant):
- **5 numbers that matter:** Budget, Total Spend, Over/Under, Revenue, Cost %
- Daily entry: vendor-by-vendor spend. "Sysco $2,100, Coastal $850, Fortune $420"
- Weekly budget: e.g., $14K/week. Track cumulative spend against it daily
- COGS formula: `beginning_inventory + purchases - ending_inventory = actual_food_cost`
- Food cost % = `actual_food_cost / revenue × 100`
- Prime cost = `(food_cost + labor_cost) / revenue × 100`
- Target ranges: food cost < 30% (fine dining), < 28% (fast casual), < 35% (pizza/pasta)
- Prime cost target: < 60% green, 55-60% amber, > 60% red
- Category breakdowns: Proteins, Produce, Dairy, Dry Goods, Beverages, Paper/Chem
- Period tracking: follow budget period boundaries (usually calendar week or biweekly)

**What the skill teaches the AI:**
- Parse natural language cost entries: "Today's spend: Sysco $2,100, CW $850"
- Calculate running weekly food cost % from entries
- Alert when trending over budget (e.g., "You're at $9,200 on day 4 of a $14K week — pace puts you at $16,100")
- Break down cost by vendor and category
- Track Actual vs Theoretical variance when data allows
- Answer: "Am I making money or losing money?"

**Output format:** Daily cost summary table, budget tracker, trend alerts.

---

### Skill 2: Menu Engineering Matrix

**Purpose:** Classify every menu item as Star/Puzzle/Plowhorse/Dog and recommend actions.

**Core Knowledge to Encode:**

BCG-derived menu engineering methodology:
- **X-axis (Popularity):** Menu Mix % = `(qty_sold_of_item / total_qty_sold) × 100`
  - Threshold: item is "popular" if mix % >= `1/N × 0.7` where N = number of items (the 70% rule)
- **Y-axis (Profitability):** Contribution Margin = `menu_price - food_cost_per_serving`
  - Threshold: item is "profitable" if CM >= weighted average CM of all items

Quadrant actions:
| Quadrant | Pop | Profit | Action |
|----------|-----|--------|--------|
| **Star** | High | High | Protect. Feature prominently. Don't touch recipe or price. |
| **Puzzle** | Low | High | Reposition on menu, rename, retrain servers to upsell, add description. |
| **Plowhorse** | High | Low | Re-engineer recipe to reduce cost, raise price cautiously, reduce portion. |
| **Dog** | Low | Low | Remove, replace, hide deep in menu. Seasonal rotation candidate. |

Additional knowledge:
- Recalculation cadence: daily (with POS data), weekly (manual), on-demand
- Price simulation: "What if I raise the burger by $2?" → show projected CM, food cost %, quadrant shift
- 86 board: track unavailable items with reason, timestamp, frequency
- Pattern detection: items 86'd 3+ times/month = supply chain risk
- Price cascade: ingredient price change → recipe cost → menu item margin → matrix position
- Food cost % per item: green < 28%, yellow 28-32%, red > 32%

**Output format:** Matrix classification table, quadrant counts, action recommendations per item.

---

### Skill 3: Prep List Generator

**Purpose:** Generate, manage, and track daily prep lists.

**Core Knowledge to Encode:**

How prep actually works in a kitchen (from 4 different restaurants):

**The daily flow:**
- End-of-service meeting covers tomorrow's needs
- Each cook gets tasks for their station
- Sous chef reviews, adjusts quantities based on covers + inventory
- Cooks work through tasks, marking done as they go
- Completed list = kitchen is ready for service

**Prep list generation logic:**
1. Recipe explosion: for each menu item × expected covers = raw prep needs
2. On-hand deduction: subtract current inventory and yesterday's remaining prep
3. Par rounding: you don't prep 2.3 qt of vinaigrette — you prep 3 qt
4. Station assignment: group by station (Grill, Pantry, Garde Manger, Pastry, Saucier)
5. Service lane: Brunch, Dinner, Happy Hour, All Day
6. Priority: time-sensitive items first (doughs, braises, stocks)

**Four real prep list formats (reference):**
1. **Kama West Loop** — station-grouped, par-based, master copy with per-cook tabs
2. **Korean restaurant** — columns per dish/station, cook fills in QTY
3. **Maybourne/Alinea** — production-scale (500# short rib, 2400 portions), status tracking
4. **Celele** — bilingual tasting menu, "In Hand" + "Need to Prep" columns

**Common thread:** Item name + quantity needed + status (done/not done) — always present. Grouping varies by kitchen culture. The list is accountability, not instruction.

**Readiness states:** Complete, In Progress, At-Risk (shortage), Blocked (missing ingredient), Not Started

**What the skill teaches the AI:**
- Generate prep lists from menu items × cover count
- Account for on-hand inventory when suggesting quantities
- Group by station, tag by service lane
- Track completion status
- Flag shortages early: "Low on chicken stock — need 4 qt, only 1 qt on hand"
- Handle adjustments: "We just got a 40-top reservation" → recalculate affected items

**Output format:** Station-grouped checklist with quantities, status, and shortage alerts.

---

### Skill 4: Inventory Manager

**Purpose:** Track stock levels, par management, waste logging, and count workflows.

**Core Knowledge to Encode:**

**Two operational modes:**
1. **Budget Tracking (Roister pattern)** — daily vendor spend vs weekly budget, cost % vs revenue. For conceptual/high-budget restaurants that track dollars, not individual items.
2. **Item Counts (industry standard)** — par levels, item-by-item counts, variance, shrinkage. For cost-conscious restaurants watching every tomato.

Both modes feed the same weekly food cost %. Different inputs, same output.

**Count types:** Full count (everything), Spot check (key items), Walk-in count (one storage area)

**Par level logic:**
- Par = minimum stock level by day of week (Friday par > Tuesday par)
- Variance = on_hand - par. Negative = shortfall
- Shortfall triggers: reorder alert, auto-suggest PO, action card

**Waste tracking:**
- Reasons: spoilage, overproduction, expired, dropped/spilled
- Always log with dollar value: `waste_qty × unit_cost`
- Track by category for pattern analysis (proteins waste more than dry goods)
- Weekly waste target: < 2% of purchases

**Inventory valuation:** `SUM(on_hand × unit_cost)` across all items

**Storage areas:** Walk-in, Dry Storage, Bar, Freezer, Reach-in, Line

**What the skill teaches the AI:**
- Parse count entries: "Walk-in: 3 cases tomatoes, 2 avocados, half case lemons"
- Track par levels and flag shortfalls
- Log waste: "Waste 3 lbs spinach, wilted" → calculate dollar impact
- Calculate inventory valuation
- Generate reorder suggestions from par shortfalls
- Support both budget-tracking and item-count modes

**Output format:** Inventory summary with par variances, waste log, valuation, alerts.

---

### Skill 5: Recipe Costing Engine

**Purpose:** Calculate plate cost, food cost %, and scale recipes.

**Core Knowledge to Encode:**

**Modernist Cuisine recipe structure:**
- Recipes have Components (e.g., "Base", "Garnish", "Sauce")
- Components have Ingredients with weight in grams and baker's percentages
- Components have Steps with technique, temperature, duration
- Sub-recipes (stocks, sauces, doughs) are ingredients in parent recipes

**Cost calculation:**
```
plate_cost = SUM(component_costs)
component_cost = SUM(ingredient.weight_g × unit_cost / conversion) / (1 - prep_loss_pct/100)
food_cost_pct = (plate_cost / menu_price) × 100
```

**Target ranges:** green < 28%, yellow 28-32%, red > 32%

**Cost source priority:**
1. Latest purchase price from invoices
2. Manual override on ingredient
3. "Uncosted" warning if missing

**Scaling logic:**
```
scale_factor = target_yield / base_yield
scaled_weight = ingredient.weight_g × scale_factor
```
- Percentages within a component remain constant (baker's percentages)
- Round to practical batch sizes (no 2.3 qt of vinaigrette)
- Sub-recipes scale independently

**Smart ingredient parsing:** "200g salt" → {qty: 200, unit: "g", name: "salt"}

**What the skill teaches the AI:**
- Calculate plate cost from ingredients
- Scale recipes by factor (2x) or to target yield (24 portions)
- Convert between metric and US units
- Track cost changes when ingredient prices change
- Alert when food cost % crosses thresholds
- Parse natural language ingredient lists

**Output format:** Ingredient table with costs, component subtotals, plate cost, food cost %.

---

### Skill 6: Purchase Order Builder

**Purpose:** Create and manage vendor orders using order guides and par levels.

**Core Knowledge to Encode:**

**How ordering actually works:**
- Chef walks the kitchen, looks at what's needed for the week
- Checks par levels, upcoming covers, special events
- Builds order against vendor order guide (pre-set list of items per vendor)
- "Same as last Tuesday but drop the salmon" is a real ordering pattern
- Fill-to-par: `order_qty = par_level - on_hand` for each item in the guide

**Order guide structure:**
- Per-vendor, per-location
- Items with par levels, preferred pack sizes, vendor SKUs
- Sort order follows the vendor's catalog (so the order reads naturally)

**Vendor management:**
- Payment terms: Net 15, Net 30, COD
- Delivery days: specific days per vendor (Mon for produce, Tue for proteins)
- Order cutoff times: must submit by 2pm for next-day delivery
- Minimum order amounts: some vendors require $500+ minimums
- Channels: API/portal, email, phone, browser-based ordering

**PO workflow:** Draft → Ready to Send → Submitted → Confirmed → Received

**Delivery receiving:**
- Check received quantities against PO lines
- Flag variances: over, under, substituted, missing
- Note quality issues: "salmon looked off — rejected 2 cases"

**What the skill teaches the AI:**
- Build orders from order guides + inventory levels
- Calculate fill-to-par quantities
- Handle "same as last time" and "add/remove items" patterns
- Track vendor delivery schedules and cutoff times
- Check minimum order requirements
- Create clean PO summaries for vendors

**Output format:** PO with vendor, items, quantities, estimated total, delivery date.

---

### Skill 7: Invoice Processor

**Purpose:** Extract, validate, and track vendor invoices.

**Core Knowledge to Encode:**

**The 7am routine:**
- Stack of delivery slips from last night
- Snap a photo or scan PDF of each invoice
- AI extracts: vendor, invoice #, date, due date, line items, totals
- Match against open POs (2-way match: PO qty vs invoice qty)
- Flag price variances: "Sysco raised Romaine from $24.50 to $28.00 (+14%)"
- Approve or dispute

**Extraction fields:**
- Header: vendor name, invoice number, invoice date, due date, subtotal, tax, total
- Line items: description, quantity, unit, unit price, line total
- Entity resolution: fuzzy-match vendor name to known vendors, item descriptions to catalog

**Price variance detection:**
- Compare each line item against last known price
- Flag increases > 5% as warnings, > 10% as alerts
- Track price trends per item per vendor over time

**PO matching logic:**
- Match by vendor + date window + line-item fuzzy match
- Score: full match (all lines match qty + price), partial (some lines off), exception (no match)
- Common variances: substitutions, partial deliveries, price adjustments

**AP aging buckets:** Current, 1-30 days, 31-60 days, 61-90 days, 90+ days

**CarabinerOS differentiator:** xtraCHEF charges $200/month/location for OCR. Claude's vision API does it in one call.

**What the skill teaches the AI:**
- Extract invoice data from photos/PDFs via vision
- Match invoices to purchase orders
- Flag price variances with specific dollar/percentage impacts
- Track AP aging
- Update item prices from invoice line items (keeps price database current)

**Output format:** Extracted invoice summary, PO match results, price alerts, AP aging report.

---

### Skill 8: Marketing Coordinator

**Purpose:** Plan campaigns, generate content, and track marketing across channels.

**Core Knowledge to Encode:**

**The restaurant marketing reality:**
- Alinea Group has a dedicated marketing team. Most restaurants? The chef-owner does it at 11pm after service.
- This skill makes that 11pm moment take 30 seconds
- Instagram is the dominant restaurant channel in 2026
- AI content generation is table stakes — every platform offers it now
- Triggered automations (post-visit, win-back, birthday) outperform manual campaigns

**Campaign lifecycle:** Research → Drafting → Review → Live → Completed

**Channels:** Instagram, Facebook, TikTok, Email, SMS, Events, Google Business

**AI-powered campaign creation:**
- Input: brief ("Promote our new spring menu")
- Output: channel-appropriate copy, hashtag suggestions, posting time recommendation
- Context-aware: knows menu (promote Stars, not Dogs), inventory (don't promote sold-out items), food cost (push high-margin dishes)

**Proactive intelligence:**
- Competition watching: what are nearby restaurants posting?
- Trend monitoring: food trends on Instagram/TikTok, seasonal moments, food holidays
- Automatic suggestions: "National Taco Day is next Tuesday — want me to draft a special?"
- Menu-aware: "Your lamb dish is a Star — let's promote it"

**Content calendar:** Weekly view of scheduled posts across channels

**Review management:** Aggregate Google/Yelp reviews, draft AI responses, human approves

**What the skill teaches the AI:**
- Generate restaurant-specific social media content
- Plan weekly content calendars
- Draft review responses
- Suggest campaigns based on menu performance and seasonal trends
- Track campaign stages through the pipeline

**Output format:** Campaign briefs, social media copy, content calendar, review responses.

---

### Skill 9: Kitchen Expo (Action Card Protocol)

**Purpose:** Assess operational changes and decide what needs the chef's attention.

**Core Knowledge to Encode:**

**The expo window concept:**
In a professional kitchen, the expo (expéditer) is the last quality checkpoint before food reaches the guest. They inspect every plate, ensure timing, and call out issues. This skill makes the AI act as a digital expo — inspecting every operational change and deciding what deserves the chef's attention.

**Card types:**
| Type | When | Example |
|------|------|---------|
| Urgent | Time-sensitive, has a real deadline | Vendor cutoff in 2hrs, service-blocking shortage |
| Action | Needs chef review/approval | New order to approve, price change over threshold |
| Update | Informational, chef should know | Prep list updated, recipe cost recalculated |
| Info | Background context | Inventory count logged, invoice matched |

**Priority levels:**
- 2 (Critical): deadline within 4 hours, or blocking service
- 1 (Today): deadline today, affects today's operations
- 0 (Normal): no time pressure

**What NOT to surface:**
- Typo fixes, minor edits
- Read-only queries
- Changes the chef said "just do it" about
- Duplicate of an already-surfaced issue

**Writing style:** Like a kitchen ticket — short, specific, actionable.
- Good: "Produce order drafted — Coastal #4821, 18 items, $2,847"
- Bad: "A new purchase order has been created for your review"

**What the skill teaches the AI:**
- Assess every operational change for urgency and importance
- Format notifications in restaurant language
- Include specific numbers (dollars, quantities, percentages)
- Set real deadlines only when they exist externally
- Prioritize by service impact

**Output format:** Structured notification with type, priority, summary, details, deadline.

---

### Skill 10: Daily Briefing

**Purpose:** Morning operational summary — everything the GM needs in 60 seconds.

**Core Knowledge to Encode:**

**The morning walk-through:**
At 6am, the GM needs to know:
1. **Yesterday's numbers:** Revenue, food cost %, labor %, prime cost %
2. **Today's covers:** Expected guest count, any large parties, special events
3. **Inventory alerts:** Items below par, items 86'd, waste from yesterday
4. **Orders status:** What's being delivered today, what needs to be ordered
5. **Prep status:** Is prep on track? Any shortages or blocked items?
6. **AP status:** Invoices due this week, outstanding balance
7. **Marketing:** Any campaigns going live today, reviews needing response

**The P&L snapshot:**
```
Revenue:        $8,420
Food Cost:      $2,526 (30.0%)
Labor:          $2,274 (27.0%)
Prime Cost:     $4,800 (57.0%)
Budget Var:     -$834 (over)
```

**Weekly trend context:**
- Food cost trending up or down vs last week
- Revenue pace vs budget
- Waste trend

**What the skill teaches the AI:**
- Compile cross-module summary from available data
- Lead with the most actionable item (biggest problem or opportunity)
- Include specific numbers — never vague language
- Flag anything that needs a decision today
- Keep it under 60 seconds of reading time

**Output format:** Structured morning briefing with P&L snapshot, alerts, and action items.

---

## The Claude Code / OpenClaw Plugin

### Plugin Structure

```
carabiner-kitchen-skills/
├── CLAUDE.md                    # Plugin instructions for Claude Code
├── README.md                    # Gumroad listing / GitHub README
├── LICENSE                      # MIT or similar
├── package.json                 # For npm distribution (optional)
├── .claude/
│   └── skills/
│       ├── food-cost-tracker/
│       │   └── SKILL.md
│       ├── menu-engineering/
│       │   └── SKILL.md
│       ├── prep-list-generator/
│       │   └── SKILL.md
│       ├── inventory-manager/
│       │   └── SKILL.md
│       ├── recipe-costing/
│       │   └── SKILL.md
│       ├── purchase-order-builder/
│       │   └── SKILL.md
│       ├── invoice-processor/
│       │   └── SKILL.md
│       ├── marketing-coordinator/
│       │   └── SKILL.md
│       ├── kitchen-expo/
│       │   └── SKILL.md
│       └── daily-briefing/
│       │   └── SKILL.md
│       └── carabiner-kitchen/       # Meta-skill that loads all others
│           └── SKILL.md
├── templates/                   # Reusable output templates
│   ├── daily-cost-entry.md
│   ├── menu-matrix.md
│   ├── prep-list.md
│   ├── inventory-count.md
│   ├── purchase-order.md
│   ├── invoice-summary.md
│   └── morning-briefing.md
└── examples/                    # Example interactions
    ├── food-cost-session.md
    ├── menu-analysis-session.md
    └── morning-routine-session.md
```

### SKILL.md Format (OpenClaw / Claude Code compatible)

Each skill file follows this format:

```markdown
---
name: <skill-name>
description: <one-line description>
version: 1.0.0
author: Chef Esteban / CarabinerOS
tags: [restaurant, kitchen, operations, <module>]
---

# <Skill Name>

## When to Use
<trigger conditions — when should this skill activate?>

## Context
<what the AI needs to know about restaurant operations for this skill>

## Instructions
<step-by-step instructions for the AI>

## Output Format
<how to structure the response>

## Examples
<example inputs and outputs>
```

### CLAUDE.md (Plugin Root)

The root CLAUDE.md should:
- Introduce the skill pack: "You now have restaurant operations expertise from a Michelin-trained chef"
- List all 10 skills with trigger phrases
- Set the tone: "Talk like a seasoned GM — confident, direct, no corporate jargon"
- Define shared terminology (86, covers, COGS, CM, par, mise en place, etc.)
- Reference templates for consistent output formatting

### Meta-Skill: `carabiner-kitchen`

A master skill that:
- Loads all 10 skills into context
- Routes requests to the right skill based on intent
- Handles cross-module queries ("What should I order based on my prep list and inventory?")
- Provides the morning briefing by combining data from all modules

---

## Tone & Voice Guidelines

The skills should make the AI sound like:
- A sous chef who went to business school, not a consultant who read about kitchens
- Direct, specific, numbers-first ("Your food cost is 32.1%, 2.1 points over target" not "Your food cost appears to be slightly elevated")
- Uses kitchen language naturally: 86, covers, the pass, mise en place, fire, behind, heard
- Never says "I don't have access to that data" — works with what's provided
- Frames everything in terms of making or losing money

**Avoid:**
- Corporate restaurant jargon ("optimize your culinary operations")
- Vague recommendations ("consider reviewing your pricing strategy")
- Over-qualifying ("it might be worth looking into potentially adjusting...")
- Treating the operator like they don't know their own kitchen

---

## Packaging & Distribution

### Gumroad Product
- **Price:** $49 (matches market, but dramatically more value)
- **Name:** "Carabiner Kitchen Skills — Restaurant Ops for Claude Code & OpenClaw"
- **Tagline:** "The restaurant management brain your AI assistant was missing. Written by a Michelin-trained chef, not a prompt engineer."
- **Includes:** 10 skills, meta-plugin, templates, examples, CLAUDE.md
- **Format:** ZIP download, drop into any Claude Code / OpenClaw project

### README Copy Direction
- Lead with credibility: "Built by a chef who tracked food cost for 153 weeks at a Michelin restaurant"
- Show the 10 skills with one-line descriptions
- Include 2-3 example interactions that make operators go "that's exactly how I think about this"
- Compare to the $49 competitor: "They researched restaurant ops. We lived it."
- CTA: "Drop it in your `.claude/skills/` directory and start talking to your kitchen"

---

## Implementation Order

1. **CLAUDE.md** — the root plugin file that sets the tone and lists skills
2. **Skill 1: Food Cost Tracker** — the most immediately useful, validates the format
3. **Skill 2: Menu Engineering** — second-most useful, demonstrates depth
4. **Skill 10: Daily Briefing** — shows the cross-module vision
5. **Skills 3-9** — build out remaining skills
6. **Meta-skill: carabiner-kitchen** — router that ties everything together
7. **Templates** — consistent output formatting
8. **Examples** — real interaction samples
9. **README + Gumroad listing** — packaging and copy

---

## Quality Bar

Each skill must:
- [ ] Contain at least one formula or calculation (not just vibes)
- [ ] Include real restaurant terminology used correctly
- [ ] Have a specific output format with a template
- [ ] Handle the "6am GM" use case — quick, actionable, numbers-first
- [ ] Be useful standalone (no dependency on other skills)
- [ ] Work with manual data entry (no database required)
- [ ] Include at least 2 example interactions
- [ ] Sound like a chef wrote it, not a developer

---

## What NOT to Build

- No database, no API, no server — these are prompt-based skills only
- No web UI — the AI assistant IS the interface
- No POS integration — manual data entry is the v1 path
- No multi-tenant anything — this is for a single operator at a time
- Don't over-engineer the routing — the meta-skill is a simple intent classifier
- Don't add features the operator didn't ask for — stay focused on the 10 modules
