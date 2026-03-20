## Tool: recipe_tool

Manages Modernist Cuisine recipes — create from natural language, list, update, activate, archive, and delete.

### Methods

**list** — List all recipes
```json
{
  "method": "list",
  "location_id": "optional-uuid"
}
```
Returns: Array of recipes with name, category, status, description, source.

**get** — Get full recipe details including components, ingredients, and steps
```json
{
  "method": "get",
  "recipe_id": "uuid-of-recipe"
}
```
Returns: Complete recipe with nested components, ingredients (weights, percentages), and steps (temps, durations, techniques).

**create** — Create a new recipe from a natural language description
```json
{
  "method": "create",
  "location_id": "uuid-of-location",
  "description": "Duck confit with orange glaze, sous vide at 155°F for 36 hours, served with roasted root vegetables and a citrus gastrique"
}
```
The tool uses the LLM to convert the description into a structured Modernist Cuisine recipe with:
- Precise weights in grams
- Baker's percentages
- Professional technique names
- Temperature and duration for each step
- Equipment requirements

The recipe is created as a **draft** for review and editing in the Recipes module.

**update** — Update recipe fields
```json
{
  "method": "update",
  "recipe_id": "uuid-of-recipe",
  "updates": {
    "name": "New Name",
    "category": "Entreé",
    "description": "Updated description",
    "status": "active",
    "components": []
  }
}
```

**activate** — Set recipe status to active
```json
{
  "method": "activate",
  "recipe_id": "uuid-of-recipe"
}
```

**archive** — Archive a recipe
```json
{
  "method": "archive",
  "recipe_id": "uuid-of-recipe"
}
```

**delete** — Permanently delete a recipe
```json
{
  "method": "delete",
  "recipe_id": "uuid-of-recipe"
}
```

### When to use this tool

Use `recipe_tool` when the user:
- Asks to create, write, or develop a recipe (use **create** with their description)
- Asks to see or list recipes (use **list** or **get**)
- Asks to modify, update, or change a recipe (use **update**)
- Asks to activate, publish, or make a recipe live (use **activate**)
- Asks to archive or retire a recipe (use **archive**)
- Asks to delete or remove a recipe (use **delete**)

### Workflow
1. User describes a dish or recipe idea in natural language
2. Call **create** with the description — the LLM generates a full Modernist Cuisine recipe
3. Recipe appears as a draft in the Recipes module for review
4. User can edit in the UI or ask you to **update** specific fields
5. When satisfied, call **activate** to make the recipe live

### Status values
- `draft` — Created but not yet finalized, can be freely edited
- `active` — Finalized and in use, shown to kitchen staff
- `archived` — No longer in active use, kept for reference
