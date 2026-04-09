# carabiner CLI Reference

The `carabiner` command is your interface to the CarabinerOS PostgreSQL database.
Run it via code_execution. Always pass `--json` for structured output.

## Grammar

```
carabiner <resource> <verb> [options] [--json]
```

## Resources & Commands

### orders
```bash
# Read
carabiner orders list [--location-id UUID] [--status draft|submitted|delivered] --json
carabiner orders get <uuid> --json

# Write
carabiner orders create --location-id UUID --vendor "US Foods" [--channel manual] [--total 0.00] [--line-items 'JSON_ARRAY'] --json
carabiner orders update <uuid> [--vendor NAME] [--status STATUS] [--total AMT] [--eta ETA] [--summary TEXT] [--line-items 'JSON_ARRAY'] --json
carabiner orders delete <uuid> --json
```

### inventory
```bash
# Read
carabiner inventory list [--location-id UUID] [--category produce|protein|dairy|dry] --json
carabiner inventory get <uuid> --json
carabiner inventory valuation [--location-id UUID] --json
carabiner inventory counts [--location-id UUID] --json

# Write
carabiner inventory create --location-id UUID --item-name "Jamón Ibérico" --on-hand "6 lb" --par "12 lb" --variance Low [--unit lb] [--category protein] [--storage-area "Walk-in 1"] [--unit-cost "$65.00/lb"] --json
carabiner inventory update <uuid> [--on-hand QTY] [--par QTY] [--variance OK|Low|Critical] [--unit-cost COST] [--category CAT] --json
carabiner inventory delete <uuid> --json
```

### recipes
```bash
# Read
carabiner recipes list [--location-id UUID] [--status draft|active|archived] [--category CAT] [--search TERM] --json
carabiner recipes get <uuid> --json          # includes components, ingredients, steps

# Write
carabiner recipes create --location-id UUID --name "Romesco Sauce" --category Sauces [--status draft] [--yield-qty 2.0] [--yield-unit liters] [--description TEXT] [--components 'JSON_ARRAY'] --json
carabiner recipes update <uuid> [--name NAME] [--status active] [--category CAT] [--yield-qty N] [--yield-unit UNIT] [--description TEXT] [--components 'JSON_ARRAY'] --json
carabiner recipes delete <uuid> --json
```

### menu
```bash
# Read
carabiner menu list [--location-id UUID] [--category CAT] --json
carabiner menu get <uuid> --json

# Write
carabiner menu create --location-id UUID --item-name "Patatas Bravas" --category Starters [--price 14.00] [--food-cost 4.20] [--performance Star] [--margin-pct "70%"] [--recommendation "Promote"] [--recipe-id UUID] --json
carabiner menu update <uuid> [--price AMT] [--food-cost AMT] [--food-cost-pct PCT] [--is-86/--no-86] [--performance Star|Puzzle|Plowhorse|Dog] [--recommendation TEXT] [--recipe-id UUID] --json
carabiner menu delete <uuid> --json
```

### invoices
```bash
# Read
carabiner invoices list [--location-id UUID] [--status pending|approved|paid] --json
carabiner invoices get <uuid> --json

# Write
carabiner invoices create --location-id UUID --vendor-name "US Foods" [--invoice-number INV-001] [--invoice-date 2026-03-31] [--due-date 2026-04-15] [--status pending] [--subtotal AMT] [--tax AMT] [--total AMT] [--line-items 'JSON_ARRAY'] --json
carabiner invoices update <uuid> [--vendor-name NAME] [--status STATUS] [--total AMT] [--line-items 'JSON_ARRAY'] --json
carabiner invoices delete <uuid> --json
```

### prep
```bash
# Read
carabiner prep list [--location-id UUID] [--station grill|pantry|pastry] --json
carabiner prep get <uuid> --json

# Write
carabiner prep create --location-id UUID --task "Romesco sauce" --station grill [--service-lane Dinner] [--readiness "Not Started"] [--shortage "Need roasted peppers"] --json
carabiner prep update <uuid> [--readiness Ready|"Not Started"|Blocked] [--shortage DESC] [--station STATION] [--service-lane LANE] --json
carabiner prep delete <uuid> --json
```

### food-cost
```bash
# Read
carabiner food-cost list [--location-id UUID] [--pressure low|medium|high] --json
carabiner food-cost get <uuid> --json
carabiner food-cost summary [--location-id UUID] --json
```

### vendors
```bash
# Read
carabiner vendors list [--json]
carabiner vendors get <uuid> --json
```

## Output Format

### Success (stdout)
```json
{"orders": [{"id": "uuid", "vendor": "US Foods", "status": "draft", "total": 1234.56}], "count": 1}
```

### Error (stderr)
```json
{"error": {"code": 2, "message": "Order abc123 not found", "type": "not_found"}}
```

## Exit Codes
- 0 = success
- 1 = database error (connection, query failure)
- 2 = not found
- 3 = validation error (bad UUID, missing required field)
- 5 = internal error

## Tips
- Always use `--json` when running commands — it gives you structured data to work with.
- Use `--dry-run` on create/update/delete to preview without writing to the database.
- Filter lists with `--status`, `--category`, `--pressure`, `--station` to reduce output.
- UUIDs are required for get/update/delete operations. Get them from a list command first.
- The `food-cost summary` command gives pressure distribution across all menu items.
- For `--line-items` and `--components`, pass a JSON string: `--line-items '[{"item": "Avocados", "qty": "2 cases", "price": "$45.00"}]'`
