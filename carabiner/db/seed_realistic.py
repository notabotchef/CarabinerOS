"""
Realistic 1-month seed data for Carabiner Tapas — a modern Spanish tapas bar.

Generates interconnected, mathematically consistent data across ALL tables
for March 1–31, 2026. Designed to stress-test Agent Zero with real restaurant data.

Usage:
    python -m carabiner.db.seed_realistic
    python -m carabiner.db.seed_realistic --no-confirm
"""

from __future__ import annotations

import argparse
import asyncio
import os
import random
import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from carabiner.db.base import Base
from carabiner.db.models import (
    BudgetPeriod,
    DailyFoodCost,
    DailyPL,
    GLAccount,
    InventoryCount,
    InventoryCountLine,
    Invoice,
    InvoiceLineItem,
    Item,
    Location,
    MenuItem,
    OrderGuide,
    OrderGuideItem,
    ParLevel,
    PosSales,
    PosProductMix,
    PrepList,
    PrepListItem,
    PriceAlert,
    PurchaseOrder,
    PurchaseOrderLine,
    Recipe,
    RecipeIngredient,
    UnitOfMeasure,
    Vendor,
    WasteLog,
)
from carabiner.db.workspace_models import (
    ActionLog,
    InboxItem,
    Organization,
    RecipeComponent,
    RecipeComponentIngredient,
    RecipeStep,
    WorkspaceCampaign,
    WorkspaceFoodCost,
    WorkspaceInventory,
    WorkspaceInvoice,
    WorkspaceLocation,
    WorkspaceMenu,
    WorkspaceOrder,
    WorkspacePrep,
    WorkspaceRecipe,
)

# ─── RNG seed for reproducible data ─────────────────────────────────────────
random.seed(2026_03_01)

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://carabiner:carabiner@localhost:5432/carabiner",
)

# ─── Date range ──────────────────────────────────────────────────────────────
START = date(2026, 3, 1)
END = date(2026, 3, 31)
TODAY = date(2026, 3, 23)


