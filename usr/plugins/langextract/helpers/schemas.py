"""
Restaurant-specific extraction schemas for langextract.
Each schema is a dict with 'prompt' and 'examples' keys ready for extract_structured().
"""

import langextract as lx

# ──────────────────────────────────────────────────────────────
# INVOICE EXTRACTION
# ──────────────────────────────────────────────────────────────

INVOICE_SCHEMA = {
    "prompt": (
        "Extract all line items from this food service invoice or delivery ticket. "
        "For each item, identify the product name, quantity, unit, unit price, "
        "and total price. Also extract vendor name, invoice number, date, and totals."
    ),
    "examples": [
        {
            "text": (
                "SYSCO FOODS\n"
                "Invoice #: INV-2026-04821\n"
                "Date: 03/28/2026\n"
                "Ship To: Roister Chicago\n\n"
                "Item                    Qty    Unit    Price     Total\n"
                "Prime Ribeye 109A       12     LB      $18.50   $222.00\n"
                "Baby Arugula            4      CS      $24.00   $96.00\n"
                "Kerrygold Butter        6      LB      $5.25    $31.50\n\n"
                "Subtotal: $349.50\n"
                "Tax: $0.00\n"
                "Total: $349.50"
            ),
            "extractions": [
                {
                    "extraction_class": "vendor",
                    "extraction_text": "SYSCO FOODS",
                    "attributes": {},
                },
                {
                    "extraction_class": "invoice_meta",
                    "extraction_text": "INV-2026-04821",
                    "attributes": {"date": "03/28/2026", "ship_to": "Roister Chicago"},
                },
                {
                    "extraction_class": "line_item",
                    "extraction_text": "Prime Ribeye 109A",
                    "attributes": {
                        "quantity": "12",
                        "unit": "LB",
                        "unit_price": "18.50",
                        "total": "222.00",
                    },
                },
                {
                    "extraction_class": "line_item",
                    "extraction_text": "Baby Arugula",
                    "attributes": {
                        "quantity": "4",
                        "unit": "CS",
                        "unit_price": "24.00",
                        "total": "96.00",
                    },
                },
                {
                    "extraction_class": "line_item",
                    "extraction_text": "Kerrygold Butter",
                    "attributes": {
                        "quantity": "6",
                        "unit": "LB",
                        "unit_price": "5.25",
                        "total": "31.50",
                    },
                },
                {
                    "extraction_class": "invoice_total",
                    "extraction_text": "$349.50",
                    "attributes": {"subtotal": "349.50", "tax": "0.00", "total": "349.50"},
                },
            ],
        }
    ],
}


# ──────────────────────────────────────────────────────────────
# RECIPE EXTRACTION
# ──────────────────────────────────────────────────────────────

