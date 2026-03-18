"""Add workspace_recipes, recipe_components, recipe_component_ingredients,
recipe_steps tables and seed data for Modernist Cuisine recipe system.

Revision ID: 004
Revises: 003
"""

import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID

revision = "004"
down_revision = "003b"
branch_labels = None
depends_on = None

# Re-use deterministic location IDs from migration 002
LOC_RIVER_NORTH = uuid.UUID("00000000-0000-0000-0001-000000000001")
LOC_WEST_LOOP = uuid.UUID("00000000-0000-0000-0001-000000000002")
LOC_FULTON_MARKET = uuid.UUID("00000000-0000-0000-0001-000000000003")


def upgrade() -> None:
    # ---- workspace_recipes ----
    op.create_table(
        "workspace_recipes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "location_id",
            UUID(as_uuid=True),
            sa.ForeignKey("workspace_locations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("yield_quantity", sa.Numeric(12, 4), server_default="1"),
        sa.Column("yield_unit", sa.String(50), server_default="serving"),
        sa.Column("total_weight_g", sa.Numeric(12, 2)),
        sa.Column("total_cost", sa.Numeric(12, 2)),
        sa.Column("cost_per_serving", sa.Numeric(12, 2)),
        sa.Column("image_url", sa.String(500)),
        sa.Column("source", sa.String(50), server_default="manual"),
        sa.Column("equipment", JSONB, server_default="[]"),
        sa.Column("notes", sa.Text),
        sa.Column("tags", JSONB, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ---- recipe_components ----
    op.create_table(
        "recipe_components",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "recipe_id",
            UUID(as_uuid=True),
            sa.ForeignKey("workspace_recipes.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("sort_order", sa.Integer, server_default="0"),
        sa.Column("yield_quantity", sa.Numeric(12, 4)),
        sa.Column("yield_unit", sa.String(50)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ---- recipe_component_ingredients ----
    op.create_table(
        "recipe_component_ingredients",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "component_id",
            UUID(as_uuid=True),
            sa.ForeignKey("recipe_components.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("item_id", UUID(as_uuid=True), sa.ForeignKey("items.id"), nullable=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("weight_g", sa.Numeric(12, 4), nullable=False),
        sa.Column("percentage", sa.Numeric(8, 2)),
        sa.Column("unit_display", sa.String(20), server_default="g"),
        sa.Column("sort_order", sa.Integer, server_default="0"),
        sa.Column("notes", sa.String(300)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ---- recipe_steps ----
    op.create_table(
        "recipe_steps",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "component_id",
            UUID(as_uuid=True),
            sa.ForeignKey("recipe_components.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("step_number", sa.Integer, nullable=False),
        sa.Column("instruction", sa.Text, nullable=False),
        sa.Column("temperature", sa.String(50)),
        sa.Column("duration", sa.String(50)),
        sa.Column("technique", sa.String(100)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    _seed_recipes()


def _seed_recipes() -> None:
    """Insert sample Modernist Cuisine-style recipes."""

    recipes_t = sa.table(
        "workspace_recipes",
        sa.column("id", UUID),
        sa.column("location_id", UUID),
        sa.column("name", sa.String),
        sa.column("category", sa.String),
        sa.column("description", sa.Text),
        sa.column("status", sa.String),
        sa.column("yield_quantity", sa.Numeric),
        sa.column("yield_unit", sa.String),
        sa.column("total_weight_g", sa.Numeric),
        sa.column("total_cost", sa.Numeric),
        sa.column("cost_per_serving", sa.Numeric),
        sa.column("image_url", sa.String),
        sa.column("source", sa.String),
        sa.column("equipment", JSONB),
        sa.column("notes", sa.Text),
        sa.column("tags", JSONB),
    )

    components_t = sa.table(
        "recipe_components",
        sa.column("id", UUID),
        sa.column("recipe_id", UUID),
        sa.column("name", sa.String),
        sa.column("sort_order", sa.Integer),
        sa.column("yield_quantity", sa.Numeric),
        sa.column("yield_unit", sa.String),
    )

    ingredients_t = sa.table(
        "recipe_component_ingredients",
        sa.column("id", UUID),
        sa.column("component_id", UUID),
        sa.column("name", sa.String),
        sa.column("weight_g", sa.Numeric),
        sa.column("percentage", sa.Numeric),
        sa.column("unit_display", sa.String),
        sa.column("sort_order", sa.Integer),
        sa.column("notes", sa.String),
    )

    steps_t = sa.table(
        "recipe_steps",
        sa.column("id", UUID),
        sa.column("component_id", UUID),
        sa.column("step_number", sa.Integer),
        sa.column("instruction", sa.Text),
        sa.column("temperature", sa.String),
        sa.column("duration", sa.String),
        sa.column("technique", sa.String),
    )

    # --- Recipe 1: Neapolitan Pizza Dough ---
    r1 = uuid.uuid4()
    c1_dough = uuid.uuid4()

    # --- Recipe 2: Bone Marrow Butter ---
    r2 = uuid.uuid4()
    c2_marrow = uuid.uuid4()
    c2_compound = uuid.uuid4()

    # --- Recipe 3: Sous Vide Short Ribs ---
    r3 = uuid.uuid4()
    c3_brine = uuid.uuid4()
    c3_ribs = uuid.uuid4()
    c3_glaze = uuid.uuid4()

    # --- Recipe 4: Lemon Curd (sub-recipe) ---
    r4 = uuid.uuid4()
    c4_curd = uuid.uuid4()

    # --- Recipe 5: Classic French Onion Soup ---
    r5 = uuid.uuid4()
    c5_soup = uuid.uuid4()
    c5_finish = uuid.uuid4()

    op.bulk_insert(recipes_t, [
        {
            "id": r1,
            "location_id": LOC_RIVER_NORTH,
            "name": "Neapolitan Pizza Dough",
            "category": "Dough",
            "description": "A classic Neapolitan-style pizza dough with 65% hydration, optimized for high-heat wood-fired ovens. Long cold fermentation develops complex flavor.",
            "status": "active",
            "yield_quantity": 4,
            "yield_unit": "dough balls (~280g each)",
            "total_weight_g": 844,
            "total_cost": 3.42,
            "cost_per_serving": 0.86,
            "source": "manual",
            "equipment": ["Stand mixer with dough hook", "Digital scale", "Bench scraper", "Proofing containers"],
            "notes": "For best results use Caputo 00 flour. Hydration can go to 70% for a more open crumb. Cold ferment 24-72 hours for optimal flavor.",
            "tags": ["vegetarian", "vegan", "italian", "bread"],
        },
        {
            "id": r2,
            "location_id": LOC_RIVER_NORTH,
            "name": "Bone Marrow Butter",
            "category": "Condiment",
            "description": "A luxurious compound butter enriched with roasted bone marrow, herbs, and shallot. Ideal for finishing steaks and grilled bread.",
            "status": "active",
            "yield_quantity": 12,
            "yield_unit": "portions (25g each)",
            "total_weight_g": 300,
            "total_cost": 8.90,
            "cost_per_serving": 0.74,
            "source": "manual",
            "equipment": ["Sheet pan", "Food processor", "Plastic wrap"],
            "notes": "Can be frozen for up to 3 months. Roll into a log in plastic wrap for easy portioning.",
            "tags": ["gluten-free", "condiment", "steak"],
        },
        {
            "id": r3,
            "location_id": LOC_WEST_LOOP,
            "name": "72-Hour Sous Vide Short Ribs",
            "category": "Entree",
            "description": "Braised-texture short ribs via precision cooking. The 72-hour cook transforms collagen without the variable heat of traditional braising.",
            "status": "active",
            "yield_quantity": 6,
            "yield_unit": "portions",
            "total_weight_g": 2400,
            "total_cost": 54.60,
            "cost_per_serving": 9.10,
            "source": "manual",
            "equipment": ["Immersion circulator", "Vacuum sealer", "Cast iron skillet", "Torch"],
            "notes": "Critical: do not exceed 62C or the texture will be mushy. Sear immediately before service for best crust.",
            "tags": ["gluten-free", "protein", "sous-vide", "signature"],
        },
        {
            "id": r4,
            "location_id": LOC_FULTON_MARKET,
            "name": "Lemon Curd",
            "category": "Pastry",
            "description": "A bright, tangy curd with precise temperature control for silky texture. Used as a component in multiple desserts.",
            "status": "draft",
            "yield_quantity": 500,
            "yield_unit": "g",
            "total_weight_g": 500,
            "total_cost": 4.20,
            "cost_per_serving": 0.42,
            "source": "manual",
            "equipment": ["Saucepan", "Whisk", "Fine-mesh strainer", "Immersion blender", "Digital thermometer"],
            "notes": "Strain through a fine-mesh sieve for the smoothest texture. Do not exceed 82C or eggs will scramble.",
            "tags": ["vegetarian", "pastry", "sub-recipe", "citrus"],
        },
        {
            "id": r5,
            "location_id": LOC_WEST_LOOP,
            "name": "Classic French Onion Soup",
            "category": "Soup",
            "description": "Deep, mahogany-colored onion soup with properly caramelized onions (not just browned). Patience is the only secret ingredient.",
            "status": "archived",
            "yield_quantity": 8,
            "yield_unit": "portions (300ml each)",
            "total_weight_g": 2400,
            "total_cost": 12.80,
            "cost_per_serving": 1.60,
            "source": "manual",
            "equipment": ["Heavy-bottom Dutch oven", "Oven-safe crocks", "Mandoline"],
            "notes": "Onions lose 80% of their volume during caramelization. Start with 3kg for 8 portions. Do not rush the caramelization step.",
            "tags": ["french", "soup", "comfort", "winter-menu"],
        },
    ])

    op.bulk_insert(components_t, [
        # Pizza Dough
        {"id": c1_dough, "recipe_id": r1, "name": "Dough", "sort_order": 1, "yield_quantity": 1120, "yield_unit": "g"},
        # Bone Marrow Butter
        {"id": c2_marrow, "recipe_id": r2, "name": "Roasted Marrow", "sort_order": 1, "yield_quantity": 150, "yield_unit": "g"},
        {"id": c2_compound, "recipe_id": r2, "name": "Compound Butter", "sort_order": 2, "yield_quantity": 300, "yield_unit": "g"},
        # Sous Vide Short Ribs
        {"id": c3_brine, "recipe_id": r3, "name": "Dry Brine", "sort_order": 1, "yield_quantity": None, "yield_unit": None},
        {"id": c3_ribs, "recipe_id": r3, "name": "Sous Vide Cook", "sort_order": 2, "yield_quantity": 2400, "yield_unit": "g"},
        {"id": c3_glaze, "recipe_id": r3, "name": "Red Wine Glaze", "sort_order": 3, "yield_quantity": 200, "yield_unit": "ml"},
        # Lemon Curd
        {"id": c4_curd, "recipe_id": r4, "name": "Curd", "sort_order": 1, "yield_quantity": 500, "yield_unit": "g"},
        # French Onion Soup
        {"id": c5_soup, "recipe_id": r5, "name": "Soup Base", "sort_order": 1, "yield_quantity": 2400, "yield_unit": "ml"},
        {"id": c5_finish, "recipe_id": r5, "name": "Gratinee Finish", "sort_order": 2, "yield_quantity": 8, "yield_unit": "portions"},
    ])

    op.bulk_insert(ingredients_t, [
        # --- Pizza Dough ---
        {"id": uuid.uuid4(), "component_id": c1_dough, "name": "Caputo 00 Flour", "weight_g": 500, "percentage": 100, "unit_display": "g", "sort_order": 1, "notes": None},
        {"id": uuid.uuid4(), "component_id": c1_dough, "name": "Water (20C)", "weight_g": 325, "percentage": 65, "unit_display": "g", "sort_order": 2, "notes": "room temperature"},
        {"id": uuid.uuid4(), "component_id": c1_dough, "name": "Fine Sea Salt", "weight_g": 15, "percentage": 3, "unit_display": "g", "sort_order": 3, "notes": None},
        {"id": uuid.uuid4(), "component_id": c1_dough, "name": "Fresh Yeast", "weight_g": 1.5, "percentage": 0.3, "unit_display": "g", "sort_order": 4, "notes": "or 0.5g instant dry yeast"},
        {"id": uuid.uuid4(), "component_id": c1_dough, "name": "Vital Wheat Gluten", "weight_g": 2.5, "percentage": 0.5, "unit_display": "g", "sort_order": 5, "notes": "optional, for extra chew"},

        # --- Roasted Marrow ---
        {"id": uuid.uuid4(), "component_id": c2_marrow, "name": "Bone Marrow Bones (split)", "weight_g": 400, "percentage": 100, "unit_display": "g", "sort_order": 1, "notes": "ask butcher to split lengthwise"},
        {"id": uuid.uuid4(), "component_id": c2_marrow, "name": "Flaky Salt", "weight_g": 3, "percentage": 0.75, "unit_display": "g", "sort_order": 2, "notes": None},

        # --- Compound Butter ---
        {"id": uuid.uuid4(), "component_id": c2_compound, "name": "Unsalted Butter (softened)", "weight_g": 200, "percentage": 100, "unit_display": "g", "sort_order": 1, "notes": "room temperature"},
        {"id": uuid.uuid4(), "component_id": c2_compound, "name": "Roasted Marrow (scooped)", "weight_g": 80, "percentage": 40, "unit_display": "g", "sort_order": 2, "notes": "from Component 1"},
        {"id": uuid.uuid4(), "component_id": c2_compound, "name": "Shallot (minced)", "weight_g": 15, "percentage": 7.5, "unit_display": "g", "sort_order": 3, "notes": "finely minced"},
        {"id": uuid.uuid4(), "component_id": c2_compound, "name": "Flat-Leaf Parsley", "weight_g": 5, "percentage": 2.5, "unit_display": "g", "sort_order": 4, "notes": "finely chopped"},
        {"id": uuid.uuid4(), "component_id": c2_compound, "name": "Flaky Salt", "weight_g": 2, "percentage": 1, "unit_display": "g", "sort_order": 5, "notes": None},

        # --- Short Ribs Dry Brine ---
        {"id": uuid.uuid4(), "component_id": c3_brine, "name": "Bone-In Short Ribs", "weight_g": 2400, "percentage": 100, "unit_display": "g", "sort_order": 1, "notes": "6 pieces, ~400g each"},
        {"id": uuid.uuid4(), "component_id": c3_brine, "name": "Kosher Salt", "weight_g": 24, "percentage": 1, "unit_display": "g", "sort_order": 2, "notes": "1% of meat weight"},
        {"id": uuid.uuid4(), "component_id": c3_brine, "name": "Black Pepper (coarse)", "weight_g": 6, "percentage": 0.25, "unit_display": "g", "sort_order": 3, "notes": None},

        # --- Short Ribs Sous Vide ---
        {"id": uuid.uuid4(), "component_id": c3_ribs, "name": "Dry-Brined Short Ribs", "weight_g": 2400, "percentage": 100, "unit_display": "g", "sort_order": 1, "notes": "from Component 1"},
        {"id": uuid.uuid4(), "component_id": c3_ribs, "name": "Garlic Cloves (smashed)", "weight_g": 20, "percentage": 0.83, "unit_display": "g", "sort_order": 2, "notes": None},
        {"id": uuid.uuid4(), "component_id": c3_ribs, "name": "Fresh Thyme Sprigs", "weight_g": 5, "percentage": 0.21, "unit_display": "g", "sort_order": 3, "notes": None},
        {"id": uuid.uuid4(), "component_id": c3_ribs, "name": "Rosemary Sprig", "weight_g": 3, "percentage": 0.13, "unit_display": "g", "sort_order": 4, "notes": None},

        # --- Red Wine Glaze ---
        {"id": uuid.uuid4(), "component_id": c3_glaze, "name": "Red Wine (full-bodied)", "weight_g": 500, "percentage": 100, "unit_display": "ml", "sort_order": 1, "notes": "Cabernet or Malbec"},
        {"id": uuid.uuid4(), "component_id": c3_glaze, "name": "Beef Stock (rich)", "weight_g": 250, "percentage": 50, "unit_display": "ml", "sort_order": 2, "notes": "preferably remouillage"},
        {"id": uuid.uuid4(), "component_id": c3_glaze, "name": "Shallot (sliced)", "weight_g": 30, "percentage": 6, "unit_display": "g", "sort_order": 3, "notes": None},
        {"id": uuid.uuid4(), "component_id": c3_glaze, "name": "Unsalted Butter (cold)", "weight_g": 30, "percentage": 6, "unit_display": "g", "sort_order": 4, "notes": "for mounting"},

        # --- Lemon Curd ---
        {"id": uuid.uuid4(), "component_id": c4_curd, "name": "Fresh Lemon Juice", "weight_g": 150, "percentage": 100, "unit_display": "g", "sort_order": 1, "notes": "~6 lemons"},
        {"id": uuid.uuid4(), "component_id": c4_curd, "name": "Granulated Sugar", "weight_g": 150, "percentage": 100, "unit_display": "g", "sort_order": 2, "notes": None},
        {"id": uuid.uuid4(), "component_id": c4_curd, "name": "Whole Eggs", "weight_g": 150, "percentage": 100, "unit_display": "g", "sort_order": 3, "notes": "~3 large eggs"},
        {"id": uuid.uuid4(), "component_id": c4_curd, "name": "Egg Yolks", "weight_g": 40, "percentage": 26.7, "unit_display": "g", "sort_order": 4, "notes": "~2 yolks"},
        {"id": uuid.uuid4(), "component_id": c4_curd, "name": "Unsalted Butter (cold, cubed)", "weight_g": 115, "percentage": 76.7, "unit_display": "g", "sort_order": 5, "notes": "1cm cubes"},
        {"id": uuid.uuid4(), "component_id": c4_curd, "name": "Lemon Zest", "weight_g": 8, "percentage": 5.3, "unit_display": "g", "sort_order": 6, "notes": "finely grated, no pith"},
        {"id": uuid.uuid4(), "component_id": c4_curd, "name": "Fine Salt", "weight_g": 1, "percentage": 0.67, "unit_display": "g", "sort_order": 7, "notes": None},

        # --- French Onion Soup Base ---
        {"id": uuid.uuid4(), "component_id": c5_soup, "name": "Yellow Onions (sliced)", "weight_g": 3000, "percentage": 100, "unit_display": "g", "sort_order": 1, "notes": "~3mm thick, uniform"},
        {"id": uuid.uuid4(), "component_id": c5_soup, "name": "Unsalted Butter", "weight_g": 60, "percentage": 2, "unit_display": "g", "sort_order": 2, "notes": None},
        {"id": uuid.uuid4(), "component_id": c5_soup, "name": "Olive Oil", "weight_g": 30, "percentage": 1, "unit_display": "ml", "sort_order": 3, "notes": None},
        {"id": uuid.uuid4(), "component_id": c5_soup, "name": "Dry White Wine", "weight_g": 200, "percentage": 6.7, "unit_display": "ml", "sort_order": 4, "notes": None},
        {"id": uuid.uuid4(), "component_id": c5_soup, "name": "Rich Beef Stock", "weight_g": 2000, "percentage": 66.7, "unit_display": "ml", "sort_order": 5, "notes": "homemade preferred"},
        {"id": uuid.uuid4(), "component_id": c5_soup, "name": "Fresh Thyme", "weight_g": 5, "percentage": 0.17, "unit_display": "g", "sort_order": 6, "notes": "tied in bouquet garni"},
        {"id": uuid.uuid4(), "component_id": c5_soup, "name": "Bay Leaf", "weight_g": 1, "percentage": 0.03, "unit_display": "each", "sort_order": 7, "notes": None},
        {"id": uuid.uuid4(), "component_id": c5_soup, "name": "Kosher Salt", "weight_g": 12, "percentage": 0.4, "unit_display": "g", "sort_order": 8, "notes": "to taste"},

        # --- Gratinee Finish ---
        {"id": uuid.uuid4(), "component_id": c5_finish, "name": "Gruyere (grated)", "weight_g": 320, "percentage": 100, "unit_display": "g", "sort_order": 1, "notes": "aged 6+ months"},
        {"id": uuid.uuid4(), "component_id": c5_finish, "name": "Sourdough Bread (sliced)", "weight_g": 240, "percentage": 75, "unit_display": "g", "sort_order": 2, "notes": "8 slices, toasted"},
    ])

    op.bulk_insert(steps_t, [
        # --- Pizza Dough Steps ---
        {"id": uuid.uuid4(), "component_id": c1_dough, "step_number": 1, "instruction": "Dissolve yeast in water (20C). Rest 5 min.", "temperature": "20C / 68F", "duration": "5 min", "technique": None},
        {"id": uuid.uuid4(), "component_id": c1_dough, "step_number": 2, "instruction": "Combine flour, gluten, and salt in stand mixer bowl.", "temperature": None, "duration": None, "technique": None},
        {"id": uuid.uuid4(), "component_id": c1_dough, "step_number": 3, "instruction": "Add yeast water. Mix on speed 1 for 4 min.", "temperature": None, "duration": "4 min", "technique": "mixing"},
        {"id": uuid.uuid4(), "component_id": c1_dough, "step_number": 4, "instruction": "Rest dough 10 min (autolyse).", "temperature": None, "duration": "10 min", "technique": "autolyse"},
        {"id": uuid.uuid4(), "component_id": c1_dough, "step_number": 5, "instruction": "Mix on speed 2 for 6 min until smooth and passes windowpane test.", "temperature": None, "duration": "6 min", "technique": "mixing"},
        {"id": uuid.uuid4(), "component_id": c1_dough, "step_number": 6, "instruction": "Divide into 4 equal pieces (~280g each).", "temperature": None, "duration": None, "technique": None},
        {"id": uuid.uuid4(), "component_id": c1_dough, "step_number": 7, "instruction": "Shape into tight balls, tuck seams under.", "temperature": None, "duration": None, "technique": "shaping"},
        {"id": uuid.uuid4(), "component_id": c1_dough, "step_number": 8, "instruction": "Oil surface, cover. Rest at room temp 1 hr, or refrigerate 24-72 hr.", "temperature": "Room temp or 4C / 39F", "duration": "1 hr or 24-72 hr", "technique": "cold fermentation"},

        # --- Roasted Marrow Steps ---
        {"id": uuid.uuid4(), "component_id": c2_marrow, "step_number": 1, "instruction": "Soak marrow bones in salted ice water for 12-24 hours to draw out blood.", "temperature": "4C / 39F", "duration": "12-24 hr", "technique": "soaking"},
        {"id": uuid.uuid4(), "component_id": c2_marrow, "step_number": 2, "instruction": "Preheat oven to 230C (450F). Place bones cut-side up on sheet pan.", "temperature": "230C / 450F", "duration": None, "technique": None},
        {"id": uuid.uuid4(), "component_id": c2_marrow, "step_number": 3, "instruction": "Roast for 15-20 min until marrow is soft and slightly pulling from bone.", "temperature": "230C / 450F", "duration": "15-20 min", "technique": "roasting"},
        {"id": uuid.uuid4(), "component_id": c2_marrow, "step_number": 4, "instruction": "Scoop marrow immediately. Season with flaky salt.", "temperature": None, "duration": None, "technique": None},

        # --- Compound Butter Steps ---
        {"id": uuid.uuid4(), "component_id": c2_compound, "step_number": 1, "instruction": "Combine softened butter and warm marrow in food processor.", "temperature": None, "duration": None, "technique": None},
        {"id": uuid.uuid4(), "component_id": c2_compound, "step_number": 2, "instruction": "Add shallot, parsley, and salt. Pulse until evenly mixed.", "temperature": None, "duration": None, "technique": "pulsing"},
        {"id": uuid.uuid4(), "component_id": c2_compound, "step_number": 3, "instruction": "Roll into a log using plastic wrap. Twist ends tight.", "temperature": None, "duration": None, "technique": "shaping"},
        {"id": uuid.uuid4(), "component_id": c2_compound, "step_number": 4, "instruction": "Refrigerate until firm (minimum 2 hours). Freeze for long-term storage.", "temperature": "4C / 39F", "duration": "2 hr minimum", "technique": None},

        # --- Short Ribs Dry Brine Steps ---
        {"id": uuid.uuid4(), "component_id": c3_brine, "step_number": 1, "instruction": "Pat short ribs dry with paper towels.", "temperature": None, "duration": None, "technique": None},
        {"id": uuid.uuid4(), "component_id": c3_brine, "step_number": 2, "instruction": "Season evenly with salt and pepper on all sides.", "temperature": None, "duration": None, "technique": "seasoning"},
        {"id": uuid.uuid4(), "component_id": c3_brine, "step_number": 3, "instruction": "Place on wire rack over sheet pan. Refrigerate uncovered 12-24 hours.", "temperature": "4C / 39F", "duration": "12-24 hr", "technique": "dry brine"},

        # --- Short Ribs Sous Vide Steps ---
        {"id": uuid.uuid4(), "component_id": c3_ribs, "step_number": 1, "instruction": "Preheat water bath to 60C (140F).", "temperature": "60C / 140F", "duration": None, "technique": "sous vide"},
        {"id": uuid.uuid4(), "component_id": c3_ribs, "step_number": 2, "instruction": "Vacuum seal ribs with garlic, thyme, and rosemary. Two ribs per bag.", "temperature": None, "duration": None, "technique": "vacuum sealing"},
        {"id": uuid.uuid4(), "component_id": c3_ribs, "step_number": 3, "instruction": "Cook in water bath for 72 hours. Maintain temperature within 0.5C.", "temperature": "60C / 140F", "duration": "72 hr", "technique": "sous vide"},
        {"id": uuid.uuid4(), "component_id": c3_ribs, "step_number": 4, "instruction": "Remove from bags, reserve juices for glaze. Pat dry thoroughly.", "temperature": None, "duration": None, "technique": None},
        {"id": uuid.uuid4(), "component_id": c3_ribs, "step_number": 5, "instruction": "Sear in cast iron with high-heat oil until deep brown crust forms, ~90 seconds per side.", "temperature": "260C / 500F", "duration": "90 sec/side", "technique": "searing"},

        # --- Red Wine Glaze Steps ---
        {"id": uuid.uuid4(), "component_id": c3_glaze, "step_number": 1, "instruction": "Sweat shallots in a small amount of reserved bag juices.", "temperature": None, "duration": "3 min", "technique": "sweating"},
        {"id": uuid.uuid4(), "component_id": c3_glaze, "step_number": 2, "instruction": "Deglaze with red wine. Reduce by two-thirds.", "temperature": None, "duration": "15-20 min", "technique": "reducing"},
        {"id": uuid.uuid4(), "component_id": c3_glaze, "step_number": 3, "instruction": "Add beef stock. Reduce until nape consistency (coats the back of a spoon).", "temperature": None, "duration": "10 min", "technique": "reducing"},
        {"id": uuid.uuid4(), "component_id": c3_glaze, "step_number": 4, "instruction": "Off heat, mount with cold butter, swirling to emulsify. Season.", "temperature": None, "duration": None, "technique": "mounting"},

        # --- Lemon Curd Steps ---
        {"id": uuid.uuid4(), "component_id": c4_curd, "step_number": 1, "instruction": "Whisk eggs, yolks, sugar, and salt in saucepan until combined.", "temperature": None, "duration": None, "technique": None},
        {"id": uuid.uuid4(), "component_id": c4_curd, "step_number": 2, "instruction": "Add lemon juice. Cook over medium-low heat, stirring constantly.", "temperature": None, "duration": None, "technique": "stirring"},
        {"id": uuid.uuid4(), "component_id": c4_curd, "step_number": 3, "instruction": "Heat to 82C (180F), stirring constantly. Mixture will thicken noticeably.", "temperature": "82C / 180F", "duration": "8-10 min", "technique": "tempering"},
        {"id": uuid.uuid4(), "component_id": c4_curd, "step_number": 4, "instruction": "Remove from heat. Strain through fine-mesh sieve into bowl.", "temperature": None, "duration": None, "technique": "straining"},
        {"id": uuid.uuid4(), "component_id": c4_curd, "step_number": 5, "instruction": "Add cold butter cubes and lemon zest. Blend with immersion blender until glossy.", "temperature": None, "duration": None, "technique": "emulsifying"},
        {"id": uuid.uuid4(), "component_id": c4_curd, "step_number": 6, "instruction": "Press plastic wrap directly onto surface. Refrigerate until set, 4+ hours.", "temperature": "4C / 39F", "duration": "4+ hr", "technique": None},

        # --- French Onion Soup Base Steps ---
        {"id": uuid.uuid4(), "component_id": c5_soup, "step_number": 1, "instruction": "Melt butter with olive oil in Dutch oven over medium heat.", "temperature": None, "duration": None, "technique": None},
        {"id": uuid.uuid4(), "component_id": c5_soup, "step_number": 2, "instruction": "Add all sliced onions. Stir to coat. Cook uncovered.", "temperature": None, "duration": None, "technique": None},
        {"id": uuid.uuid4(), "component_id": c5_soup, "step_number": 3, "instruction": "Caramelize onions, stirring every 10 min. Total time: 60-90 min. Onions should be deep mahogany, reduced by ~80%.", "temperature": "Medium-low", "duration": "60-90 min", "technique": "caramelizing"},
        {"id": uuid.uuid4(), "component_id": c5_soup, "step_number": 4, "instruction": "Deglaze with white wine, scraping fond. Cook until wine evaporates.", "temperature": None, "duration": "3-5 min", "technique": "deglazing"},
        {"id": uuid.uuid4(), "component_id": c5_soup, "step_number": 5, "instruction": "Add beef stock, thyme, and bay leaf. Bring to a simmer.", "temperature": None, "duration": None, "technique": None},
        {"id": uuid.uuid4(), "component_id": c5_soup, "step_number": 6, "instruction": "Simmer gently for 30 min. Season with salt. Remove thyme and bay.", "temperature": None, "duration": "30 min", "technique": "simmering"},

        # --- Gratinee Finish Steps ---
        {"id": uuid.uuid4(), "component_id": c5_finish, "step_number": 1, "instruction": "Ladle hot soup into oven-safe crocks.", "temperature": None, "duration": None, "technique": None},
        {"id": uuid.uuid4(), "component_id": c5_finish, "step_number": 2, "instruction": "Place toasted sourdough slice on top of each.", "temperature": None, "duration": None, "technique": None},
        {"id": uuid.uuid4(), "component_id": c5_finish, "step_number": 3, "instruction": "Cover generously with grated Gruyere (~40g per crock).", "temperature": None, "duration": None, "technique": None},
        {"id": uuid.uuid4(), "component_id": c5_finish, "step_number": 4, "instruction": "Broil until cheese is bubbling and deeply golden, 3-5 min. Watch closely.", "temperature": "Broil / 260C", "duration": "3-5 min", "technique": "broiling"},
    ])


def downgrade() -> None:
    op.drop_table("recipe_steps")
    op.drop_table("recipe_component_ingredients")
    op.drop_table("recipe_components")
    op.drop_table("workspace_recipes")
