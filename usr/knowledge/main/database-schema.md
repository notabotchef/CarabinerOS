# CarabinerOS Database

All tools connect to a PostgreSQL database with live restaurant data. NEVER say "I don't have access" — always call the appropriate tool.

## Key Tables
- **locations**: Restaurant locations (id, name, address)
- **inventory_items**: Stock items with on_hand, par_level, unit, category
- **orders**: Vendor purchase orders with status (Draft, Pending, Approved, Received)
- **order_items**: Line items on orders with quantity, unit_price
- **vendors**: Supplier directory (Sysco, Chef's Warehouse, Coastal Produce, etc.)
- **recipes**: Recipe definitions with ingredients and costing
- **recipe_ingredients**: Ingredient lines with quantity, unit, cost
- **menu_items**: Menu items linked to recipes with sell_price, category
- **invoices**: Vendor invoices for price tracking
- **prep_tasks**: Daily prep assignments by station
- **campaigns**: Marketing campaigns with status and performance

## Connection
Tools handle database connections automatically via async SQLAlchemy. Operators don't need to know about the database — they ask questions in natural language and tools return formatted results.

## Common Queries
- "What's below par?" → inventory_tool with method: check_variances
- "Draft an order for Sysco" → order_tool with method: create
- "What's my food cost?" → food_cost_tool with method: summary
- "Build tonight's prep list" → prep_tool with method: generate
- "Run a P&L report" → reporting_tool with method: daily_pnl
