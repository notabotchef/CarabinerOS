"""Recipe creation/management tool — create and update Modernist Cuisine recipes.

Uses Agent Zero's LLM to convert natural language descriptions into structured
recipe data with components, ingredients (weights/percentages), and steps
(temps/durations/techniques).
"""

from __future__ import annotations

import json
from helpers.tool import Response, Tool

RECIPE_GENERATION_PROMPT = """\
You are a Modernist Cuisine recipe expert. Convert the following recipe description
into a precise, structured JSON format. Return ONLY valid JSON, no other text.

The recipe should follow Modernist Cuisine conventions:
- All weights in grams
- Baker's percentages where applicable (largest ingredient = 100%)
- Precise temperatures (Celsius preferred, include Fahrenheit)
- Exact times
- Professional technique names

Return this exact structure:
{
  "name": "string — professional recipe name, title case",
  "category": "string — one of: Bread, Pastry, Entreé, Appetizer, Sauce, Dessert, Beverage, Sous Vide, Fermentation, Base/Stock, Garnish, Other",
  "description": "string — 1-2 sentence professional description",
  "yield_quantity": number,
  "yield_unit": "string — servings, pieces, grams, liters, etc.",
  "equipment": ["list of required equipment"],
  "tags": ["list of relevant tags"],
  "components": [
    {
      "name": "string — component name (e.g., 'Dough', 'Filling', 'Glaze')",
      "sort_order": number,
      "yield_quantity": number_or_null,
      "yield_unit": "string_or_null",
      "ingredients": [
        {
          "name": "string — ingredient name",
          "weight_g": number,
          "percentage": number_or_null,
          "unit_display": "g",
          "sort_order": number,
          "notes": "string_or_null — prep notes like 'diced', 'room temp', etc."
        }
      ],
      "steps": [
        {
          "step_number": number,
          "instruction": "string — clear, professional instruction",
          "temperature": "string_or_null — e.g., '180°C / 356°F'",
          "duration": "string_or_null — e.g., '25 minutes'",
          "technique": "string_or_null — e.g., 'Sous vide', 'Sauté', 'Fold'"
        }
      ]
    }
  ]
}

If weights are not specified in the description, estimate professional quantities.
Calculate baker's percentages based on the primary ingredient (flour for baked goods,
main protein for entreés, etc.).
"""


