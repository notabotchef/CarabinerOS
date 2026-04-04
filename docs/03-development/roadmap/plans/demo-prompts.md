# CarabinerOS Demo Prompts

> Date: 2026-03-20
> Demo: 2026-03-21

## Prompt 1 — Read + Intelligence (inventory report)
Shows: tool use, formatted markdown response, data parsing

> What inventory items are below par right now?

Expected behavior:
- Agent uses `inventory_tool` to query all items
- Identifies Avocados (-6 cases) and Burrata (-4 tubs) as below par
- Chicken stock (+3 qt) is above par
- Formats a clean report with recommendations

## Prompt 2 — Write via MCP (add inventory)
Shows: MCP database write, new carabiner-db tools

> Add 5# of chives to the inventory

Expected behavior:
- Agent uses `carabiner-db.inventory_create` MCP tool
- Creates a new inventory record: item_name="Chives", on_hand="5", unit="lb"
- Confirms the addition with the new item details

## Prompt 3 — Multi-step delegation (operational briefing)
Shows: GM → AGM delegation, multi-tool orchestration, agent hierarchy

> Give me a full operational briefing for tonight's service

Expected behavior:
- GM checks inventory (below par alerts)
- Checks prep status (what's ready, what's blocked)
- Checks pending orders
- Reviews food cost trends
- Synthesizes into a briefing with action items
- May delegate to AGM for deeper analysis

## Prompt 4 — Order creation (tool chaining)
Shows: intelligence + write capability

> Draft a produce order for everything below par

Expected behavior:
- Agent reads inventory, identifies items below par
- Calculates quantities needed (par - on_hand)
- Creates order via MCP tools
- Presents order for approval

## Prompt 5 — Recipe costing (read + calculation)
Shows: recipe tool, data analysis

> What's the cost breakdown for our recipes?

Expected behavior:
- Agent uses `recipe_tool` to fetch all recipes
- Analyzes ingredient costs
- Identifies highest/lowest margin items

## Testing Notes
- Test each prompt in CarabinerOS (localhost:3000) AND Agent Zero native UI (localhost:8080)
- Compare: formatting, step visibility, response quality
- Check: ThoughtsStream appears during processing
- Check: ExpoBar shows real headline (not joke)
- Check: Inline ticket expands after response
- Check: No duplicate responses
- Check: Markdown renders properly (bullets, bold, headers)
