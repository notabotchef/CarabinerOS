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
carabiner orders list [--location-id UUID] [--status draft|submitted|delivered] --json
carabiner orders get <uuid> --json
carabiner orders create --location-id UUID --vendor "US Foods" [--channel manual] [--total 0.00] --json
carabiner orders delete <uuid> --json
```

### inventory
```bash
carabiner inventory list [--location-id UUID] [--category produce|protein|dairy|dry] --json
carabiner inventory get <uuid> --json
carabiner inventory valuation [--location-id UUID] --json
carabiner inventory counts [--location-id UUID] --json
```

### recipes
```bash
carabiner recipes list [--location-id UUID] --json
carabiner recipes get <uuid> --json          # includes components, ingredients, steps
carabiner recipes delete <uuid> --json
```

### menu
```bash
carabiner menu list [--location-id UUID] --json
carabiner menu get <uuid> --json
carabiner menu delete <uuid> --json
```

### invoices
```bash
carabiner invoices list [--location-id UUID] [--status pending|approved|paid] --json
carabiner invoices get <uuid> --json
carabiner invoices delete <uuid> --json
```

### prep
```bash
carabiner prep list [--location-id UUID] [--station grill|pantry|pastry] --json
carabiner prep get <uuid> --json
carabiner prep delete <uuid> --json
```

### food-cost
```bash
carabiner food-cost list [--location-id UUID] [--pressure low|medium|high] --json
carabiner food-cost get <uuid> --json
carabiner food-cost summary [--location-id UUID] --json
```

### vendors
```bash
carabiner vendors list [--location-id UUID] --json
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
- Use `--dry-run` on create/delete to preview without writing to the database.
- Filter lists with `--status`, `--category`, `--pressure`, `--station` to reduce output.
- UUIDs are required for get/delete operations. Get them from a list command first.
- The `food-cost summary` command gives pressure distribution across all menu items.