RECIPE_SCHEMA = {
    "prompt": (
        "Extract all components from this recipe. Identify the recipe name, yield, "
        "each ingredient with quantity and unit, and each preparation step in order. "
        "Also extract any technique notes, temperatures, and timing."
    ),
    "examples": [
        {
            "text": (
                "Sauce Béarnaise\n"
                "Yield: 2 cups\n\n"
                "Reduction:\n"
                "- 1/4 cup white wine vinegar\n"
                "- 1/4 cup dry white wine\n"
                "- 1 tbsp minced shallots\n"
                "- 1 tsp cracked black pepper\n"
                "- 2 tbsp chopped fresh tarragon stems\n\n"
                "Sauce:\n"
                "- 3 egg yolks\n"
                "- 8 oz clarified butter, warm (145°F)\n"
                "- 1 tbsp chopped fresh tarragon leaves\n"
                "- Salt to taste\n"
                "- Pinch cayenne\n\n"
                "1. Combine reduction ingredients in saucepan. Reduce to 2 tbsp. Strain. Cool.\n"
                "2. Whisk yolks with reduction in double boiler until ribbon stage (145°F).\n"
                "3. Slowly stream in clarified butter while whisking constantly.\n"
                "4. Season with salt, cayenne, fold in tarragon leaves.\n"
                "5. Hold at 145°F. Use within 2 hours."
            ),
            "extractions": [
                {
                    "extraction_class": "recipe_meta",
                    "extraction_text": "Sauce Béarnaise",
                    "attributes": {"yield": "2 cups"},
                },
                {
                    "extraction_class": "ingredient",
                    "extraction_text": "white wine vinegar",
                    "attributes": {"quantity": "1/4", "unit": "cup", "component": "reduction"},
                },
                {
                    "extraction_class": "ingredient",
                    "extraction_text": "egg yolks",
                    "attributes": {"quantity": "3", "unit": "each", "component": "sauce"},
                },
                {
                    "extraction_class": "ingredient",
                    "extraction_text": "clarified butter",
                    "attributes": {
                        "quantity": "8",
                        "unit": "oz",
                        "component": "sauce",
                        "temp": "145°F",
                    },
                },
                {
                    "extraction_class": "step",
                    "extraction_text": "Combine reduction ingredients in saucepan. Reduce to 2 tbsp. Strain. Cool.",
                    "attributes": {"order": "1", "technique": "reduction"},
                },
                {
                    "extraction_class": "step",
                    "extraction_text": "Whisk yolks with reduction in double boiler until ribbon stage (145°F).",
                    "attributes": {"order": "2", "technique": "sabayon", "temp": "145°F"},
                },
            ],
        }
    ],
}


# ──────────────────────────────────────────────────────────────
# PREP LIST EXTRACTION
# ──────────────────────────────────────────────────────────────

PREP_LIST_SCHEMA = {
    "prompt": (
        "Extract all prep tasks from this prep list or production sheet. "
        "For each task, identify the item name, quantity needed, unit, "
        "assigned station or cook, and priority/deadline if mentioned."
    ),
    "examples": [
        {
            "text": (
                "PREP LIST — Friday 03/28/2026\n"
                "Station: Garde Manger (Miguel)\n\n"
                "- Pickled red onions: 2 qt (LOW — have 1 qt)\n"
                "- Herb oil: 1 qt (OUT)\n"
                "- Croutons: 3 hotel pans (have 1)\n\n"
                "Station: Sauté (James)\n"
                "- Chicken jus: 4 qt (OUT — URGENT)\n"
                "- Compound butter: 2 lb\n"
                "- Blanched haricots verts: 6 lb"
            ),
            "extractions": [
                {
                    "extraction_class": "prep_header",
                    "extraction_text": "PREP LIST — Friday 03/28/2026",
                    "attributes": {"date": "03/28/2026"},
                },
                {
                    "extraction_class": "station",
                    "extraction_text": "Garde Manger",
                    "attributes": {"cook": "Miguel"},
                },
                {
                    "extraction_class": "prep_item",
                    "extraction_text": "Pickled red onions",
                    "attributes": {
                        "quantity": "2",
                        "unit": "qt",
                        "priority": "LOW",
                        "on_hand": "1 qt",
                        "station": "Garde Manger",
                    },
                },
                {
                    "extraction_class": "prep_item",
                    "extraction_text": "Herb oil",
                    "attributes": {
                        "quantity": "1",
                        "unit": "qt",
                        "priority": "OUT",
                        "station": "Garde Manger",
                    },
                },
                {
                    "extraction_class": "prep_item",
                    "extraction_text": "Chicken jus",
                    "attributes": {
                        "quantity": "4",
                        "unit": "qt",
                        "priority": "URGENT",
                        "station": "Sauté",
                    },
                },
            ],
        }
    ],
}


# ──────────────────────────────────────────────────────────────
# SCHEMA REGISTRY
# ──────────────────────────────────────────────────────────────

SCHEMAS = {
    "invoice": INVOICE_SCHEMA,
    "recipe": RECIPE_SCHEMA,
    "prep_list": PREP_LIST_SCHEMA,
}


def get_schema(name: str) -> dict | None:
    """Get a built-in schema by name."""
    return SCHEMAS.get(name)


def list_schemas() -> list[str]:
    """List available built-in schema names."""
    return list(SCHEMAS.keys())