def D(val: str | float | int) -> Decimal:
    return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def D4(val: str | float | int) -> Decimal:
    return Decimal(str(val)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def uid() -> uuid.UUID:
    return uuid.uuid4()


def dt(d: date, h: int = 12, m: int = 0) -> datetime:
    return datetime.combine(d, time(h, m), tzinfo=timezone.utc)


# ═══════════════════════════════════════════════════════════════════════════════
# 1. FOUNDATION IDs (pre-generated for cross-referencing)
# ═══════════════════════════════════════════════════════════════════════════════

LOC_ID = uid()
ORG_ID = uid()
WS_LOC_ID = uid()

# GL Accounts
GL = {
    "produce": uid(),
    "protein": uid(),
    "seafood": uid(),
    "dairy": uid(),
    "dry": uid(),
    "wine": uid(),
    "spirits": uid(),
    "supplies": uid(),
}

# Units of Measure
UOM = {}  # populated during build

# Vendors
VENDOR_IDS = {
    "coastal": uid(),
    "iberico": uid(),
    "greatlakes": uid(),
    "midwest": uid(),
    "vinoteca": uid(),
}

VENDORS_DEF = [
    ("coastal", "Coastal Produce", "orders@coastalproduce.com", "(312) 555-0101", "Net 15"),
    ("iberico", "Ibérico Direct", "ventas@ibericodirect.com", "(312) 555-0202", "Net 30"),
    ("greatlakes", "Great Lakes Seafood", "sales@greatlakesseafood.com", "(312) 555-0303", "Net 15"),
    ("midwest", "Midwest Dry Goods", "orders@midwestdrygoods.com", "(312) 555-0404", "Net 30"),
    ("vinoteca", "Vinoteca Supply", "pedidos@vinotecasupply.com", "(312) 555-0505", "Net 30"),
]

# ─── Units ────────────────────────────────────────────────────────────────────
UOMS_DEF = [
    ("kilogram", "kg"),
    ("gram", "g"),
    ("liter", "L"),
    ("milliliter", "mL"),
    ("each", "ea"),
    ("case", "cs"),
    ("pound", "lb"),
    ("ounce", "oz"),
    ("bunch", "bch"),
    ("dozen", "dz"),
    ("bottle", "btl"),
    ("bag", "bag"),
]

# ─── GL Account definitions ──────────────────────────────────────────────────
GL_DEFS = [
    ("produce", "5010", "Food – Produce", "Cost of Goods"),
    ("protein", "5020", "Food – Protein", "Cost of Goods"),
    ("seafood", "5030", "Food – Seafood", "Cost of Goods"),
    ("dairy", "5040", "Food – Dairy", "Cost of Goods"),
    ("dry", "5050", "Food – Dry Goods", "Cost of Goods"),
    ("wine", "5110", "Beverage – Wine", "Cost of Goods"),
    ("spirits", "5120", "Beverage – Spirits", "Cost of Goods"),
    ("supplies", "6010", "Supplies", "Operating Expenses"),
]

# ═══════════════════════════════════════════════════════════════════════════════
# 2. ITEMS (Ingredients) — 48 items
# ═══════════════════════════════════════════════════════════════════════════════

# (key, name, category, uom_abbr, gl_key, last_known_price, vendor_key)
ITEMS_DEF: list[tuple[str, str, str, str, str, float, str]] = [
    # Produce
    ("roma_tomato", "Roma Tomatoes", "Produce", "cs", "produce", 28.00, "coastal"),
    ("garlic", "Garlic (peeled)", "Produce", "lb", "produce", 4.50, "coastal"),
    ("onion_yellow", "Yellow Onions", "Produce", "bag", "produce", 12.00, "coastal"),
    ("potato_yukon", "Yukon Gold Potatoes", "Produce", "cs", "produce", 32.00, "coastal"),
    ("padron_pepper", "Pimientos de Padrón", "Produce", "lb", "produce", 14.00, "coastal"),
    ("lemon", "Lemons", "Produce", "cs", "produce", 38.00, "coastal"),
    ("parsley", "Flat-Leaf Parsley", "Produce", "bch", "produce", 1.50, "coastal"),
    ("saffron", "Saffron Threads", "Produce", "g", "produce", 8.00, "coastal"),
    ("smoked_paprika", "Pimentón de la Vera", "Produce", "ea", "dry", 12.00, "midwest"),
    ("evoo", "Extra Virgin Olive Oil", "Produce", "L", "produce", 18.00, "coastal"),
    ("sherry_vinegar", "Sherry Vinegar", "Produce", "btl", "produce", 9.50, "coastal"),
    ("marcona_almond", "Marcona Almonds", "Produce", "lb", "dry", 22.00, "midwest"),
    ("basil", "Fresh Basil", "Produce", "bch", "produce", 2.00, "coastal"),
    ("lettuce_mix", "Mesclun Mix", "Produce", "lb", "produce", 6.50, "coastal"),
    ("guindilla", "Guindilla Peppers", "Produce", "ea", "produce", 0.60, "coastal"),
    # Protein
    ("jamon_iberico", "Jamón Ibérico (sliced)", "Protein", "lb", "protein", 65.00, "iberico"),
    ("chorizo", "Spanish Chorizo Links", "Protein", "lb", "protein", 12.00, "iberico"),
    ("ground_pork", "Ground Pork", "Protein", "lb", "protein", 5.50, "iberico"),
    ("lamb_chop", "Lamb Chops (frenched)", "Protein", "lb", "protein", 28.00, "iberico"),
    ("secreto", "Secreto Ibérico", "Protein", "lb", "protein", 32.00, "iberico"),
    ("chicken_thigh", "Chicken Thighs (boneless)", "Protein", "lb", "protein", 4.80, "iberico"),
    # Seafood
    ("boquerones", "White Anchovies (boquerones)", "Seafood", "lb", "seafood", 18.00, "greatlakes"),
    ("shrimp_16_20", "Shrimp 16/20", "Seafood", "lb", "seafood", 14.50, "greatlakes"),
    ("octopus", "Spanish Octopus (frozen)", "Seafood", "lb", "seafood", 12.00, "greatlakes"),
    ("calamari", "Calamari Tubes & Tentacles", "Seafood", "lb", "seafood", 9.50, "greatlakes"),
    ("mussel", "PEI Mussels", "Seafood", "lb", "seafood", 4.50, "greatlakes"),
    ("clam", "Littleneck Clams", "Seafood", "dz", "seafood", 9.00, "greatlakes"),
    ("cod", "Atlantic Cod Fillets", "Seafood", "lb", "seafood", 13.00, "greatlakes"),
    # Dairy
    ("manchego", "Manchego Cheese (aged 6mo)", "Dairy", "lb", "dairy", 16.00, "iberico"),
    ("eggs", "Eggs (large)", "Dairy", "dz", "dairy", 4.80, "coastal"),
    ("heavy_cream", "Heavy Cream", "Dairy", "L", "dairy", 6.50, "coastal"),
    ("butter", "European Butter", "Dairy", "lb", "dairy", 7.00, "coastal"),
    ("queso_fresco", "Queso Fresco", "Dairy", "lb", "dairy", 8.00, "iberico"),
    # Dry goods
    ("ap_flour", "All-Purpose Flour", "Dry Goods", "bag", "dry", 8.00, "midwest"),
    ("panko", "Panko Breadcrumbs", "Dry Goods", "bag", "dry", 5.50, "midwest"),
    ("bomba_rice", "Bomba Rice", "Dry Goods", "kg", "dry", 14.00, "midwest"),
    ("sugar", "Granulated Sugar", "Dry Goods", "bag", "dry", 6.00, "midwest"),
    ("chocolate_70", "Chocolate 70% (Valrhona)", "Dry Goods", "kg", "dry", 28.00, "midwest"),
    ("ground_almond", "Ground Almonds (Marcona)", "Dry Goods", "lb", "dry", 18.00, "midwest"),
    ("cayenne", "Cayenne Pepper", "Dry Goods", "ea", "dry", 6.00, "midwest"),
    ("arborio_rice", "Arborio Rice", "Dry Goods", "kg", "dry", 6.00, "midwest"),
    # Beverages
    ("house_red", "House Red Wine (Garnacha)", "Beverage", "cs", "wine", 72.00, "vinoteca"),
    ("house_white", "House White Wine (Albariño)", "Beverage", "cs", "wine", 84.00, "vinoteca"),
    ("vermouth_lustau", "Lustau Vermut Rojo", "Beverage", "btl", "spirits", 18.00, "vinoteca"),
    ("sangria_base", "Sangría Base (house blend)", "Beverage", "L", "wine", 8.00, "vinoteca"),
    ("cava", "Cava Brut (Codorníu)", "Beverage", "btl", "wine", 11.00, "vinoteca"),
    ("brandy", "Brandy de Jerez", "Beverage", "btl", "spirits", 24.00, "vinoteca"),
    ("milk", "Whole Milk", "Dairy", "L", "dairy", 2.80, "coastal"),
]

ITEM_IDS: dict[str, uuid.UUID] = {row[0]: uid() for row in ITEMS_DEF}

# ═══════════════════════════════════════════════════════════════════════════════
# 3. MENU + RECIPES
# ═══════════════════════════════════════════════════════════════════════════════

# (key, display_name, section, price, cost_price, popularity_weight, recipe_ingredients)
# recipe_ingredients: list of (item_key, qty_per_serving, unit)
MENU_DEF: list[tuple[str, str, str, float, float, float, list[tuple[str, float, str]]]] = [
    # ── Tapas Frías ──
    ("pan_con_tomate", "Pan con Tomate", "Tapas Frías", 9.00, 1.85, 12, [
        ("roma_tomato", 0.15, "kg"), ("evoo", 0.02, "L"), ("garlic", 0.01, "lb"),
    ]),
    ("gazpacho", "Gazpacho", "Tapas Frías", 11.00, 2.20, 8, [
        ("roma_tomato", 0.3, "kg"), ("evoo", 0.03, "L"), ("sherry_vinegar", 0.01, "btl"),
        ("garlic", 0.005, "lb"), ("onion_yellow", 0.02, "bag"),
    ]),
    ("boquerones_vinagre", "Boquerones en Vinagre", "Tapas Frías", 13.00, 3.80, 7, [
        ("boquerones", 0.12, "lb"), ("evoo", 0.02, "L"), ("garlic", 0.005, "lb"),
        ("parsley", 0.1, "bch"), ("lemon", 0.01, "cs"),
    ]),
    ("jamon_plate", "Jamón Ibérico", "Tapas Frías", 18.00, 5.85, 10, [
        ("jamon_iberico", 0.09, "lb"), ("evoo", 0.01, "L"),
    ]),
    ("ensaladilla", "Ensaladilla Rusa", "Tapas Frías", 11.00, 2.40, 6, [
        ("potato_yukon", 0.05, "cs"), ("eggs", 0.08, "dz"), ("evoo", 0.02, "L"),
        ("lemon", 0.005, "cs"),
    ]),
    ("manchego_board", "Queso Manchego Board", "Tapas Frías", 15.00, 4.20, 8, [
        ("manchego", 0.15, "lb"), ("marcona_almond", 0.04, "lb"), ("evoo", 0.01, "L"),
    ]),
    ("pulpo_gallega", "Pulpo a la Gallega", "Tapas Frías", 16.00, 4.80, 6, [
        ("octopus", 0.2, "lb"), ("potato_yukon", 0.03, "cs"), ("smoked_paprika", 0.002, "ea"),
        ("evoo", 0.02, "L"),
    ]),
    # ── Tapas Calientes ──
    ("patatas_bravas", "Patatas Bravas", "Tapas Calientes", 10.00, 1.60, 15, [
        ("potato_yukon", 0.06, "cs"), ("evoo", 0.04, "L"), ("roma_tomato", 0.08, "kg"),
        ("smoked_paprika", 0.001, "ea"), ("cayenne", 0.001, "ea"), ("garlic", 0.005, "lb"),
    ]),
    ("croquetas", "Croquetas de Jamón", "Tapas Calientes", 12.00, 2.90, 14, [
        ("jamon_iberico", 0.04, "lb"), ("butter", 0.03, "lb"), ("ap_flour", 0.01, "bag"),
        ("milk", 0.05, "L"), ("panko", 0.01, "bag"), ("eggs", 0.08, "dz"),
    ]),
    ("gambas", "Gambas al Ajillo", "Tapas Calientes", 14.00, 3.60, 12, [
        ("shrimp_16_20", 0.2, "lb"), ("garlic", 0.02, "lb"), ("evoo", 0.04, "L"),
        ("guindilla", 0.5, "ea"), ("parsley", 0.1, "bch"),
    ]),
    ("padrones", "Pimientos de Padrón", "Tapas Calientes", 10.00, 2.10, 10, [
        ("padron_pepper", 0.18, "lb"), ("evoo", 0.03, "L"),
    ]),
    ("tortilla", "Tortilla Española", "Tapas Calientes", 11.00, 2.00, 9, [
        ("potato_yukon", 0.06, "cs"), ("eggs", 0.17, "dz"), ("onion_yellow", 0.015, "bag"),
        ("evoo", 0.03, "L"),
    ]),
    ("albondigas", "Albóndigas", "Tapas Calientes", 13.00, 3.10, 8, [
        ("ground_pork", 0.18, "lb"), ("roma_tomato", 0.12, "kg"), ("onion_yellow", 0.01, "bag"),
        ("garlic", 0.005, "lb"), ("eggs", 0.04, "dz"), ("panko", 0.005, "bag"),
    ]),
    ("calamares", "Calamares Fritos", "Tapas Calientes", 13.00, 3.20, 9, [
        ("calamari", 0.18, "lb"), ("ap_flour", 0.008, "bag"), ("lemon", 0.005, "cs"),
        ("evoo", 0.03, "L"),
    ]),
    ("chorizo_vino", "Chorizo al Vino", "Tapas Calientes", 12.00, 2.70, 8, [
        ("chorizo", 0.15, "lb"), ("house_red", 0.005, "cs"),
    ]),
    # ── Raciones ──
    ("paella", "Paella de Mariscos", "Raciones", 32.00, 9.80, 5, [
        ("bomba_rice", 0.12, "kg"), ("shrimp_16_20", 0.15, "lb"), ("mussel", 0.2, "lb"),
        ("clam", 0.25, "dz"), ("saffron", 0.15, "g"), ("evoo", 0.03, "L"),
        ("roma_tomato", 0.08, "kg"), ("garlic", 0.01, "lb"), ("onion_yellow", 0.01, "bag"),
    ]),
    ("arroz_negro", "Arroz Negro", "Raciones", 28.00, 7.60, 4, [
        ("bomba_rice", 0.12, "kg"), ("calamari", 0.15, "lb"), ("garlic", 0.01, "lb"),
        ("onion_yellow", 0.01, "bag"), ("evoo", 0.03, "L"),
    ]),
    ("cordero", "Chuletas de Cordero", "Raciones", 35.00, 10.50, 3, [
        ("lamb_chop", 0.35, "lb"), ("evoo", 0.02, "L"), ("garlic", 0.01, "lb"),
        ("parsley", 0.1, "bch"), ("lemon", 0.005, "cs"),
    ]),
    ("secreto_plate", "Secreto Ibérico", "Raciones", 30.00, 9.20, 4, [
        ("secreto", 0.28, "lb"), ("evoo", 0.02, "L"), ("padron_pepper", 0.06, "lb"),
    ]),
    # ── Postres ──
    ("crema_catalana", "Crema Catalana", "Postres", 11.00, 1.80, 7, [
        ("eggs", 0.17, "dz"), ("heavy_cream", 0.1, "L"), ("sugar", 0.005, "bag"),
        ("lemon", 0.003, "cs"), ("milk", 0.05, "L"),
    ]),
    ("churros", "Churros con Chocolate", "Postres", 10.00, 1.50, 8, [
        ("ap_flour", 0.01, "bag"), ("eggs", 0.04, "dz"), ("sugar", 0.004, "bag"),
        ("chocolate_70", 0.04, "kg"), ("butter", 0.01, "lb"), ("milk", 0.03, "L"),
    ]),
    ("tarta_santiago", "Tarta de Santiago", "Postres", 13.00, 2.60, 5, [
        ("ground_almond", 0.12, "lb"), ("eggs", 0.12, "dz"), ("sugar", 0.008, "bag"),
        ("lemon", 0.003, "cs"), ("butter", 0.02, "lb"),
    ]),
    # ── Bebidas ──
    ("sangria", "Sangría (jarra)", "Bebidas", 14.00, 3.20, 10, [
        ("sangria_base", 0.5, "L"), ("brandy", 0.01, "btl"), ("lemon", 0.005, "cs"),
        ("sugar", 0.002, "bag"),
    ]),
    ("vermouth_copa", "Copa de Vermouth", "Bebidas", 10.00, 2.40, 7, [
        ("vermouth_lustau", 0.07, "btl"), ("lemon", 0.003, "cs"),
    ]),
    ("vino_tinto", "Vino Tinto (copa)", "Bebidas", 13.00, 2.60, 9, [
        ("house_red", 0.008, "cs"),
    ]),
    ("vino_blanco", "Vino Blanco (copa)", "Bebidas", 12.00, 2.80, 8, [
        ("house_white", 0.008, "cs"),
    ]),
    ("cava_copa", "Copa de Cava", "Bebidas", 14.00, 3.00, 6, [
        ("cava", 0.07, "btl"),
    ]),
]

RECIPE_IDS: dict[str, uuid.UUID] = {row[0]: uid() for row in MENU_DEF}
MENU_ITEM_IDS: dict[str, uuid.UUID] = {row[0]: uid() for row in MENU_DEF}

# Sub-recipes
SUB_RECIPES = [
    ("aioli", "Aioli", "Base", [
        ("garlic", 0.02, "lb"), ("eggs", 0.04, "dz"), ("evoo", 0.08, "L"),
        ("lemon", 0.003, "cs"),
    ]),
    ("bravas_sauce", "Bravas Sauce", "Base", [
        ("roma_tomato", 0.2, "kg"), ("smoked_paprika", 0.003, "ea"),
        ("cayenne", 0.002, "ea"), ("garlic", 0.01, "lb"), ("evoo", 0.02, "L"),
        ("sherry_vinegar", 0.005, "btl"),
    ]),
    ("romesco", "Romesco Sauce", "Base", [
        ("roma_tomato", 0.15, "kg"), ("marcona_almond", 0.05, "lb"),
        ("garlic", 0.01, "lb"), ("evoo", 0.03, "L"), ("sherry_vinegar", 0.005, "btl"),
        ("smoked_paprika", 0.002, "ea"),
    ]),
    ("sofrito", "Sofrito", "Base", [
        ("roma_tomato", 0.25, "kg"), ("onion_yellow", 0.02, "bag"),
        ("garlic", 0.015, "lb"), ("evoo", 0.03, "L"),
    ]),
]
SUB_RECIPE_IDS: dict[str, uuid.UUID] = {r[0]: uid() for r in SUB_RECIPES}

# ─── Daily cover/revenue patterns by day-of-week ─────────────────────────────
# (min_covers, max_covers, min_rev, max_rev)
DAY_PATTERNS = {
    0: (35, 45, 2800, 3500),   # Mon
    1: (35, 45, 2800, 3500),   # Tue
    2: (45, 55, 3500, 4200),   # Wed — Wine Wednesday
    3: (55, 70, 4500, 5500),   # Thu
    4: (70, 90, 6000, 7500),   # Fri
    5: (85, 110, 7500, 9500),  # Sat
    6: (50, 65, 4000, 5200),   # Sun
}


# ═══════════════════════════════════════════════════════════════════════════════
# BUILD FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def build_foundation() -> list:
    """Location, Org, WorkspaceLocation, GL, UoM, Vendors."""
    objects = []

    # Location
    objects.append(Location(
        id=LOC_ID, name="Carabiner Tapas", code="CT-001",
        address="742 N Wells St, Chicago, IL 60654", timezone="America/Chicago",
    ))

    # Organization + WorkspaceLocation
    objects.append(Organization(id=ORG_ID, name="Carabiner Tapas LLC", slug="carabiner-tapas"))
    objects.append(WorkspaceLocation(
        id=WS_LOC_ID, org_id=ORG_ID, slug="main-kitchen", name="Main Kitchen",
        city="Chicago", status="Stable", sales_delta="+4.2%", labor_delta="-1.1%",
    ))

    # GL Accounts
    for key, code, name, cat in GL_DEFS:
        objects.append(GLAccount(id=GL[key], code=code, name=name, category=cat))

    # Units of Measure
    for name, abbr in UOMS_DEF:
        uom_id = uid()
        UOM[abbr] = uom_id
        objects.append(UnitOfMeasure(id=uom_id, name=name, abbreviation=abbr))

    # Vendors
    for key, name, email, phone, terms in VENDORS_DEF:
        objects.append(Vendor(
            id=VENDOR_IDS[key], name=name, contact_email=email,
            contact_phone=phone, payment_terms=terms,
        ))

    return objects


def build_items() -> list:
    """Ingredient items."""
    objects = []
    for key, name, cat, uom_abbr, gl_key, price, _vendor in ITEMS_DEF:
        objects.append(Item(
            id=ITEM_IDS[key], name=name, category=cat,
            default_uom_id=UOM[uom_abbr], gl_account_id=GL[gl_key],
            last_known_price=D4(price),
        ))
    return objects


def build_recipes() -> list:
    """Recipes + RecipeIngredients for menu items and sub-recipes."""
    objects = []

    # Sub-recipes
    for key, name, cat, ingredients in SUB_RECIPES:
        r = Recipe(
            id=SUB_RECIPE_IDS[key], name=name, category=cat,
            yield_quantity=D4(1), yield_unit="batch",
            instructions=f"House {name.lower()} — see laminated recipe card.",
            is_sub_recipe=True,
        )
        objects.append(r)
        for item_key, qty, unit in ingredients:
            objects.append(RecipeIngredient(
                id=uid(), recipe_id=SUB_RECIPE_IDS[key],
                item_id=ITEM_IDS[item_key], quantity=D4(qty), unit=unit,
            ))

    # Menu recipes
    for key, display, section, price, cost, _pop, ingredients in MENU_DEF:
        r = Recipe(
            id=RECIPE_IDS[key], name=display, category=section,
            yield_quantity=D4(1), yield_unit="serving",
            instructions=f"Plating: see {display} spec on KDS.",
            is_sub_recipe=False,
        )
        objects.append(r)
        for item_key, qty, unit in ingredients:
            objects.append(RecipeIngredient(
                id=uid(), recipe_id=RECIPE_IDS[key],
                item_id=ITEM_IDS[item_key], quantity=D4(qty), unit=unit,
            ))

    return objects


def build_menu_items() -> list:
    """MenuItem rows (location-scoped)."""
    objects = []
    for key, display, section, price, _cost, _pop, _ing in MENU_DEF:
        objects.append(MenuItem(
            id=MENU_ITEM_IDS[key], recipe_id=RECIPE_IDS[key], location_id=LOC_ID,
            display_name=display, section=section, price=D(price), is_active=True,
        ))
    return objects


def build_daily_sales() -> dict[date, dict]:
    """Generate daily POS sales and product mix for March 2026.
    Returns {date: {total, food, bev, covers, checks, pmix: [(menu_key, qty, revenue)]}}
    """
    daily: dict[date, dict] = {}
    d = START
    while d <= END:
        dow = d.weekday()
        mn_cov, mx_cov, mn_rev, mx_rev = DAY_PATTERNS[dow]
        covers = random.randint(mn_cov, mx_cov)
        total_rev = D(random.uniform(mn_rev, mx_rev))
        food_rev = D(float(total_rev) * random.uniform(0.70, 0.74))
        bev_rev = total_rev - food_rev
        checks = max(1, covers // random.randint(2, 3))

        # Separate food and beverage items with independent weight pools
        food_items = [(m[0], m[5], D(m[3])) for m in MENU_DEF if m[2] != "Bebidas"]
        bev_items = [(m[0], m[5], D(m[3])) for m in MENU_DEF if m[2] == "Bebidas"]
        food_weight = sum(w for _, w, _ in food_items)
        bev_weight = sum(w for _, w, _ in bev_items)

        pmix = []
        for mk, w, price in food_items:
            share = w / food_weight
            item_rev = D(float(food_rev) * share * random.uniform(0.85, 1.15))
            qty = max(1, int(float(item_rev) / float(price)))
            item_rev = D(qty * float(price))
            pmix.append((mk, qty, item_rev))
        for mk, w, price in bev_items:
            share = w / bev_weight
            item_rev = D(float(bev_rev) * share * random.uniform(0.85, 1.15))
            qty = max(1, int(float(item_rev) / float(price)))
            item_rev = D(qty * float(price))
            pmix.append((mk, qty, item_rev))

        actual_total = sum(r for _, _, r in pmix)
        actual_food = sum(r for mk, _, r in pmix
                         if next(m for m in MENU_DEF if m[0] == mk)[2] != "Bebidas")
        actual_bev = actual_total - actual_food

        daily[d] = {
            "total": actual_total,
            "food": actual_food,
            "bev": actual_bev,
            "covers": covers,
            "checks": checks,
            "pmix": pmix,
        }
        d += timedelta(days=1)
    return daily


def build_pos(daily_sales: dict[date, dict]) -> list:
    """PosSales + PosProductMix."""
    objects = []
    for d, info in daily_sales.items():
        objects.append(PosSales(
            id=uid(), location_id=LOC_ID, sales_date=d,
            total_sales=info["total"], food_sales=info["food"],
            beverage_sales=info["bev"], guest_count=info["covers"],
            check_count=info["checks"],
        ))
        for mk, qty, rev in info["pmix"]:
            objects.append(PosProductMix(
                id=uid(), location_id=LOC_ID, menu_item_id=MENU_ITEM_IDS[mk],
                sales_date=d, quantity_sold=qty, revenue=rev,
            ))
    return objects


def build_invoices() -> tuple[list, dict[date, Decimal]]:
    """Invoices + InvoiceLineItems. Returns (objects, {date: purchases_total})."""
    objects = []
    purchases_by_date: dict[date, Decimal] = {}

    # Group items by vendor
    vendor_items: dict[str, list] = {}
    for key, name, cat, uom, gl, price, vk in ITEMS_DEF:
        vendor_items.setdefault(vk, []).append((key, name, price))

    invoice_num = 1000
    for week_start_offset in range(0, 31, 7):  # 5 weeks
        week_start = START + timedelta(days=week_start_offset)
        if week_start > END:
            break

        for vk, vname_short in [("coastal", "CP"), ("iberico", "ID"), ("greatlakes", "GLS"),
                                 ("midwest", "MDG"), ("vinoteca", "VS")]:
            items = vendor_items.get(vk, [])
            if not items:
                continue

            # Delivery day: Mon for produce/seafood, Tue for others
            delivery_offset = 0 if vk in ("coastal", "greatlakes") else 1
            inv_date = week_start + timedelta(days=delivery_offset)
            if inv_date > END:
                continue
            due_date = inv_date + timedelta(days=15 if vk in ("coastal", "greatlakes") else 30)

            # Status based on week
            week_num = week_start_offset // 7
            if week_num <= 1:
                status = "paid"
            elif week_num == 2:
                status = "approved"
            elif week_num == 3:
                status = "pending"
            else:
                status = "pending"

            # Special: one disputed invoice (shrimp price discrepancy)
            if vk == "greatlakes" and week_num == 2:
                status = "disputed"

            invoice_id = uid()
            invoice_num += 1
            subtotal = Decimal("0")
            line_objects = []

            for item_key, item_name, base_price in items:
                # Realistic order quantities — weekly usage × 1.2 buffer
                # Average ~60 covers/day = 420/week
                qty = D4(random.uniform(3, 25))
                # Some items ordered in bulk
                if item_key in ("evoo", "potato_yukon", "roma_tomato"):
                    qty = D4(random.uniform(8, 20))
                elif item_key in ("saffron", "guindilla"):
                    qty = D4(random.uniform(2, 8))
                elif item_key in ("house_red", "house_white", "cava"):
                    qty = D4(random.uniform(2, 6))

                price_var = base_price * random.uniform(0.97, 1.04)
                unit_price = D4(price_var)
                line_total = D(float(qty) * float(unit_price))
                subtotal += line_total

                line_objects.append(InvoiceLineItem(
                    id=uid(), invoice_id=invoice_id, item_id=ITEM_IDS[item_key],
                    description=item_name, quantity=qty, unit_price=unit_price, total=line_total,
                    gl_account_id=GL[next(i[4] for i in ITEMS_DEF if i[0] == item_key)],
                ))

            tax = D(float(subtotal) * 0.0825)
            total = subtotal + tax

            objects.append(Invoice(
                id=invoice_id, vendor_id=VENDOR_IDS[vk], location_id=LOC_ID,
                invoice_number=f"{vname_short}-{invoice_num}",
                invoice_date=inv_date, due_date=due_date,
                subtotal=subtotal, tax=tax, total=total, status=status,
            ))
            objects.extend(line_objects)

            # Track purchases by date
            purchases_by_date[inv_date] = purchases_by_date.get(inv_date, Decimal("0")) + subtotal

    return objects, purchases_by_date


def build_inventory() -> list:
    """InventoryCounts + lines + ParLevels + WasteLogs."""
    objects = []

    # Par levels for all items (weekday and weekend)
    for key, name, cat, uom, gl, price, vk in ITEMS_DEF:
        base_par = random.uniform(5, 30)
        if key in ("saffron",):
            base_par = random.uniform(5, 15)
        elif key in ("evoo", "potato_yukon", "roma_tomato"):
            base_par = random.uniform(20, 50)
        elif key in ("house_red", "house_white"):
            base_par = random.uniform(4, 10)

        # Weekday par (null day_of_week = all days)
        objects.append(ParLevel(
            id=uid(), location_id=LOC_ID, item_id=ITEM_IDS[key],
            min_quantity=D4(base_par), day_of_week=None,
        ))

    # Weekly inventory counts (Sundays) + 2 spot checks
    count_dates = [
        (date(2026, 3, 1), "full"),
        (date(2026, 3, 8), "full"),
        (date(2026, 3, 12), "spot"),
        (date(2026, 3, 15), "full"),
        (date(2026, 3, 22), "full"),
        (date(2026, 3, 25), "spot"),
        (date(2026, 3, 29), "full"),
    ]

    for cd, ctype in count_dates:
        if cd > TODAY:
            status = "in_progress"
        else:
            status = "completed"

        count_id = uid()
        objects.append(InventoryCount(
            id=count_id, location_id=LOC_ID, count_date=cd,
            count_type=ctype, status=status,
        ))

        items_to_count = ITEMS_DEF if ctype == "full" else random.sample(ITEMS_DEF, 20)
        for item_row in items_to_count:
            key = item_row[0]
            price = item_row[5]
            # Simulate declining inventory with deliveries
            day_in_month = (cd - START).days
            base = random.uniform(8, 40)
            # Reduce over time, especially fresh items
            if item_row[2] in ("Produce", "Seafood", "Dairy"):
                freshness_decay = day_in_month * 0.4
            else:
                freshness_decay = day_in_month * 0.15
            qty = max(0.5, base - freshness_decay + random.uniform(-3, 8))

            # Some items critically low near end of month
            if cd >= date(2026, 3, 22) and key in ("shrimp_16_20", "padron_pepper", "boquerones", "heavy_cream"):
                qty = random.uniform(0.5, 2.5)

            storage = random.choice(["Walk-in", "Dry Storage", "Prep Station", "Bar"])
            if item_row[2] in ("Produce", "Seafood", "Dairy"):
                storage = "Walk-in"
            elif item_row[2] == "Beverage":
                storage = "Bar"
            elif item_row[2] == "Dry Goods":
                storage = "Dry Storage"

            objects.append(InventoryCountLine(
                id=uid(), count_id=count_id, item_id=ITEM_IDS[key],
                quantity=D4(qty), unit_cost=D4(price), storage_area=storage,
            ))

    # Waste logs (2-5 per week)
    d = START
    while d <= min(TODAY, END):
        if random.random() < 0.4:  # ~3 per week
            waste_items = random.sample(
                [i for i in ITEMS_DEF if i[2] in ("Produce", "Seafood", "Dairy")],
                k=random.randint(1, 2),
            )
            for wi in waste_items:
                reason = random.choice(["spoilage", "overproduction", "expired"])
                qty = D4(random.uniform(0.2, 3.0))
                notes = {
                    "spoilage": f"{wi[1]} — found soft/discolored during AM check",
                    "overproduction": f"Over-prepped {wi[1]} for slow service",
                    "expired": f"{wi[1]} past use-by date",
                }[reason]
                objects.append(WasteLog(
                    id=uid(), location_id=LOC_ID, item_id=ITEM_IDS[wi[0]],
                    quantity=qty, unit=wi[3], reason=reason,
                    notes=notes, waste_date=d,
                ))
        d += timedelta(days=1)

    return objects


def build_food_cost_and_pl(
    daily_sales: dict[date, dict],
    purchases_by_date: dict[date, Decimal],
) -> list:
    """DailyFoodCost + DailyPL + BudgetPeriod."""
    objects = []

    # Starting inventory value
    beginning = D(12500)

    d = START
    while d <= min(TODAY, END):
        sales = daily_sales[d]["total"]
        purchases = purchases_by_date.get(d, Decimal("0"))

        # Theoretical food cost based on menu item costs × quantities sold
        theo = Decimal("0")
        for mk, qty, _ in daily_sales[d]["pmix"]:
            item_def = next(m for m in MENU_DEF if m[0] == mk)
            theo += D(qty * item_def[4])

        # Ending inventory = beginning + purchases - usage (with slight variance)
        usage = D(float(theo) * random.uniform(1.02, 1.10))  # 2-10% higher than theoretical
        ending = beginning + purchases - usage
        if ending < D(3000):
            ending = D(random.uniform(3000, 5000))
        actual_fc = beginning + purchases - ending
        fc_pct = D(float(actual_fc) / float(sales) * 100) if sales > 0 else D(0)

        objects.append(DailyFoodCost(
            id=uid(), location_id=LOC_ID, cost_date=d,
            beginning_inventory=beginning, purchases=purchases,
            ending_inventory=ending, actual_food_cost=actual_fc,
            theoretical_food_cost=theo, sales=sales, food_cost_pct=fc_pct,
        ))

        # P&L
        revenue = sales
        cogs = actual_fc
        # Labor: ~30-34%, inversely correlated with volume
        dow = d.weekday()
        base_labor_pct = 0.32 if dow in (4, 5) else 0.34 if dow in (0, 1) else 0.33
        labor = D(float(revenue) * base_labor_pct * random.uniform(0.95, 1.05))
        labor_pct = D(float(labor) / float(revenue) * 100) if revenue > 0 else D(0)

        objects.append(DailyPL(
            id=uid(), location_id=LOC_ID, pl_date=d,
            beginning_inventory=beginning, purchases=purchases,
            ending_inventory=ending, cogs=cogs, revenue=revenue,
            food_cost_pct=fc_pct, labor_cost=labor, labor_pct=labor_pct,
        ))

        beginning = ending
        d += timedelta(days=1)

    # Budget period
    objects.append(BudgetPeriod(
        id=uid(), location_id=LOC_ID,
        period_start=START, period_end=END,
        target_food_cost_pct=D(30), target_labor_pct=D(32),
        target_revenue=D(155000),
    ))

    return objects


def build_prep_lists(daily_sales: dict[date, dict]) -> list:
    """Daily prep lists tied to expected covers."""
    objects = []

    # Prep-worthy recipes (things that need advance prep)
    prep_recipes = [
        "bravas_sauce", "aioli", "romesco", "sofrito",
        "croquetas", "gazpacho", "ensaladilla", "tortilla",
        "albondigas", "crema_catalana", "tarta_santiago", "churros",
    ]

    d = START
    while d <= END:
        if d > TODAY:
            status = "generated"
        elif d == TODAY:
            status = "in_progress"
        else:
            status = "completed"

        pl_id = uid()
        objects.append(PrepList(
            id=pl_id, location_id=LOC_ID, prep_date=d, status=status,
        ))

        dow = d.weekday()
        expected_covers = (DAY_PATTERNS[dow][0] + DAY_PATTERNS[dow][1]) // 2

        for recipe_key in prep_recipes:
            # Quantity based on expected covers
            if recipe_key in SUB_RECIPE_IDS:
                rid = SUB_RECIPE_IDS[recipe_key]
            else:
                rid = RECIPE_IDS[recipe_key]

            qty_needed = D4(expected_covers * random.uniform(0.15, 0.35))
            on_hand = D4(float(qty_needed) * random.uniform(0.0, 0.3))
            to_prep = qty_needed - on_hand

            is_complete = status == "completed" or (
                status == "in_progress" and random.random() < 0.6
            )
            completed_qty = to_prep if is_complete else None
            completed_at_val = dt(d, random.randint(8, 14)) if is_complete else None

            objects.append(PrepListItem(
                id=uid(), prep_list_id=pl_id, recipe_id=rid,
                qty_needed=qty_needed, on_hand=on_hand, to_prep=to_prep,
                is_complete=is_complete, completed_qty=completed_qty,
                completed_at=completed_at_val,
            ))

        d += timedelta(days=1)

    return objects


def build_purchase_orders() -> list:
    """PurchaseOrders + lines."""
    objects = []
    vendor_items: dict[str, list] = {}
    for key, name, cat, uom, gl, price, vk in ITEMS_DEF:
        vendor_items.setdefault(vk, []).append((key, name, price))

    po_num = 5000
    for week_start_offset in range(0, 35, 7):
        week_start = START + timedelta(days=week_start_offset)
        if week_start > END + timedelta(days=3):
            break

        for vk in VENDOR_IDS:
            items = vendor_items.get(vk, [])
            if not items:
                continue

            order_date = week_start
            if order_date > END:
                continue
            delivery = order_date + timedelta(days=random.choice([1, 2]))

            week_num = week_start_offset // 7
            if week_num <= 1:
                status = "received"
            elif week_num == 2:
                status = "received"
            elif week_num == 3:
                status = "confirmed"
            else:
                status = "submitted"

            po_id = uid()
            po_num += 1
            total = Decimal("0")
            po_lines = []

            for item_key, item_name, base_price in items:
                qty = D4(random.uniform(3, 20))
                est_price = D4(base_price)
                po_lines.append(PurchaseOrderLine(
                    id=uid(), purchase_order_id=po_id,
                    item_id=ITEM_IDS[item_key], quantity=qty,
                    estimated_price=est_price,
                ))
                total += D(float(qty) * float(est_price))

            objects.append(PurchaseOrder(
                id=po_id, vendor_id=VENDOR_IDS[vk], location_id=LOC_ID,
                po_number=f"PO-{po_num}", order_date=order_date,
                expected_delivery=delivery, status=status, total=total,
            ))
            objects.extend(po_lines)

    return objects


def build_order_guides() -> list:
    """One OrderGuide per vendor."""
    objects = []
    vendor_items: dict[str, list] = {}
    for key, name, cat, uom, gl, price, vk in ITEMS_DEF:
        vendor_items.setdefault(vk, []).append(key)

    for vk in VENDOR_IDS:
        og_id = uid()
        vendor_name = next(v[1] for v in VENDORS_DEF if v[0] == vk)
        objects.append(OrderGuide(
            id=og_id, location_id=LOC_ID, vendor_id=VENDOR_IDS[vk],
            name=f"{vendor_name} — Weekly Guide",
        ))
        for item_key in vendor_items.get(vk, []):
            objects.append(OrderGuideItem(
                id=uid(), order_guide_id=og_id, item_id=ITEM_IDS[item_key],
                par_level=D4(random.uniform(5, 30)),
            ))

    return objects


def build_price_alerts() -> list:
    """Recent price spike alerts."""
    return [
        PriceAlert(
            id=uid(), location_id=LOC_ID, item_id=ITEM_IDS["shrimp_16_20"],
            vendor_id=VENDOR_IDS["greatlakes"],
            previous_price=D4(12.80), new_price=D4(14.50),
            pct_change=D(13.28), alert_date=date(2026, 3, 18), acknowledged=False,
        ),
        PriceAlert(
            id=uid(), location_id=LOC_ID, item_id=ITEM_IDS["evoo"],
            vendor_id=VENDOR_IDS["coastal"],
            previous_price=D4(16.50), new_price=D4(18.00),
            pct_change=D(9.09), alert_date=date(2026, 3, 15), acknowledged=True,
        ),
        PriceAlert(
            id=uid(), location_id=LOC_ID, item_id=ITEM_IDS["jamon_iberico"],
            vendor_id=VENDOR_IDS["iberico"],
            previous_price=D4(60.00), new_price=D4(65.00),
            pct_change=D(8.33), alert_date=date(2026, 3, 10), acknowledged=True,
        ),
        PriceAlert(
            id=uid(), location_id=LOC_ID, item_id=ITEM_IDS["octopus"],
            vendor_id=VENDOR_IDS["greatlakes"],
            previous_price=D4(10.50), new_price=D4(12.00),
            pct_change=D(14.29), alert_date=date(2026, 3, 20), acknowledged=False,
        ),
        PriceAlert(
            id=uid(), location_id=LOC_ID, item_id=ITEM_IDS["butter"],
            vendor_id=VENDOR_IDS["coastal"],
            previous_price=D4(6.20), new_price=D4(7.00),
            pct_change=D(12.90), alert_date=date(2026, 3, 21), acknowledged=False,
        ),
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# WORKSPACE TABLES (frontend-facing)
# ═══════════════════════════════════════════════════════════════════════════════

def build_workspace_orders() -> list:
    """Recent vendor orders for the frontend."""
    orders = [
        ("Coastal Produce", "Email", "Delivered", "$1,240.00", "Delivered Mar 22",
         [{"item": "Roma Tomatoes", "qty": "5 cs", "price": "$140.00"},
          {"item": "Yukon Gold Potatoes", "qty": "4 cs", "price": "$128.00"},
          {"item": "EVOO", "qty": "6 L", "price": "$108.00"},
          {"item": "Garlic", "qty": "8 lb", "price": "$36.00"},
          {"item": "Eggs", "qty": "10 dz", "price": "$48.00"}],
         "Weekly produce delivery. All items received, quality good. Roma tomatoes slightly under-ripe — hold 1 day."),
        ("Great Lakes Seafood", "Phone", "In Transit", "$890.00", "ETA Mar 23 2PM",
         [{"item": "Shrimp 16/20", "qty": "12 lb", "price": "$174.00"},
          {"item": "Octopus", "qty": "8 lb", "price": "$96.00"},
          {"item": "Calamari", "qty": "10 lb", "price": "$95.00"},
          {"item": "Mussels", "qty": "15 lb", "price": "$67.50"}],
         "Seafood delivery en route. Driver confirmed 2 PM arrival. Shrimp price up 13% — flagged."),
        ("Ibérico Direct", "Portal", "Confirmed", "$1,650.00", "ETA Mar 24",
         [{"item": "Jamón Ibérico", "qty": "4 lb", "price": "$260.00"},
          {"item": "Chorizo Links", "qty": "10 lb", "price": "$120.00"},
          {"item": "Manchego", "qty": "6 lb", "price": "$96.00"},
          {"item": "Secreto Ibérico", "qty": "8 lb", "price": "$256.00"}],
         "Spanish imports — weekly order. Jamón price stable. New Secreto cut available, sampled last week."),
        ("Midwest Dry Goods", "Email", "Delivered", "$420.00", "Delivered Mar 20",
         [{"item": "Bomba Rice", "qty": "5 kg", "price": "$70.00"},
          {"item": "AP Flour", "qty": "3 bag", "price": "$24.00"},
          {"item": "Panko", "qty": "4 bag", "price": "$22.00"},
          {"item": "Valrhona 70%", "qty": "2 kg", "price": "$56.00"}],
         "Dry goods restocked. Bomba rice supply tight — Midwest says next shipment may be delayed 3 days."),
        ("Vinoteca Supply", "Portal", "Ready to send", "$980.00", "Draft",
         [{"item": "Garnacha (cs)", "qty": "3 cs", "price": "$216.00"},
          {"item": "Albariño (cs)", "qty": "2 cs", "price": "$168.00"},
          {"item": "Lustau Vermut", "qty": "6 btl", "price": "$108.00"},
          {"item": "Cava Brut", "qty": "8 btl", "price": "$88.00"}],
         "Wine & spirits order for weekend. Need to finalize before noon — Vinoteca cuts off orders at 1 PM."),
        ("Coastal Produce", "Email", "Drafting", "$0.00", "Not submitted",
         [{"item": "Pimientos de Padrón", "qty": "6 lb", "price": "$84.00"},
          {"item": "Fresh Basil", "qty": "4 bch", "price": "$8.00"}],
         "Padrón peppers running critically low — need rush order. Basil also below par."),
    ]
    objects = []
    for vendor, channel, status, total, eta, items, summary in orders:
        objects.append(WorkspaceOrder(
            id=uid(), location_id=WS_LOC_ID, vendor=vendor, channel=channel,
            status=status, total=total, eta=eta, line_items=items, summary=summary,
            detail_points=[f"{i['qty']} {i['item']} @ {i['price']}" for i in items],
            prompt=f"Tell me more about the {vendor} order",
        ))
    return objects


def build_workspace_inventory() -> list:
    """Current inventory snapshot for frontend."""
    objects = []
    critical_items = {"shrimp_16_20", "padron_pepper", "boquerones", "heavy_cream", "basil"}
    low_items = {"saffron", "butter", "octopus", "cava", "guindilla"}

    for key, name, cat, uom, gl, price, vk in ITEMS_DEF:
        par = random.uniform(8, 35)
        if key in critical_items:
            on_hand = random.uniform(0.5, 3)
            variance = f"−{random.randint(60, 85)}%"
        elif key in low_items:
            on_hand = par * random.uniform(0.3, 0.5)
            variance = f"−{random.randint(30, 55)}%"
        else:
            on_hand = par * random.uniform(0.6, 1.1)
            pct = int((on_hand / par - 1) * 100)
            variance = f"{pct:+d}%"

        objects.append(WorkspaceInventory(
            id=uid(), location_id=WS_LOC_ID, item_name=name,
            on_hand=f"{on_hand:.1f} {uom}", par=f"{par:.1f} {uom}",
            unit=uom, variance=variance,
            summary=f"{name}: {'CRITICAL — below reorder point' if key in critical_items else 'On track' if key not in low_items else 'Running low — order soon'}",
            detail_points=[
                f"On hand: {on_hand:.1f} {uom}",
                f"Par level: {par:.1f} {uom}",
                f"Last delivery: {(TODAY - timedelta(days=random.randint(1, 7))).isoformat()}",
                f"Vendor: {next(v[1] for v in VENDORS_DEF if v[0] == vk)}",
            ],
            prompt=f"What's the status on {name}?",
        ))
    return objects


def build_workspace_prep() -> list:
    """Today's prep tasks."""
    tasks = [
        ("Lunch", "Bravas Sauce — 4L batch", "Saucier", "Ready", None),
        ("Lunch", "Aioli — 2L batch", "Garde Manger", "Ready", None),
        ("Lunch", "Croquetas — 80 pcs", "Fryer Station", "Behind", "Low on jamón — only enough for 50 pcs"),
        ("Lunch", "Gazpacho — 6L", "Garde Manger", "Ready", None),
        ("Lunch", "Tortilla — 3 whole", "Plancha", "In Progress", None),
        ("Dinner", "Romesco — 3L batch", "Saucier", "Not Started", None),
        ("Dinner", "Sofrito — 5L batch", "Saucier", "Not Started", None),
        ("Dinner", "Crema Catalana — 20 ramekins", "Pastry", "Ready", None),
        ("Dinner", "Churro batter — 4L", "Fryer Station", "Not Started", None),
        ("Dinner", "Albóndigas — 60 pcs", "Saucier", "Not Started", None),
        ("Dinner", "Padrón peppers — portion into 15 plates", "Garde Manger", "Behind", "Only 2 lb on hand — need 5 lb for tonight"),
        ("Both", "Tarta de Santiago — 2 whole", "Pastry", "Ready", None),
        ("Both", "Ensaladilla Rusa — 20 portions", "Garde Manger", "In Progress", None),
    ]
    objects = []
    for lane, task, station, readiness, shortage in tasks:
        objects.append(WorkspacePrep(
            id=uid(), location_id=WS_LOC_ID, service_lane=lane,
            task=task, station=station, readiness=readiness, shortage=shortage,
            summary=f"{task} — {readiness}" + (f" ⚠ {shortage}" if shortage else ""),
            detail_points=[f"Station: {station}", f"Service: {lane}", f"Status: {readiness}"]
            + ([f"Shortage: {shortage}"] if shortage else []),
            prompt=f"What's the status on {task}?",
        ))
    return objects


def build_workspace_food_cost() -> list:
    """Per-item food cost analysis for frontend."""
    objects = []
    for key, display, section, price, cost, _pop, _ing in MENU_DEF:
        pct = cost / price * 100
        if pct > 33:
            pressure = "High"
            action = "Review portion size or negotiate with vendor"
        elif pct > 28:
            pressure = "Watch"
            action = "Monitor — approaching target ceiling"
        else:
            pressure = "Good"
            action = "On target — no action needed"

        objects.append(WorkspaceFoodCost(
            id=uid(), location_id=WS_LOC_ID, menu_item_name=display,
            pressure=pressure, current_cost_pct=f"{pct:.1f}%", action=action,
            summary=f"{display}: {pct:.1f}% food cost ({pressure})",
            detail_points=[
                f"Menu price: ${price:.2f}",
                f"Plate cost: ${cost:.2f}",
                f"Food cost: {pct:.1f}%",
                f"Target: 28-32%",
            ],
            prompt=f"Break down the food cost for {display}",
        ))
    return objects


def build_workspace_menu() -> list:
    """Menu items with performance data for frontend."""
    objects = []
    perf_labels = ["Star", "Star", "Plow Horse", "Puzzle", "Dog"]
    for key, display, section, price, cost, pop, _ing in MENU_DEF:
        margin = (price - cost) / price * 100
        # Performance based on popularity + margin
        if pop >= 10 and margin >= 65:
            perf = "Star"
            rec = "Maintain position — high popularity & margin"
        elif pop >= 8 and margin < 65:
            perf = "Plow Horse"
            rec = "Increase price $1-2 or reduce portion cost"
        elif pop < 6 and margin >= 70:
            perf = "Puzzle"
            rec = "Increase visibility — feature on specials board"
        elif pop < 5:
            perf = "Dog"
            rec = "Consider replacing or reworking recipe"
        else:
            perf = "Steady"
            rec = "Performing adequately — review quarterly"

        objects.append(WorkspaceMenu(
            id=uid(), location_id=WS_LOC_ID, item_name=display,
            category=section, performance=perf, margin_pct=f"{margin:.0f}%",
            recommendation=rec,
            summary=f"{display} ({section}) — {perf}, {margin:.0f}% margin",
            detail_points=[
                f"Price: ${price:.2f}",
                f"Cost: ${cost:.2f}",
                f"Margin: {margin:.0f}%",
                f"Popularity rank: {pop}/15",
            ],
            prompt=f"Analyze the performance of {display}",
        ))
    return objects


def build_workspace_campaigns() -> list:
    """Marketing campaigns."""
    return [
        WorkspaceCampaign(
            id=uid(), location_id=WS_LOC_ID,
            campaign_name="Wine Wednesday", channel="Instagram + In-house",
            stage="Active", deliverable="Weekly post + table tent",
            summary="50% off wine by the glass on Wednesdays. Running since Feb. Avg +22% Wednesday covers vs Jan baseline.",
            detail_points=[
                "Launched: Feb 5, 2026",
                "Avg Wednesday covers: 52 (was 42)",
                "Wine cost offset by higher food attach rate",
                "Instagram reach: 2.4k avg per post",
            ],
            prompt="How is Wine Wednesday performing?",
        ),
        WorkspaceCampaign(
            id=uid(), location_id=WS_LOC_ID,
            campaign_name="Weekend Brunch Launch", channel="Instagram + Yelp + Flyer",
            stage="Planning", deliverable="Menu design + social campaign",
            summary="Saturday & Sunday brunch starting April 5. Spanish-style: huevos rotos, tortilla, churros, sangría pitchers.",
            detail_points=[
                "Target launch: April 5, 2026",
                "Menu: 8 items, avg check $28",
                "Needs: brunch menu printed, Instagram teaser series (3 posts), Yelp listing update",
                "Labor: 2 additional AM cooks needed",
            ],
            prompt="What's the plan for the brunch launch?",
        ),
        WorkspaceCampaign(
            id=uid(), location_id=WS_LOC_ID,
            campaign_name="Tapas Tuesday — 2-for-1", channel="Instagram",
            stage="Active", deliverable="Weekly story + reel",
            summary="2-for-1 select tapas every Tuesday. Driving trial on slower night. Avg +18% Tuesday covers.",
            detail_points=[
                "Launched: Mar 4, 2026",
                "Select items: Bravas, Padrón, Pan con Tomate (low-cost items)",
                "Avg Tuesday covers: 44 (was 37)",
                "Food cost impact: +1.2% on Tuesdays (acceptable)",
            ],
            prompt="How is Tapas Tuesday doing?",
        ),
        WorkspaceCampaign(
            id=uid(), location_id=WS_LOC_ID,
            campaign_name="Spring Menu Preview", channel="Email + Instagram",
            stage="Drafting", deliverable="Email blast + IG carousel",
            summary="Announcing 4 new spring dishes: grilled artichoke, spring pea croquetas, strawberry gazpacho, lamb al pastor.",
            detail_points=[
                "Target send: March 28, 2026",
                "Email list: 1,840 subscribers",
                "New dishes need recipe costing before announcement",
                "Photography: schedule Mar 26 with Julia",
            ],
            prompt="What's in the spring menu preview?",
        ),
    ]


def build_workspace_invoices() -> list:
    """Recent invoices for frontend."""
    invoices = [
        ("Coastal Produce", "CP-1001", "2026-03-01", "2026-03-16", "paid",
         "$1,180.50", "$89.60", "$1,270.10",
         [{"item": "Roma Tomatoes 5cs", "total": "$140.00"},
          {"item": "EVOO 8L", "total": "$144.00"},
          {"item": "Potatoes 4cs", "total": "$128.00"}]),
        ("Great Lakes Seafood", "GLS-1002", "2026-03-01", "2026-03-16", "paid",
         "$920.00", "$75.90", "$995.90",
         [{"item": "Shrimp 16/20 15lb", "total": "$217.50"},
          {"item": "Octopus 10lb", "total": "$120.00"},
          {"item": "Calamari 12lb", "total": "$114.00"}]),
        ("Ibérico Direct", "ID-1003", "2026-03-03", "2026-04-02", "paid",
         "$1,580.00", "$130.35", "$1,710.35",
         [{"item": "Jamón Ibérico 5lb", "total": "$325.00"},
          {"item": "Chorizo 12lb", "total": "$144.00"},
          {"item": "Secreto 8lb", "total": "$256.00"}]),
        ("Coastal Produce", "CP-1005", "2026-03-15", "2026-03-30", "approved",
         "$1,340.00", "$110.55", "$1,450.55",
         [{"item": "Roma Tomatoes 6cs", "total": "$168.00"},
          {"item": "Padrón Peppers 8lb", "total": "$112.00"},
          {"item": "EVOO 10L", "total": "$180.00"}]),
        ("Great Lakes Seafood", "GLS-1006", "2026-03-15", "2026-03-30", "disputed",
         "$1,050.00", "$86.63", "$1,136.63",
         [{"item": "Shrimp 16/20 18lb", "total": "$261.00"},
          {"item": "Mussels 20lb", "total": "$90.00"}]),
        ("Vinoteca Supply", "VS-1007", "2026-03-17", "2026-04-16", "pending",
         "$890.00", "$73.43", "$963.43",
         [{"item": "Garnacha 4cs", "total": "$288.00"},
          {"item": "Albariño 3cs", "total": "$252.00"},
          {"item": "Lustau Vermut 8btl", "total": "$144.00"}]),
    ]
    objects = []
    for vendor, inv_num, inv_date, due, status, sub, tax, total, items in invoices:
        objects.append(WorkspaceInvoice(
            id=uid(), location_id=WS_LOC_ID, vendor_name=vendor,
            invoice_number=inv_num, invoice_date=inv_date, due_date=due,
            status=status, subtotal=sub, tax=tax, total=total,
            source="upload", line_items=items,
            summary=f"{vendor} invoice {inv_num} — {status}",
            detail_points=[f"{i['item']}: {i['total']}" for i in items],
            prompt=f"Show me invoice {inv_num} from {vendor}",
        ))
    return objects


def build_workspace_recipes() -> list:
    """Detailed workspace recipes (Modernist Cuisine format) for 10 key dishes."""
    objects = []

    recipes_detail = [
        {
            "name": "Patatas Bravas",
            "category": "Tapas Calientes",
            "description": "Crispy fried potatoes with house bravas sauce and aioli. The definitive bar snack.",
            "status": "active",
            "yield_qty": 1, "yield_unit": "serving",
            "total_weight": 350, "total_cost": 1.60, "cost_per_serving": 1.60,
            "equipment": ["Deep fryer", "Saucepan", "Spider strainer"],
            "tags": ["vegetarian", "gluten-free", "signature"],
            "components": [
                {
                    "name": "Fried Potatoes",
                    "yield_qty": 1, "yield_unit": "portion",
                    "ingredients": [
                        ("Yukon Gold Potatoes", 300, "g", None),
                        ("Extra Virgin Olive Oil", 50, "mL", "for frying"),
                        ("Flaky Sea Salt", 2, "g", None),
                    ],
                    "steps": [
                        (1, "Peel and cut potatoes into 3cm irregular chunks", None, None, "knife work"),
                        (2, "Rinse in cold water, drain, and pat completely dry", None, "5 min", "mise en place"),
                        (3, "First fry at 140°C until tender but not colored — about 8 minutes", "140°C", "8 min", "confit fry"),
                        (4, "Rest 10 minutes at room temperature", None, "10 min", "resting"),
                        (5, "Second fry at 190°C until golden and crispy — about 3 minutes", "190°C", "3 min", "high-heat fry"),
                        (6, "Drain on paper towels, season immediately with flaky salt", None, None, "seasoning"),
                    ],
                },
                {
                    "name": "Bravas Sauce",
                    "yield_qty": 500, "yield_unit": "mL",
                    "ingredients": [
                        ("Roma Tomatoes", 400, "g", "blanched and peeled"),
                        ("Pimentón de la Vera", 8, "g", "hot"),
                        ("Cayenne Pepper", 2, "g", None),
                        ("Garlic", 10, "g", "minced"),
                        ("EVOO", 30, "mL", None),
                        ("Sherry Vinegar", 15, "mL", None),
                    ],
                    "steps": [
                        (1, "Sweat garlic in olive oil over low heat until fragrant — do not brown", "low", "2 min", "sweating"),
                        (2, "Add pimentón and cayenne, bloom spices 30 seconds", None, "30 sec", "blooming"),
                        (3, "Add crushed tomatoes, bring to simmer", None, None, "simmering"),
                        (4, "Cook 20 minutes until reduced and thick", None, "20 min", "reduction"),
                        (5, "Blend until smooth, pass through fine sieve", None, None, "blending"),
                        (6, "Finish with sherry vinegar, adjust salt", None, None, "seasoning"),
                    ],
                },
            ],
        },
        {
            "name": "Gambas al Ajillo",
            "category": "Tapas Calientes",
            "description": "Sizzling garlic shrimp in olive oil with guindilla peppers. Served bubbling in a cazuela.",
            "status": "active",
            "yield_qty": 1, "yield_unit": "serving",
            "total_weight": 280, "total_cost": 3.60, "cost_per_serving": 3.60,
            "equipment": ["Cazuela (terracotta dish)", "Gas burner"],
            "tags": ["seafood", "signature", "gluten-free"],
            "components": [
                {
                    "name": "Gambas al Ajillo",
                    "yield_qty": 1, "yield_unit": "portion",
                    "ingredients": [
                        ("Shrimp 16/20", 200, "g", "peeled, deveined, tails on"),
                        ("Garlic", 20, "g", "sliced paper-thin"),
                        ("EVOO", 60, "mL", None),
                        ("Guindilla Pepper", 2, "ea", "split lengthwise"),
                        ("Flat-Leaf Parsley", 5, "g", "chopped"),
                        ("Flaky Sea Salt", 2, "g", None),
                    ],
                    "steps": [
                        (1, "Heat olive oil in cazuela until shimmering — not smoking", "medium-high", None, "heating"),
                        (2, "Add garlic slices, cook until just golden — 30 seconds max", None, "30 sec", "toasting"),
                        (3, "Add guindilla peppers", None, None, "building flavor"),
                        (4, "Add shrimp in single layer, season with salt", None, None, "searing"),
                        (5, "Cook 90 seconds per side until just pink — do NOT overcook", None, "3 min", "searing"),
                        (6, "Remove from heat, finish with parsley. Serve immediately in the cazuela — it keeps cooking", None, None, "finishing"),
                    ],
                },
            ],
        },
        {
            "name": "Croquetas de Jamón",
            "category": "Tapas Calientes",
            "description": "Crispy béchamel croquettes studded with jamón ibérico. The benchmark of any tapas bar.",
            "status": "active",
            "yield_qty": 6, "yield_unit": "pieces",
            "total_weight": 300, "total_cost": 2.90, "cost_per_serving": 2.90,
            "equipment": ["Heavy saucepan", "Sheet tray", "Deep fryer"],
            "tags": ["signature", "make-ahead", "comfort"],
            "components": [
                {
                    "name": "Béchamel Base",
                    "yield_qty": 6, "yield_unit": "croquetas",
                    "ingredients": [
                        ("European Butter", 40, "g", None),
                        ("All-Purpose Flour", 40, "g", None),
                        ("Whole Milk", 300, "mL", "warm"),
                        ("Jamón Ibérico", 60, "g", "finely diced"),
                        ("Nutmeg", 1, "g", "freshly grated"),
                    ],
                    "steps": [
                        (1, "Melt butter over medium heat. Add flour, cook roux 2 minutes stirring constantly", "medium", "2 min", "roux"),
                        (2, "Add warm milk in three additions, whisking vigorously after each to prevent lumps", None, "5 min", "béchamel"),
                        (3, "Cook until very thick — should pull away from sides of pan cleanly", None, "8 min", "reduction"),
                        (4, "Fold in diced jamón and nutmeg. Season with salt (careful — jamón is salty)", None, None, "folding"),
                        (5, "Spread onto oiled sheet tray in 2cm layer. Press plastic wrap directly on surface", None, None, "chilling"),
                        (6, "Refrigerate minimum 4 hours, preferably overnight", "4°C", "4+ hrs", "setting"),
                    ],
                },
                {
                    "name": "Breading & Frying",
                    "yield_qty": 6, "yield_unit": "croquetas",
                    "ingredients": [
                        ("Eggs", 2, "ea", "beaten"),
                        ("Panko Breadcrumbs", 100, "g", None),
                        ("All-Purpose Flour", 30, "g", "for dredging"),
                    ],
                    "steps": [
                        (1, "Portion chilled béchamel into 50g cylinders using wet hands", None, None, "portioning"),
                        (2, "Dredge in flour → egg wash → panko. Double bread for extra crunch", None, None, "breading"),
                        (3, "Fry at 180°C for 2.5 minutes until deep golden", "180°C", "2.5 min", "deep frying"),
                        (4, "Drain 30 seconds on paper towels. Serve immediately — interior should be molten", None, None, "finishing"),
                    ],
                },
            ],
        },
        {
            "name": "Paella de Mariscos",
            "category": "Raciones",
            "description": "Saffron rice with shrimp, mussels, clams, and calamari. Built in a wide paella pan over open flame.",
            "status": "active",
            "yield_qty": 2, "yield_unit": "servings",
            "total_weight": 800, "total_cost": 9.80, "cost_per_serving": 4.90,
            "equipment": ["40cm paella pan", "Gas burner", "Fish stock"],
            "tags": ["seafood", "showpiece", "shareable"],
            "components": [
                {
                    "name": "Sofrito Base",
                    "yield_qty": 1, "yield_unit": "batch",
                    "ingredients": [
                        ("Roma Tomatoes", 150, "g", "grated"),
                        ("Garlic", 15, "g", "minced"),
                        ("Yellow Onion", 80, "g", "fine dice"),
                        ("EVOO", 30, "mL", None),
                        ("Pimentón de la Vera", 4, "g", "sweet"),
                    ],
                    "steps": [
                        (1, "Heat olive oil in paella pan over medium-high heat", "medium-high", None, "heating"),
                        (2, "Sauté onion until translucent — 4 minutes", None, "4 min", "sweating"),
                        (3, "Add garlic, cook 30 seconds until fragrant", None, "30 sec", "aromatics"),
                        (4, "Add grated tomato and pimentón, cook until paste darkens and oil separates — this is the sofrito point", None, "8 min", "sofrito"),
                    ],
                },
                {
                    "name": "Rice & Seafood",
                    "yield_qty": 2, "yield_unit": "servings",
                    "ingredients": [
                        ("Bomba Rice", 200, "g", None),
                        ("Saffron Threads", 0.3, "g", "bloomed in warm stock"),
                        ("Fish Stock", 500, "mL", "hot"),
                        ("Shrimp 16/20", 150, "g", "shell-on"),
                        ("PEI Mussels", 200, "g", "scrubbed"),
                        ("Littleneck Clams", 6, "ea", "purged"),
                        ("Calamari", 80, "g", "rings"),
                    ],
                    "steps": [
                        (1, "Add rice to sofrito, toast 1 minute stirring to coat every grain", None, "1 min", "toasting"),
                        (2, "Add hot saffron stock. Distribute rice evenly — DO NOT STIR after this point", None, None, "critical technique"),
                        (3, "Bring to rapid boil, then reduce to medium. Cook 10 minutes", "medium", "10 min", "simmering"),
                        (4, "Nestle clams and mussels into rice hinge-side down", None, None, "building"),
                        (5, "Add shrimp and calamari rings on top", None, None, "building"),
                        (6, "Cook 8 more minutes until rice is tender and liquid absorbed", None, "8 min", "finishing"),
                        (7, "Increase heat to high for 60 seconds to develop socarrat (crispy bottom)", "high", "60 sec", "socarrat"),
                        (8, "Rest 5 minutes covered with foil before serving", None, "5 min", "resting"),
                    ],
                },
            ],
        },
        {
            "name": "Tortilla Española",
            "category": "Tapas Calientes",
            "description": "Thick Spanish potato omelette with caramelized onions. Custardy center, golden exterior.",
            "status": "active",
            "yield_qty": 6, "yield_unit": "portions",
            "total_weight": 600, "total_cost": 2.00, "cost_per_serving": 2.00,
            "equipment": ["8-inch non-stick pan", "Large plate for flipping"],
            "tags": ["vegetarian", "classic", "make-ahead"],
            "components": [
                {
                    "name": "Tortilla Española",
                    "yield_qty": 6, "yield_unit": "wedges",
                    "ingredients": [
                        ("Yukon Gold Potatoes", 500, "g", "peeled, 3mm slices"),
                        ("Eggs", 6, "ea", "beaten"),
                        ("Yellow Onion", 120, "g", "thinly sliced"),
                        ("EVOO", 150, "mL", "for confit"),
                        ("Fine Sea Salt", 4, "g", None),
                    ],
                    "steps": [
                        (1, "Confit potato slices in olive oil at 130°C until tender but not colored — about 15 minutes", "130°C", "15 min", "confit"),
                        (2, "Add onion slices for final 5 minutes of confit", None, "5 min", "sweating"),
                        (3, "Drain potatoes and onions, reserve oil. Cool slightly", None, "5 min", "draining"),
                        (4, "Fold potato-onion mixture into beaten eggs. Season well. Rest 10 minutes", None, "10 min", "resting"),
                        (5, "Heat 2 tbsp reserved oil in non-stick pan over medium-high", "medium-high", None, "heating"),
                        (6, "Pour in egg-potato mixture. Cook 2 minutes until edges set", None, "2 min", "cooking"),
                        (7, "Reduce to low, cook 8 minutes until mostly set with custardy center", "low", "8 min", "slow cooking"),
                        (8, "Flip onto plate, slide back into pan. Cook 3 more minutes", None, "3 min", "flipping"),
                        (9, "Rest 5 minutes before cutting. Serve at room temperature", None, "5 min", "resting"),
                    ],
                },
            ],
        },
        {
            "name": "Pulpo a la Gallega",
            "category": "Tapas Frías",
            "description": "Galician-style octopus on potato rounds with pimentón and olive oil.",
            "status": "active",
            "yield_qty": 1, "yield_unit": "serving",
            "total_weight": 250, "total_cost": 4.80, "cost_per_serving": 4.80,
            "equipment": ["Large stockpot", "Wooden board for serving"],
            "tags": ["seafood", "gluten-free", "traditional"],
            "components": [
                {
                    "name": "Pulpo a la Gallega",
                    "yield_qty": 1, "yield_unit": "plate",
                    "ingredients": [
                        ("Spanish Octopus", 200, "g", "pre-cooked tentacles"),
                        ("Yukon Gold Potatoes", 100, "g", "boiled, sliced 5mm"),
                        ("Pimentón de la Vera", 3, "g", "sweet + hot blend"),
                        ("EVOO", 20, "mL", "finishing quality"),
                        ("Flaky Sea Salt", 2, "g", None),
                    ],
                    "steps": [
                        (1, "If using frozen octopus: thaw overnight in fridge. The freeze-thaw tenderizes.", "4°C", "overnight", "thawing"),
                        (2, "Boil octopus in unsalted water with a cork — 45 min per kg until tender", "100°C", "45 min/kg", "boiling"),
                        (3, "Rest in cooking liquid 15 minutes, then slice tentacles into 1cm rounds", None, "15 min", "resting"),
                        (4, "Arrange potato slices on wooden board, top with octopus rounds", None, None, "plating"),
                        (5, "Drizzle generously with best EVOO, dust with pimentón and flaky salt", None, None, "finishing"),
                    ],
                },
            ],
        },
        {
            "name": "Crema Catalana",
            "category": "Postres",
            "description": "Catalan burnt cream with cinnamon and lemon zest. Spain's answer to crème brûlée.",
            "status": "active",
            "yield_qty": 6, "yield_unit": "ramekins",
            "total_weight": 180, "total_cost": 1.80, "cost_per_serving": 1.80,
            "equipment": ["Heavy saucepan", "Ramekins", "Kitchen torch"],
            "tags": ["dessert", "make-ahead", "classic"],
            "components": [
                {
                    "name": "Crema Catalana",
                    "yield_qty": 6, "yield_unit": "ramekins",
                    "ingredients": [
                        ("Egg Yolks", 6, "ea", None),
                        ("Whole Milk", 500, "mL", None),
                        ("Heavy Cream", 100, "mL", None),
                        ("Granulated Sugar", 120, "g", "+ extra for brûlée"),
                        ("Lemon Zest", 5, "g", "wide strips"),
                        ("Cinnamon Stick", 1, "ea", None),
                        ("Cornstarch", 20, "g", None),
                    ],
                    "steps": [
                        (1, "Infuse milk with lemon zest and cinnamon over low heat — 10 minutes. Do not boil", "low", "10 min", "infusing"),
                        (2, "Whisk egg yolks, sugar, and cornstarch until pale and thick", None, "3 min", "whisking"),
                        (3, "Strain warm milk, discard aromatics. Temper into yolk mixture gradually", None, None, "tempering"),
                        (4, "Return to heat, cook stirring constantly until thick — coats back of spoon", "medium-low", "5 min", "cooking"),
                        (5, "Pour into ramekins, press plastic wrap on surface. Chill minimum 4 hours", "4°C", "4+ hrs", "setting"),
                        (6, "To serve: sprinkle thin layer of sugar, torch until dark amber and crackly", None, None, "brûlée"),
                    ],
                },
            ],
        },
        {
            "name": "Churros con Chocolate",
            "category": "Postres",
            "description": "Crispy ridged churros with thick Spanish drinking chocolate.",
            "status": "active",
            "yield_qty": 4, "yield_unit": "servings",
            "total_weight": 200, "total_cost": 1.50, "cost_per_serving": 1.50,
            "equipment": ["Churrera or piping bag with star tip", "Deep fryer", "Saucepan"],
            "tags": ["dessert", "comfort", "shareable"],
            "components": [
                {
                    "name": "Churros",
                    "yield_qty": 12, "yield_unit": "churros",
                    "ingredients": [
                        ("Water", 250, "mL", None),
                        ("European Butter", 30, "g", None),
                        ("All-Purpose Flour", 150, "g", None),
                        ("Eggs", 1, "ea", None),
                        ("Fine Sea Salt", 2, "g", None),
                        ("Granulated Sugar", 50, "g", "for rolling"),
                        ("Cinnamon", 3, "g", "for rolling"),
                    ],
                    "steps": [
                        (1, "Bring water, butter, and salt to rolling boil", "high", None, "boiling"),
                        (2, "Remove from heat, add flour all at once. Stir vigorously until dough forms a ball", None, "2 min", "choux method"),
                        (3, "Beat in egg until dough is smooth and pipeable", None, None, "mixing"),
                        (4, "Pipe 15cm lengths directly into 180°C oil using star tip", "180°C", None, "piping"),
                        (5, "Fry 3-4 minutes turning once, until deep golden and crispy", "180°C", "3-4 min", "deep frying"),
                        (6, "Roll immediately in cinnamon sugar", None, None, "coating"),
                    ],
                },
                {
                    "name": "Chocolate Espeso",
                    "yield_qty": 4, "yield_unit": "portions",
                    "ingredients": [
                        ("Valrhona 70% Chocolate", 100, "g", "chopped"),
                        ("Whole Milk", 200, "mL", None),
                        ("Cornstarch", 10, "g", None),
                        ("Granulated Sugar", 20, "g", None),
                    ],
                    "steps": [
                        (1, "Whisk cornstarch into cold milk until dissolved", None, None, "slurry"),
                        (2, "Heat milk mixture over medium, stirring constantly until thickened", "medium", "4 min", "thickening"),
                        (3, "Remove from heat, add chopped chocolate. Stir until melted and glossy", None, None, "melting"),
                        (4, "Serve thick and hot in small cups for dipping", None, None, "serving"),
                    ],
                },
            ],
        },
        # ── Remaining Tapas Frías ──
        {
            "name": "Pan con Tomate",
            "category": "Tapas Frías",
            "description": "Grilled rustic bread rubbed with ripe tomato, garlic, and finished with EVOO and flaky salt. Deceptively simple — quality of ingredients is everything.",
            "status": "active",
            "yield_qty": 1, "yield_unit": "serving",
            "total_weight": 180, "total_cost": 1.85, "cost_per_serving": 1.85,
            "equipment": ["Plancha or grill", "Box grater"],
            "tags": ["vegetarian", "vegan", "classic", "5-minute"],
            "components": [
                {
                    "name": "Pan con Tomate",
                    "yield_qty": 2, "yield_unit": "slices",
                    "ingredients": [
                        ("Rustic Sourdough", 120, "g", "2 thick slices"),
                        ("Ripe Roma Tomatoes", 150, "g", "halved"),
                        ("Garlic", 5, "g", "1 clove, halved"),
                        ("EVOO", 15, "mL", "finishing quality"),
                        ("Flaky Sea Salt", 2, "g", None),
                    ],
                    "steps": [
                        (1, "Grill bread on plancha until deeply charred on both sides — you want crunch", "high", "2 min", "grilling"),
                        (2, "While hot, rub cut garlic aggressively across surface — the toast acts as a grater", None, None, "rubbing"),
                        (3, "Halve tomatoes and grate flesh directly onto bread using box grater. Discard skins", None, None, "grating"),
                        (4, "Drizzle generously with your best EVOO. Season with flaky salt. Serve immediately", None, None, "finishing"),
                    ],
                },
            ],
        },
        {
            "name": "Gazpacho",
            "category": "Tapas Frías",
            "description": "Chilled Andalusian tomato soup. No cooking — just peak-season ingredients and a blender. Must be ice cold.",
            "status": "active",
            "yield_qty": 4, "yield_unit": "servings",
            "total_weight": 1200, "total_cost": 2.20, "cost_per_serving": 2.20,
            "equipment": ["High-speed blender", "Fine-mesh sieve"],
            "tags": ["vegetarian", "vegan", "gluten-free", "cold", "make-ahead"],
            "components": [
                {
                    "name": "Gazpacho",
                    "yield_qty": 1, "yield_unit": "L",
                    "ingredients": [
                        ("Ripe Roma Tomatoes", 800, "g", "roughly chopped"),
                        ("Cucumber", 150, "g", "peeled, seeded"),
                        ("Red Bell Pepper", 100, "g", "seeded"),
                        ("Garlic", 10, "g", "1 clove"),
                        ("Day-Old Bread", 50, "g", "crusts removed, soaked"),
                        ("EVOO", 60, "mL", None),
                        ("Sherry Vinegar", 20, "mL", None),
                        ("Fine Sea Salt", 6, "g", None),
                    ],
                    "steps": [
                        (1, "Combine all vegetables and soaked bread in blender. Blend on high 2 minutes until completely smooth", None, "2 min", "blending"),
                        (2, "With blender running, stream in olive oil to emulsify — soup should turn creamy orange", None, "30 sec", "emulsifying"),
                        (3, "Add sherry vinegar and salt. Blend 10 more seconds", None, None, "seasoning"),
                        (4, "Pass through fine-mesh sieve for silky texture. Press solids with a ladle", None, None, "straining"),
                        (5, "Refrigerate minimum 4 hours — overnight is better. Flavors need time to marry", "4°C", "4+ hrs", "chilling"),
                        (6, "Serve ice cold in chilled bowls. Garnish with diced cucumber, EVOO drizzle, and croutons", None, None, "plating"),
                    ],
                },
            ],
        },
        {
            "name": "Boquerones en Vinagre",
            "category": "Tapas Frías",
            "description": "White anchovies marinated in vinegar, garlic, and parsley. A San Sebastián pintxo bar staple.",
            "status": "active",
            "yield_qty": 1, "yield_unit": "serving",
            "total_weight": 120, "total_cost": 3.80, "cost_per_serving": 3.80,
            "equipment": ["Non-reactive container"],
            "tags": ["seafood", "gluten-free", "cold", "make-ahead"],
            "components": [
                {
                    "name": "Boquerones en Vinagre",
                    "yield_qty": 1, "yield_unit": "plate",
                    "ingredients": [
                        ("White Anchovies", 100, "g", "butterflied, spine removed"),
                        ("White Wine Vinegar", 100, "mL", None),
                        ("Garlic", 8, "g", "thinly sliced"),
                        ("Flat-Leaf Parsley", 5, "g", "chopped"),
                        ("EVOO", 30, "mL", "finishing quality"),
                        ("Flaky Sea Salt", 1, "g", None),
                    ],
                    "steps": [
                        (1, "Submerge butterflied anchovies in white wine vinegar. Refrigerate 6 hours minimum — flesh should turn opaque white", "4°C", "6+ hrs", "curing"),
                        (2, "Drain vinegar completely. Pat anchovies dry with paper towels", None, None, "draining"),
                        (3, "Arrange on plate, scatter sliced garlic and parsley over top", None, None, "plating"),
                        (4, "Drizzle generously with EVOO. Season with flaky salt. Serve cold", None, None, "finishing"),
                    ],
                },
            ],
        },
        {
            "name": "Jamón Ibérico",
            "category": "Tapas Frías",
            "description": "Hand-carved Ibérico de bellota. Let the pig do the talking — this is about product, not technique.",
            "status": "active",
            "yield_qty": 1, "yield_unit": "serving",
            "total_weight": 60, "total_cost": 5.85, "cost_per_serving": 5.85,
            "equipment": ["Jamón carving knife (cuchillo jamonero)", "Jamón holder"],
            "tags": ["signature", "premium", "gluten-free", "no-cook"],
            "components": [
                {
                    "name": "Jamón Ibérico Plate",
                    "yield_qty": 1, "yield_unit": "plate",
                    "ingredients": [
                        ("Jamón Ibérico", 50, "g", "hand-carved, paper-thin"),
                        ("EVOO", 5, "mL", "arbequina, finishing"),
                        ("Pan de Cristal", 30, "g", "optional, lightly toasted"),
                    ],
                    "steps": [
                        (1, "Bring jamón to room temperature 20 minutes before serving — cold fat doesn't melt on the tongue", "20°C", "20 min", "tempering"),
                        (2, "Carve paper-thin slices along the grain using a long flexible knife. Each slice should be translucent", None, None, "carving"),
                        (3, "Arrange on a room-temperature plate in a single layer — never stack. Fat should glisten", None, None, "plating"),
                        (4, "Optional: serve with warm pan de cristal. No garnish needed — the ham IS the dish", None, None, "serving"),
                    ],
                },
            ],
        },
        {
            "name": "Ensaladilla Rusa",
            "category": "Tapas Frías",
            "description": "Spanish potato salad with tuna, olives, and homemade mayo. Every bar in Spain has one — ours is the best.",
            "status": "active",
            "yield_qty": 6, "yield_unit": "portions",
            "total_weight": 800, "total_cost": 2.40, "cost_per_serving": 2.40,
            "equipment": ["Large pot", "Mixing bowl"],
            "tags": ["classic", "make-ahead", "comfort", "gluten-free"],
            "components": [
                {
                    "name": "Ensaladilla Rusa",
                    "yield_qty": 6, "yield_unit": "portions",
                    "ingredients": [
                        ("Yukon Gold Potatoes", 400, "g", "peeled, 1.5cm dice"),
                        ("Carrots", 100, "g", "peeled, 1cm dice"),
                        ("Green Peas", 80, "g", "blanched"),
                        ("Eggs", 3, "ea", "hard-boiled, chopped"),
                        ("Tuna in Olive Oil", 100, "g", "drained, flaked"),
                        ("Green Olives", 40, "g", "pitted, halved"),
                        ("Homemade Aioli", 120, "g", None),
                        ("Fine Sea Salt", 4, "g", None),
                        ("White Pepper", 1, "g", None),
                    ],
                    "steps": [
                        (1, "Boil potatoes and carrots in well-salted water until just tender — not mushy. About 12 minutes", "100°C", "12 min", "boiling"),
                        (2, "Drain and spread on a sheet tray to cool completely. Season while warm — they absorb salt better", None, "15 min", "cooling"),
                        (3, "Combine cooled potatoes, carrots, peas, eggs, tuna, and olives in a large bowl", None, None, "mixing"),
                        (4, "Fold in aioli gently — you want chunks, not mash. Season with salt and white pepper", None, None, "dressing"),
                        (5, "Refrigerate at least 2 hours. Serve cold, shaped into a mound with a drizzle of EVOO on top", "4°C", "2+ hrs", "chilling"),
                    ],
                },
            ],
        },
        {
            "name": "Queso Manchego Board",
            "category": "Tapas Frías",
            "description": "Aged Manchego with marcona almonds, membrillo, and EVOO. A cheese course, Spanish style.",
            "status": "active",
            "yield_qty": 1, "yield_unit": "serving",
            "total_weight": 200, "total_cost": 4.20, "cost_per_serving": 4.20,
            "equipment": ["Cheese wire or sharp knife", "Wooden board"],
            "tags": ["vegetarian", "gluten-free", "no-cook", "shareable"],
            "components": [
                {
                    "name": "Manchego Board",
                    "yield_qty": 1, "yield_unit": "board",
                    "ingredients": [
                        ("Manchego (6-month aged)", 80, "g", "wedges and shards"),
                        ("Marcona Almonds", 30, "g", "fried, salted"),
                        ("Membrillo (quince paste)", 25, "g", "sliced"),
                        ("Honeycomb", 15, "g", "small piece"),
                        ("EVOO", 10, "mL", "arbequina"),
                    ],
                    "steps": [
                        (1, "Bring Manchego to room temperature — 30 minutes minimum. Cold cheese = muted flavor", "20°C", "30 min", "tempering"),
                        (2, "Break cheese into irregular wedges and shards — knife cuts look institutional, breaks look rustic", None, None, "breaking"),
                        (3, "Arrange on wooden board: cheese off-center, almonds in a loose pile, membrillo slices, honeycomb", None, None, "plating"),
                        (4, "Drizzle EVOO over cheese. Serve with bread on the side, not on the board", None, None, "finishing"),
                    ],
                },
            ],
        },
        # ── Remaining Tapas Calientes ──
        {
            "name": "Pimientos de Padrón",
            "category": "Tapas Calientes",
            "description": "Blistered Padrón peppers with flaky salt. 1 in 10 is spicy — Russian roulette, Spanish style.",
            "status": "active",
            "yield_qty": 1, "yield_unit": "serving",
            "total_weight": 150, "total_cost": 2.10, "cost_per_serving": 2.10,
            "equipment": ["Cast iron skillet or plancha"],
            "tags": ["vegetarian", "vegan", "gluten-free", "3-minute"],
            "components": [
                {
                    "name": "Pimientos de Padrón",
                    "yield_qty": 1, "yield_unit": "plate",
                    "ingredients": [
                        ("Pimientos de Padrón", 150, "g", "stems on"),
                        ("EVOO", 30, "mL", None),
                        ("Flaky Sea Salt", 3, "g", "Maldon"),
                    ],
                    "steps": [
                        (1, "Heat cast iron until smoking — you need violent heat for blistering", "max", None, "heating"),
                        (2, "Add oil, then peppers in a single layer. Do NOT crowd or they'll steam", None, None, "searing"),
                        (3, "Cook without moving for 60-90 seconds until skin blisters and chars", None, "90 sec", "blistering"),
                        (4, "Flip once, blister the other side. Total cook time under 3 minutes", None, "90 sec", "blistering"),
                        (5, "Transfer immediately to plate. Hit with generous flaky salt while still glistening", None, None, "seasoning"),
                    ],
                },
            ],
        },
        {
            "name": "Albóndigas",
            "category": "Tapas Calientes",
            "description": "Pork meatballs braised in tomato-saffron sauce. Your abuela's recipe, elevated.",
            "status": "active",
            "yield_qty": 4, "yield_unit": "servings",
            "total_weight": 400, "total_cost": 3.10, "cost_per_serving": 3.10,
            "equipment": ["Cast iron skillet", "Saucepan"],
            "tags": ["comfort", "make-ahead", "braise"],
            "components": [
                {
                    "name": "Meatballs",
                    "yield_qty": 12, "yield_unit": "pieces",
                    "ingredients": [
                        ("Ground Pork", 300, "g", None),
                        ("Panko Breadcrumbs", 30, "g", "soaked in milk"),
                        ("Egg", 1, "ea", "beaten"),
                        ("Garlic", 8, "g", "minced"),
                        ("Flat-Leaf Parsley", 5, "g", "chopped"),
                        ("Fine Sea Salt", 4, "g", None),
                        ("Black Pepper", 1, "g", None),
                        ("Nutmeg", 1, "g", "freshly grated"),
                    ],
                    "steps": [
                        (1, "Combine pork, soaked breadcrumbs, egg, garlic, parsley, and seasonings. Mix gently — overworking makes them tough", None, None, "mixing"),
                        (2, "Roll into 30g balls with wet hands. You should get 12 pieces", None, None, "portioning"),
                        (3, "Sear in hot cast iron with olive oil until browned on all sides — 4 minutes total. They don't need to cook through", "medium-high", "4 min", "searing"),
                        (4, "Remove and set aside. They'll finish in the sauce", None, None, "resting"),
                    ],
                },
                {
                    "name": "Tomato-Saffron Sauce",
                    "yield_qty": 4, "yield_unit": "servings",
                    "ingredients": [
                        ("Roma Tomatoes", 400, "g", "crushed"),
                        ("Yellow Onion", 80, "g", "fine dice"),
                        ("Garlic", 10, "g", "minced"),
                        ("Saffron Threads", 0.2, "g", "bloomed in 2 tbsp warm water"),
                        ("EVOO", 20, "mL", None),
                        ("White Wine", 60, "mL", None),
                    ],
                    "steps": [
                        (1, "Sauté onion in the meatball pan (use the fond) until soft — 5 minutes", "medium", "5 min", "sweating"),
                        (2, "Add garlic, cook 30 seconds. Deglaze with white wine, reduce by half", None, "2 min", "deglazing"),
                        (3, "Add crushed tomatoes and bloomed saffron with its liquid. Bring to simmer", None, None, "building"),
                        (4, "Nestle seared meatballs into sauce. Cover and braise 20 minutes on low", "low", "20 min", "braising"),
                        (5, "Sauce should be thick and meatballs cooked through. Finish with torn parsley", None, None, "finishing"),
                    ],
                },
            ],
        },
        {
            "name": "Calamares Fritos",
            "category": "Tapas Calientes",
            "description": "Crispy fried calamari with lemon and aioli. Light flour dredge, not batter — you want rings, not onion rings.",
            "status": "active",
            "yield_qty": 1, "yield_unit": "serving",
            "total_weight": 200, "total_cost": 3.20, "cost_per_serving": 3.20,
            "equipment": ["Deep fryer or heavy pot", "Spider strainer"],
            "tags": ["seafood", "fried", "classic"],
            "components": [
                {
                    "name": "Calamares Fritos",
                    "yield_qty": 1, "yield_unit": "plate",
                    "ingredients": [
                        ("Calamari Tubes", 180, "g", "cleaned, sliced into 1cm rings"),
                        ("All-Purpose Flour", 60, "g", "seasoned"),
                        ("Fine Semolina", 30, "g", "for extra crunch"),
                        ("Lemon", 1, "ea", "cut into wedges"),
                        ("Flaky Sea Salt", 2, "g", None),
                        ("EVOO", 500, "mL", "for frying"),
                    ],
                    "steps": [
                        (1, "Pat calamari rings completely dry — moisture is the enemy of crispiness", None, None, "drying"),
                        (2, "Mix flour and semolina. Toss rings in mixture, shake off excess through a sieve", None, None, "dredging"),
                        (3, "Fry at 190°C in small batches — 90 seconds max until light golden. Do NOT overcook or they turn rubbery", "190°C", "90 sec", "deep frying"),
                        (4, "Drain on paper towels. Season with salt immediately. Serve with lemon wedges and aioli", None, None, "finishing"),
                    ],
                },
            ],
        },
        {
            "name": "Chorizo al Vino",
            "category": "Tapas Calientes",
            "description": "Spanish chorizo braised in red wine. The sauce reduces into a sticky, smoky glaze.",
            "status": "active",
            "yield_qty": 1, "yield_unit": "serving",
            "total_weight": 180, "total_cost": 2.70, "cost_per_serving": 2.70,
            "equipment": ["Small sauté pan"],
            "tags": ["classic", "5-minute", "one-pan"],
            "components": [
                {
                    "name": "Chorizo al Vino",
                    "yield_qty": 1, "yield_unit": "plate",
                    "ingredients": [
                        ("Spanish Chorizo", 150, "g", "sliced 1cm thick on bias"),
                        ("Red Wine (Garnacha)", 80, "mL", None),
                        ("Bay Leaf", 1, "ea", None),
                        ("Honey", 5, "mL", "optional"),
                    ],
                    "steps": [
                        (1, "Sear chorizo slices in dry pan — the fat renders out. Cook until caramelized, 2 minutes per side", "medium-high", "4 min", "searing"),
                        (2, "Add red wine and bay leaf. The wine will sizzle and deglaze the pan", None, None, "deglazing"),
                        (3, "Reduce wine by two-thirds until syrupy and coating the chorizo — about 3 minutes", "medium", "3 min", "reduction"),
                        (4, "Optional: finish with a small drizzle of honey for sweet-smoky balance. Serve with bread for mopping", None, None, "finishing"),
                    ],
                },
            ],
        },
        # ── Remaining Raciones ──
        {
            "name": "Arroz Negro",
            "category": "Raciones",
            "description": "Black rice with squid ink, calamari, and aioli. Dramatic, briny, and deeply savory.",
            "status": "active",
            "yield_qty": 2, "yield_unit": "servings",
            "total_weight": 700, "total_cost": 7.60, "cost_per_serving": 3.80,
            "equipment": ["Wide shallow pan or paella pan", "Fish stock"],
            "tags": ["seafood", "showpiece", "shareable"],
            "components": [
                {
                    "name": "Arroz Negro",
                    "yield_qty": 2, "yield_unit": "servings",
                    "ingredients": [
                        ("Bomba Rice", 200, "g", None),
                        ("Calamari", 200, "g", "tubes sliced, tentacles whole"),
                        ("Squid Ink", 8, "g", "2 sachets"),
                        ("Fish Stock", 500, "mL", "hot"),
                        ("Garlic", 15, "g", "minced"),
                        ("Yellow Onion", 80, "g", "fine dice"),
                        ("EVOO", 30, "mL", None),
                        ("Aioli", 60, "g", "for serving"),
                    ],
                    "steps": [
                        (1, "Sear calamari tentacles and half the tubes in hot oil until charred — 90 seconds. Remove, reserve for garnish", "high", "90 sec", "searing"),
                        (2, "Sauté onion and garlic in the same pan until soft — 4 minutes", "medium", "4 min", "sweating"),
                        (3, "Add rice, toast 1 minute. Add remaining raw calamari rings", None, "1 min", "toasting"),
                        (4, "Dissolve squid ink in hot fish stock. Add to pan — rice will turn jet black", None, None, "coloring"),
                        (5, "Cook 18 minutes without stirring until rice is tender and liquid absorbed", "medium", "18 min", "simmering"),
                        (6, "Top with reserved seared calamari. Serve with a generous dollop of aioli — the white on black is the visual", None, None, "plating"),
                    ],
                },
            ],
        },
        {
            "name": "Chuletas de Cordero",
            "category": "Raciones",
            "description": "Grilled lamb chops with nothing but salt, fire, and a squeeze of lemon. Basque country simplicity.",
            "status": "active",
            "yield_qty": 1, "yield_unit": "serving",
            "total_weight": 300, "total_cost": 10.50, "cost_per_serving": 10.50,
            "equipment": ["Charcoal grill or plancha"],
            "tags": ["protein", "premium", "gluten-free", "simple"],
            "components": [
                {
                    "name": "Chuletas de Cordero",
                    "yield_qty": 1, "yield_unit": "plate",
                    "ingredients": [
                        ("Frenched Lamb Chops", 280, "g", "3-4 chops, room temperature"),
                        ("EVOO", 15, "mL", None),
                        ("Flaky Sea Salt", 4, "g", "generous"),
                        ("Lemon", 1, "ea", "halved"),
                        ("Fresh Rosemary", 3, "g", "1 sprig"),
                    ],
                    "steps": [
                        (1, "Bring lamb to room temperature — 30 minutes out of the fridge minimum", "20°C", "30 min", "tempering"),
                        (2, "Rub with olive oil and season aggressively with salt on both sides", None, None, "seasoning"),
                        (3, "Grill over highest heat — 3 minutes per side for medium-rare (internal 54°C)", "max / 54°C internal", "6 min total", "grilling"),
                        (4, "Rest 5 minutes. Finish with a squeeze of lemon, EVOO drizzle, and rosemary sprig", None, "5 min", "resting"),
                    ],
                },
            ],
        },
        {
            "name": "Secreto Ibérico",
            "category": "Raciones",
            "description": "The 'secret cut' — a marbled flap from behind the shoulder of the Ibérico pig. Grilled fast, sliced thin.",
            "status": "active",
            "yield_qty": 1, "yield_unit": "serving",
            "total_weight": 280, "total_cost": 9.20, "cost_per_serving": 9.20,
            "equipment": ["Charcoal grill or cast iron", "Sharp carving knife"],
            "tags": ["protein", "premium", "signature", "gluten-free"],
            "components": [
                {
                    "name": "Secreto Ibérico",
                    "yield_qty": 1, "yield_unit": "plate",
                    "ingredients": [
                        ("Secreto Ibérico", 220, "g", "whole piece, room temp"),
                        ("EVOO", 10, "mL", None),
                        ("Flaky Sea Salt", 3, "g", None),
                        ("Pimientos de Padrón", 60, "g", "blistered, for garnish"),
                    ],
                    "steps": [
                        (1, "Bring secreto to room temperature — 20 minutes. The marbling needs to soften", "20°C", "20 min", "tempering"),
                        (2, "Season with salt only. Oil the grill, not the meat — the fat is the oil", None, None, "seasoning"),
                        (3, "Grill over high heat 2-3 minutes per side — the intramuscular fat renders fast. Target medium (57°C)", "high / 57°C", "5 min total", "grilling"),
                        (4, "Rest 4 minutes. Slice thinly against the grain — it should be pink and juicy inside", None, "4 min", "resting"),
                        (5, "Fan slices on plate, top with blistered padrón peppers. Drizzle with EVOO and flaky salt", None, None, "plating"),
                    ],
                },
            ],
        },
        # ── Remaining Postres ──
        {
            "name": "Tarta de Santiago",
            "category": "Postres",
            "description": "Galician almond cake. Dense, moist, flour-free. The Cross of Saint James stenciled in powdered sugar on top.",
            "status": "active",
            "yield_qty": 8, "yield_unit": "slices",
            "total_weight": 600, "total_cost": 2.60, "cost_per_serving": 2.60,
            "equipment": ["9-inch cake pan", "Stand mixer", "Santiago cross stencil"],
            "tags": ["dessert", "gluten-free", "classic", "make-ahead"],
            "components": [
                {
                    "name": "Tarta de Santiago",
                    "yield_qty": 8, "yield_unit": "slices",
                    "ingredients": [
                        ("Ground Marcona Almonds", 250, "g", "finely ground"),
                        ("Granulated Sugar", 200, "g", None),
                        ("Eggs", 4, "ea", "room temperature"),
                        ("Lemon Zest", 5, "g", "1 lemon"),
                        ("Cinnamon", 2, "g", None),
                        ("European Butter", 15, "g", "for pan"),
                        ("Powdered Sugar", 20, "g", "for decoration"),
                    ],
                    "steps": [
                        (1, "Whisk eggs and sugar until pale, thick, and tripled in volume — about 5 minutes on high", None, "5 min", "whipping"),
                        (2, "Fold in ground almonds, lemon zest, and cinnamon. Gentle — don't deflate the eggs", None, None, "folding"),
                        (3, "Pour into buttered 9-inch pan. Bake at 170°C for 35-40 minutes until golden and a skewer comes out clean", "170°C", "35-40 min", "baking"),
                        (4, "Cool completely in pan. Unmold onto serving plate", None, "1 hr", "cooling"),
                        (5, "Place Santiago cross stencil on top, dust with powdered sugar, remove stencil carefully", None, None, "decorating"),
                    ],
                },
            ],
        },
        # ── Bebidas ──
        {
            "name": "Sangría (jarra)",
            "category": "Bebidas",
            "description": "House sangría by the pitcher. Red wine, brandy, citrus, and spices. Made fresh each morning.",
            "status": "active",
            "yield_qty": 4, "yield_unit": "glasses",
            "total_weight": 1000, "total_cost": 3.20, "cost_per_serving": 3.20,
            "equipment": ["Large glass pitcher"],
            "tags": ["beverage", "shareable", "make-ahead"],
            "components": [
                {
                    "name": "Sangría",
                    "yield_qty": 1, "yield_unit": "jarra",
                    "ingredients": [
                        ("Red Wine (Garnacha)", 750, "mL", "1 bottle, fruity not tannic"),
                        ("Brandy de Jerez", 60, "mL", None),
                        ("Orange Juice", 100, "mL", "fresh squeezed"),
                        ("Simple Syrup", 30, "mL", None),
                        ("Orange", 1, "ea", "sliced into wheels"),
                        ("Lemon", 1, "ea", "sliced into wheels"),
                        ("Cinnamon Stick", 1, "ea", None),
                    ],
                    "steps": [
                        (1, "Combine wine, brandy, orange juice, and simple syrup in a pitcher", None, None, "mixing"),
                        (2, "Add citrus wheels and cinnamon stick. Stir gently", None, None, "building"),
                        (3, "Refrigerate minimum 4 hours — overnight is ideal. The fruit needs to macerate", "4°C", "4+ hrs", "macerating"),
                        (4, "Serve over ice in wine glasses. Top with a splash of soda water if desired", None, None, "serving"),
                    ],
                },
            ],
        },
        {
            "name": "Copa de Vermouth",
            "category": "Bebidas",
            "description": "Spanish vermouth hour — vermut rojo on the rocks with an orange twist and olive. La hora del vermut.",
            "status": "active",
            "yield_qty": 1, "yield_unit": "glass",
            "total_weight": 150, "total_cost": 2.40, "cost_per_serving": 2.40,
            "equipment": ["Rocks glass"],
            "tags": ["beverage", "aperitivo", "classic"],
            "components": [
                {
                    "name": "Copa de Vermouth",
                    "yield_qty": 1, "yield_unit": "copa",
                    "ingredients": [
                        ("Lustau Vermut Rojo", 90, "mL", None),
                        ("Ice", 120, "g", "large cubes or sphere"),
                        ("Orange Peel", 1, "ea", "wide strip"),
                        ("Green Olive", 1, "ea", "Gordal or Manzanilla"),
                        ("Soda Water", 15, "mL", "splash, optional"),
                    ],
                    "steps": [
                        (1, "Fill rocks glass with large ice cubes — small ice dilutes too fast", None, None, "building"),
                        (2, "Pour vermouth over ice. Add a splash of soda if desired", None, None, "pouring"),
                        (3, "Express orange peel over the surface — twist to release oils, drop it in", None, None, "garnishing"),
                        (4, "Skewer olive and rest across the glass. Serve with a bowl of marcona almonds on the side", None, None, "serving"),
                    ],
                },
            ],
        },
        {
            "name": "Vino Tinto (copa)",
            "category": "Bebidas",
            "description": "House Garnacha by the glass. Fruit-forward, medium body, from Cariñena DO.",
            "status": "active",
            "yield_qty": 1, "yield_unit": "glass",
            "total_weight": 150, "total_cost": 2.60, "cost_per_serving": 2.60,
            "equipment": ["Red wine glass"],
            "tags": ["beverage", "wine"],
            "components": [
                {
                    "name": "Vino Tinto Service",
                    "yield_qty": 1, "yield_unit": "copa",
                    "ingredients": [
                        ("House Garnacha", 150, "mL", "Cariñena DO"),
                    ],
                    "steps": [
                        (1, "Pour 150mL (5 oz) into a proper red wine glass. Serve at 16-18°C — slightly cooler than room temp", "16-18°C", None, "pouring"),
                    ],
                },
            ],
        },
        {
            "name": "Vino Blanco (copa)",
            "category": "Bebidas",
            "description": "House Albariño by the glass. Crisp, mineral, citrus. From Rías Baixas DO.",
            "status": "active",
            "yield_qty": 1, "yield_unit": "glass",
            "total_weight": 150, "total_cost": 2.80, "cost_per_serving": 2.80,
            "equipment": ["White wine glass"],
            "tags": ["beverage", "wine"],
            "components": [
                {
                    "name": "Vino Blanco Service",
                    "yield_qty": 1, "yield_unit": "copa",
                    "ingredients": [
                        ("House Albariño", 150, "mL", "Rías Baixas DO"),
                    ],
                    "steps": [
                        (1, "Pour 150mL (5 oz) into a chilled white wine glass. Serve at 8-10°C — cold but not ice-cold", "8-10°C", None, "pouring"),
                    ],
                },
            ],
        },
        {
            "name": "Copa de Cava",
            "category": "Bebidas",
            "description": "Codorníu Brut by the glass. Fine bubbles, green apple, toasty. The Spanish champagne.",
            "status": "active",
            "yield_qty": 1, "yield_unit": "glass",
            "total_weight": 150, "total_cost": 3.00, "cost_per_serving": 3.00,
            "equipment": ["Flute or coupe glass"],
            "tags": ["beverage", "sparkling", "celebration"],
            "components": [
                {
                    "name": "Copa de Cava",
                    "yield_qty": 1, "yield_unit": "copa",
                    "ingredients": [
                        ("Cava Brut (Codorníu)", 150, "mL", None),
                    ],
                    "steps": [
                        (1, "Pour 150mL into a chilled flute at a 45° angle to preserve bubbles. Serve at 6-8°C", "6-8°C", None, "pouring"),
                    ],
                },
            ],
        },
    ]

    for rd in recipes_detail:
        recipe_id = uid()
        r = WorkspaceRecipe(
            id=recipe_id, location_id=WS_LOC_ID, name=rd["name"],
            category=rd["category"], description=rd["description"],
            status=rd["status"],
            yield_quantity=rd["yield_qty"], yield_unit=rd["yield_unit"],
            total_weight_g=rd["total_weight"], total_cost=rd["total_cost"],
            cost_per_serving=rd["cost_per_serving"],
            equipment=rd["equipment"], tags=rd["tags"], source="manual",
        )
        objects.append(r)

        for ci, comp in enumerate(rd["components"]):
            comp_id = uid()
            objects.append(RecipeComponent(
                id=comp_id, recipe_id=recipe_id, name=comp["name"],
                sort_order=ci, yield_quantity=comp["yield_qty"], yield_unit=comp["yield_unit"],
            ))
            for ii, (ing_name, weight, unit, notes) in enumerate(comp["ingredients"]):
                total_w = sum(i[1] for i in comp["ingredients"])
                pct = (weight / total_w * 100) if total_w > 0 else 0
                objects.append(RecipeComponentIngredient(
                    id=uid(), component_id=comp_id, name=ing_name,
                    weight_g=weight, percentage=round(pct, 2),
                    unit_display=unit, sort_order=ii, notes=notes,
                ))
            for step_num, instruction, temp, duration, technique in comp["steps"]:
                objects.append(RecipeStep(
                    id=uid(), component_id=comp_id, step_number=step_num,
                    instruction=instruction, temperature=temp,
                    duration=duration, technique=technique,
                ))

    return objects


def build_inbox_items() -> list:
    """Action items for the inbox."""
    return [
        InboxItem(
            id=uid(), location_id=WS_LOC_ID,
            title="🔴 Shrimp 16/20 critically low — 1.8 lb on hand (par: 15 lb)",
            priority="critical", owner="Chef", status="Open", module="inventory",
            summary="Shrimp stock is at 12% of par. Great Lakes delivery arriving at 2 PM today. If delayed, 86 Gambas al Ajillo and reduce Paella portions.",
            detail_points=["On hand: 1.8 lb", "Par: 15 lb", "Next delivery: Today 2 PM", "Backup: frozen block shrimp in walk-in freezer (lower quality)"],
            prompt="What should I do about the shrimp shortage?",
        ),
        InboxItem(
            id=uid(), location_id=WS_LOC_ID,
            title="⚠ Pimientos de Padrón — 2 lb on hand, need 5 lb for tonight",
            priority="high", owner="Garde Manger", status="Open", module="inventory",
            summary="Padrón peppers below par for Saturday dinner service. Rush order drafted for Coastal Produce. Need to submit before noon.",
            detail_points=["On hand: 2 lb", "Needed tonight: 5 lb", "Draft PO: CP-RUSH-001", "Coastal cutoff: 12 PM"],
            prompt="Can we get padrón peppers in time for dinner?",
        ),
        InboxItem(
            id=uid(), location_id=WS_LOC_ID,
            title="💰 Shrimp price alert — up 13.3% from Great Lakes",
            priority="high", owner="Chef", status="Open", module="food-cost",
            summary="Shrimp 16/20 increased from $12.80/lb to $14.50/lb. Impacts Gambas al Ajillo (food cost now 25.7% → 27.4%) and Paella (up 1.2 points).",
            detail_points=["Old price: $12.80/lb", "New price: $14.50/lb", "Impact: +$1.70/lb", "Options: negotiate, reduce portion, or raise menu price $1"],
            prompt="How does the shrimp price increase affect our food cost?",
        ),
        InboxItem(
            id=uid(), location_id=WS_LOC_ID,
            title="📋 Croqueta prep behind — only 50 of 80 pcs possible",
            priority="medium", owner="Fryer Station", status="Open", module="prep",
            summary="Jamón ibérico stock insufficient for full croqueta prep. 50 pieces from current stock, need delivery tomorrow for remaining 30.",
            detail_points=["Target: 80 croquetas", "Possible: 50", "Bottleneck: jamón ibérico", "Ibérico Direct delivery: tomorrow"],
            prompt="What's the plan for croqueta prep today?",
        ),
        InboxItem(
            id=uid(), location_id=WS_LOC_ID,
            title="📊 Food cost trending up — 31.2% WTD vs 30% target",
            priority="medium", owner="Chef", status="Open", module="food-cost",
            summary="Week-to-date food cost is 1.2 points above target. Main drivers: shrimp price increase (+0.4pts), waste on Tuesday (overprepped gazpacho +0.3pts), higher-than-expected raciones mix on Wednesday.",
            detail_points=["WTD food cost: 31.2%", "Target: 30.0%", "Shrimp impact: +0.4pts", "Waste impact: +0.3pts", "Mix shift: +0.5pts"],
            prompt="Break down what's driving food cost up this week",
        ),
        InboxItem(
            id=uid(), location_id=WS_LOC_ID,
            title="🍷 Wine Wednesday recap — 52 covers (+24% vs baseline)",
            priority="low", owner="FOH Manager", status="Resolved", module="marketing",
            summary="This week's Wine Wednesday saw 52 covers vs 42 baseline. Wine cost offset by +18% food attach. Sangría jarra was top seller (14 jarras).",
            detail_points=["Covers: 52 (was 42)", "Revenue: $4,180", "Wine cost: $380", "Top seller: Sangría jarra × 14"],
            prompt="How did Wine Wednesday go this week?",
        ),
        InboxItem(
            id=uid(), location_id=WS_LOC_ID,
            title="📄 Disputed invoice — Great Lakes GLS-1006 ($1,136.63)",
            priority="medium", owner="Chef", status="Open", module="invoices",
            summary="Shrimp on invoice GLS-1006 charged at $14.50/lb but PO had $12.80/lb. Difference: $30.60 on 18 lb. Need to call Great Lakes to resolve.",
            detail_points=["Invoice: GLS-1006", "Disputed item: Shrimp 16/20", "PO price: $12.80/lb", "Invoiced: $14.50/lb", "Difference: $30.60"],
            prompt="What's the story with the disputed Great Lakes invoice?",
        ),
        InboxItem(
            id=uid(), location_id=WS_LOC_ID,
            title="📸 Spring Menu photo shoot — schedule for Mar 26",
            priority="low", owner="Marketing", status="Open", module="marketing",
            summary="Julia (photographer) available March 26, 2-5 PM. Need 4 new dishes plated and ready. Confirm spring menu items by March 24.",
            detail_points=["Date: March 26, 2-5 PM", "Photographer: Julia", "Dishes: 4 new spring items", "Deadline: confirm menu by Mar 24"],
            prompt="What do we need ready for the photo shoot?",
        ),
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN SEEDER
# ═══════════════════════════════════════════════════════════════════════════════

async def seed():
    engine = create_async_engine(DATABASE_URL, echo=False)
    counts: dict[str, int] = {}

    async with engine.begin() as conn:
        # Truncate all tables
        print("🗑  Truncating all tables...")
        await conn.execute(text("""
            DO $$ DECLARE r RECORD;
            BEGIN
                FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
                LOOP
                    EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
                END LOOP;
            END $$;
        """))

    async with AsyncSession(engine) as session:
        async with session.begin():
            # 1. Foundation (must commit before items due to FK on UoM)
            print("🏗  Seeding foundation (location, vendors, GL, UoM)...")
            foundation = build_foundation()
            session.add_all(foundation)
            counts["foundation"] = len(foundation)

        async with session.begin():
            # 2. Items (depends on UoM + GL from foundation)
            print("📦  Seeding items (ingredients)...")
            items = build_items()
            session.add_all(items)
            counts["items"] = len(items)

        async with session.begin():
            # 3. Recipes
            print("📖  Seeding recipes + ingredients...")
            recipes = build_recipes()
            session.add_all(recipes)
            counts["recipes"] = len(recipes)

        async with session.begin():
            # 4. Menu Items
            print("🍽  Seeding menu items...")
            menu = build_menu_items()
            session.add_all(menu)
            counts["menu_items"] = len(menu)

        async with session.begin():
            # 5. POS Sales + Product Mix
            print("💰  Generating 31 days of sales data...")
            daily_sales = build_daily_sales()
            pos = build_pos(daily_sales)
            session.add_all(pos)
            counts["pos_records"] = len(pos)

        async with session.begin():
            # 6. Invoices
            print("🧾  Seeding invoices + line items...")
            inv_objs, purchases_by_date = build_invoices()
            session.add_all(inv_objs)
            counts["invoice_records"] = len(inv_objs)

        async with session.begin():
            # 7. Inventory + Par Levels + Waste
            print("📊  Seeding inventory counts, par levels, waste logs...")
            inv = build_inventory()
            session.add_all(inv)
            counts["inventory_records"] = len(inv)

        async with session.begin():
            # 8. Food Cost + P&L + Budget
            print("📈  Seeding food cost, P&L, budget...")
            fc = build_food_cost_and_pl(daily_sales, purchases_by_date)
            session.add_all(fc)
            counts["financial_records"] = len(fc)

        async with session.begin():
            # 9. Prep Lists
            print("📋  Seeding prep lists (31 days)...")
            prep = build_prep_lists(daily_sales)
            session.add_all(prep)
            counts["prep_records"] = len(prep)

        async with session.begin():
            # 10. Purchase Orders
            print("🚚  Seeding purchase orders...")
            po = build_purchase_orders()
            session.add_all(po)
            counts["po_records"] = len(po)

        async with session.begin():
            # 11. Order Guides
            print("📝  Seeding order guides...")
            og = build_order_guides()
            session.add_all(og)
            counts["order_guides"] = len(og)

        async with session.begin():
            # 12. Price Alerts
            print("⚠️   Seeding price alerts...")
            alerts = build_price_alerts()
            session.add_all(alerts)
            counts["price_alerts"] = len(alerts)

        async with session.begin():
            # 13. Workspace Orders
            print("🖥  Seeding workspace orders...")
            ws_orders = build_workspace_orders()
            session.add_all(ws_orders)
            counts["ws_orders"] = len(ws_orders)

        async with session.begin():
            # 14. Workspace Inventory
            print("🖥  Seeding workspace inventory...")
            ws_inv = build_workspace_inventory()
            session.add_all(ws_inv)
            counts["ws_inventory"] = len(ws_inv)

        async with session.begin():
            # 15. Workspace Prep
            print("🖥  Seeding workspace prep...")
            ws_prep = build_workspace_prep()
            session.add_all(ws_prep)
            counts["ws_prep"] = len(ws_prep)

        async with session.begin():
            # 16. Workspace Food Cost
            print("🖥  Seeding workspace food cost...")
            ws_fc = build_workspace_food_cost()
            session.add_all(ws_fc)
            counts["ws_food_cost"] = len(ws_fc)

        async with session.begin():
            # 17. Workspace Menu
            print("🖥  Seeding workspace menu...")
            ws_menu = build_workspace_menu()
            session.add_all(ws_menu)
            counts["ws_menu"] = len(ws_menu)

        async with session.begin():
            # 18. Workspace Campaigns
            print("🖥  Seeding workspace campaigns...")
            ws_camp = build_workspace_campaigns()
            session.add_all(ws_camp)
            counts["ws_campaigns"] = len(ws_camp)

        async with session.begin():
            # 19. Workspace Invoices
            print("🖥  Seeding workspace invoices...")
            ws_inv2 = build_workspace_invoices()
            session.add_all(ws_inv2)
            counts["ws_invoices"] = len(ws_inv2)

        async with session.begin():
            # 20. Workspace Recipes
            print("🖥  Seeding workspace recipes (Modernist format)...")
            ws_recipes = build_workspace_recipes()
            session.add_all(ws_recipes)
            counts["ws_recipes"] = len(ws_recipes)

        async with session.begin():
            # 21. Inbox Items
            print("📬  Seeding inbox items...")
            inbox = build_inbox_items()
            session.add_all(inbox)
            counts["inbox_items"] = len(inbox)

    await engine.dispose()

    # Summary
    total = sum(counts.values())
    print("\n" + "═" * 50)
    print("  SEED COMPLETE — Carabiner Tapas")
    print("═" * 50)
    for label, count in counts.items():
        print(f"  {label:.<30} {count:>5}")
    print(f"  {'TOTAL':.<30} {total:>5}")
    print("═" * 50)


def main():
    parser = argparse.ArgumentParser(description="Seed Carabiner Tapas with realistic data")
    parser.add_argument("--no-confirm", action="store_true", help="Skip confirmation prompt")
    args = parser.parse_args()

    if not args.no_confirm:
        print("⚠  This will TRUNCATE all tables and seed with fresh data.")
        print(f"   Database: {DATABASE_URL}")
        resp = input("   Continue? [y/N] ")
        if resp.lower() != "y":
            print("Aborted.")
            return

    asyncio.run(seed())


if __name__ == "__main__":
    main()