class RecipeTool(Tool):
    async def execute(self, **kwargs) -> Response:
        try:
            return await self._run()
        except Exception as e:
            return Response(message=f"Error in recipe tool: {e}", break_loop=False)

    async def _run(self) -> Response:
        from carabiner.db import repositories as repo

        method = self.args.get("method", "list")
        location_id = self.args.get("location_id")

        # ----- list -----
        if method == "list":
            recipes = await repo.list_recipes(location_id)
            if not recipes:
                return Response(message="No recipes found.", break_loop=False)
            result = [
                {
                    "id": str(r.id),
                    "name": r.name,
                    "category": r.category,
                    "status": r.status,
                    "description": r.description,
                    "source": r.source,
                }
                for r in recipes
            ]
            return Response(
                message=json.dumps(result, indent=2),
                break_loop=False,
                additional={"module": "recipes", "action": "list"},
            )

        # ----- get -----
        if method == "get":
            recipe_id = self.args.get("recipe_id")
            if not recipe_id:
                return Response(message="Error: recipe_id is required.", break_loop=False)
            r = await repo.get_recipe(recipe_id)
            if not r:
                return Response(message=f"Recipe {recipe_id} not found.", break_loop=False)
            components = []
            for comp in (r.components or []):
                ingredients = [
                    {
                        "name": ing.name,
                        "weight_g": float(ing.weight_g),
                        "percentage": float(ing.percentage) if ing.percentage else None,
                        "notes": ing.notes,
                    }
                    for ing in (comp.ingredients or [])
                ]
                steps = [
                    {
                        "step_number": s.step_number,
                        "instruction": s.instruction,
                        "temperature": s.temperature,
                        "duration": s.duration,
                        "technique": s.technique,
                    }
                    for s in (comp.steps or [])
                ]
                components.append({
                    "name": comp.name,
                    "ingredients": ingredients,
                    "steps": steps,
                })
            return Response(
                message=json.dumps({
                    "id": str(r.id),
                    "name": r.name,
                    "category": r.category,
                    "status": r.status,
                    "description": r.description,
                    "yield_quantity": float(r.yield_quantity) if r.yield_quantity else None,
                    "yield_unit": r.yield_unit,
                    "equipment": r.equipment,
                    "tags": r.tags,
                    "components": components,
                }, indent=2),
                break_loop=False,
            )

        # ----- create (natural language -> structured recipe) -----
        if method == "create":
            return await self._create_recipe()

        # ----- update -----
        if method == "update":
            recipe_id = self.args.get("recipe_id")
            updates = self.args.get("updates", {})
            if not recipe_id:
                return Response(message="Error: recipe_id is required.", break_loop=False)
            r = await repo.update_recipe(recipe_id, updates)
            if not r:
                return Response(message=f"Recipe {recipe_id} not found.", break_loop=False)
            return Response(
                message=f"Recipe '{r.name}' updated successfully.",
                break_loop=False,
                additional={"module": "recipes", "action": "update", "item_id": str(r.id)},
            )

        # ----- activate -----
        if method == "activate":
            recipe_id = self.args.get("recipe_id")
            if not recipe_id:
                return Response(message="Error: recipe_id is required.", break_loop=False)
            r = await repo.update_recipe(recipe_id, {"status": "active"})
            if not r:
                return Response(message=f"Recipe {recipe_id} not found.", break_loop=False)
            return Response(
                message=f"Recipe '{r.name}' is now active.",
                break_loop=False,
                additional={"module": "recipes", "action": "activate", "item_id": str(r.id)},
            )

        # ----- archive -----
        if method == "archive":
            recipe_id = self.args.get("recipe_id")
            if not recipe_id:
                return Response(message="Error: recipe_id is required.", break_loop=False)
            r = await repo.update_recipe(recipe_id, {"status": "archived"})
            if not r:
                return Response(message=f"Recipe {recipe_id} not found.", break_loop=False)
            return Response(
                message=f"Recipe '{r.name}' has been archived.",
                break_loop=False,
                additional={"module": "recipes", "action": "archive", "item_id": str(r.id)},
            )

        # ----- delete -----
        if method == "delete":
            recipe_id = self.args.get("recipe_id")
            if not recipe_id:
                return Response(message="Error: recipe_id is required.", break_loop=False)
            deleted = await repo.delete_recipe(recipe_id)
            if not deleted:
                return Response(message=f"Recipe {recipe_id} not found.", break_loop=False)
            return Response(
                message=f"Recipe {recipe_id} deleted.",
                break_loop=False,
                additional={"module": "recipes", "action": "delete"},
            )

        return Response(
            message=f"Unknown method: {method}. Use list, get, create, update, activate, archive, or delete.",
            break_loop=False,
        )

    # ------------------------------------------------------------------
    # Create: LLM-powered recipe generation from natural language
    # ------------------------------------------------------------------

    async def _create_recipe(self) -> Response:
        from carabiner.db import repositories as repo
        from langchain.schema import HumanMessage, SystemMessage

        description = self.args.get("description", "")
        location_id = self.args.get("location_id")

        if not description:
            return Response(
                message="Error: description is required for create.",
                break_loop=False,
            )

        if not location_id:
            return Response(
                message="Error: location_id is required for create.",
                break_loop=False,
            )

        # Ask the LLM to generate a structured recipe
        messages = [
            SystemMessage(content=RECIPE_GENERATION_PROMPT),
            HumanMessage(content=f"Create a detailed Modernist Cuisine recipe for:\n\n{description}"),
        ]

        try:
            response, _reasoning = await self.agent.call_chat_model(
                messages=messages,
                explicit_caching=False,
            )
            structured = self._parse_response(str(response))
        except Exception as e:
            return Response(
                message=f"Failed to generate recipe: {e}",
                break_loop=False,
            )

        if "parse_error" in structured:
            return Response(
                message=f"Failed to parse generated recipe. Raw output saved as notes.",
                break_loop=False,
            )

        # Build the recipe data for the repository
        recipe_data = {
            "location_id": location_id,
            "name": structured.get("name", "Untitled Recipe"),
            "category": structured.get("category", "Other"),
            "description": structured.get("description", description),
            "status": "draft",
            "source": "llm",
            "yield_quantity": structured.get("yield_quantity"),
            "yield_unit": structured.get("yield_unit"),
            "equipment": structured.get("equipment", []),
            "tags": structured.get("tags", []),
            "components": structured.get("components", []),
        }

        recipe = await repo.create_recipe(recipe_data)

        return Response(
            message=json.dumps({
                "status": "created",
                "recipe_id": str(recipe.id),
                "name": recipe.name,
                "category": recipe.category,
                "components_count": len(structured.get("components", [])),
                "note": "Draft recipe created. Review and edit in the Recipes module.",
            }, indent=2),
            break_loop=False,
            additional={
                "module": "recipes",
                "action": "create",
                "item_id": str(recipe.id),
            },
        )

    def _parse_response(self, raw: str) -> dict:
        """Parse LLM response into a dict, tolerating markdown fences."""
        text = raw.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                try:
                    return json.loads(text[start:end])
                except json.JSONDecodeError:
                    pass
            return {"raw_text": raw, "parse_error": True}
