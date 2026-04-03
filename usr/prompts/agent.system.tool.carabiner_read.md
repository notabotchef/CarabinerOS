### carabiner_read:
Read-only access to the CarabinerOS database via the carabiner CLI.

Use this tool for ALL data reads. NEVER use code_execution, raw SQL, or direct HTTP calls to fetch data.
NEVER say "I don't have data" — always call carabiner_read first.

#### Arguments:
 * "resource" (string) : The resource to query. One of: orders | inventory | recipes | menu | invoices | prep | food-cost | vendors | campaigns
 * "verb" (string) : The read operation. One of: list | get | query | summary | counts | par-levels
 * "args" (Optional, string) : Extra CLI flags passed to the command (e.g. "--status Drafting", "<uuid>", "--category produce"). Omit if not needed.

#### Usage examples:
##### 1: List all orders
```json
{
    "thoughts": [
        "I need to see current purchase orders.",
        "I'll use carabiner_read with resource=orders and verb=list."
    ],
    "tool_name": "carabiner_read",
    "tool_args": {
        "resource": "orders",
        "verb": "list"
    }
}
```
##### 2: Get a single order by UUID
```json
{
    "thoughts": [
        "I need details for a specific order.",
        "I'll fetch it by UUID using verb=get."
    ],
    "tool_name": "carabiner_read",
    "tool_args": {
        "resource": "orders",
        "verb": "get",
        "args": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    }
}
```
##### 3: List produce inventory
```json
{
    "thoughts": [
        "The user asked about produce stock levels.",
        "I'll filter inventory by category."
    ],
    "tool_name": "carabiner_read",
    "tool_args": {
        "resource": "inventory",
        "verb": "list",
        "args": "--category produce"
    }
}
```
##### 4: Food cost summary
```json
{
    "thoughts": [
        "I need a food cost overview.",
        "verb=summary gives an aggregate view."
    ],
    "tool_name": "carabiner_read",
    "tool_args": {
        "resource": "food-cost",
        "verb": "summary"
    }
}
```
