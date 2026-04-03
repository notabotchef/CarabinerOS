### carabiner_write:
Write operations (create, update, delete) against the CarabinerOS database via the carabiner CLI.

Use this tool for ALL data writes. NEVER use code_execution or raw SQL to modify data.

This tool automatically:
 - Injects --chat-context so the record links to this conversation
 - Fires an action card notification on the chef's dashboard
 - Returns the created/updated record as JSON

IMPORTANT: Before creating any record, you MUST have a real location_id.
Use carabiner_read(resource="orders", verb="list") (or any resource) to obtain the location_id from existing records. NEVER invent a UUID.

#### Arguments:
 * "resource" (string) : The resource to modify. One of: orders | inventory | recipes | menu | invoices | prep | food-cost | vendors | campaigns
 * "verb" (string) : The write operation. One of: create | update | delete
 * "args" (string) : CLI flags for the operation. Required — must include all mandatory fields for the verb.

#### Usage examples:
##### 1: Create a new purchase order
```json
{
    "thoughts": [
        "I need to create an order for US Foods.",
        "I already have the location_id from a prior carabiner_read call.",
        "I'll use carabiner_write with verb=create."
    ],
    "tool_name": "carabiner_write",
    "tool_args": {
        "resource": "orders",
        "verb": "create",
        "args": "--location-id a1b2c3d4-e5f6-7890-abcd-ef1234567890 --vendor 'US Foods' --channel email"
    }
}
```
##### 2: Update inventory on-hand count
```json
{
    "thoughts": [
        "The chef confirmed the tomato count. I'll update inventory.",
        "I have the item UUID from a prior carabiner_read call."
    ],
    "tool_name": "carabiner_write",
    "tool_args": {
        "resource": "inventory",
        "verb": "update",
        "args": "b2c3d4e5-f6a7-8901-bcde-f12345678901 --on-hand 24"
    }
}
```
##### 3: Delete an order
```json
{
    "thoughts": [
        "The user asked me to cancel and delete order xyz.",
        "I'll use verb=delete with the order UUID."
    ],
    "tool_name": "carabiner_write",
    "tool_args": {
        "resource": "orders",
        "verb": "delete",
        "args": "c3d4e5f6-a7b8-9012-cdef-123456789012"
    }
}
```
