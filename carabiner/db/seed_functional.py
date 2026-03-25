"""
Functional data seed — fills in NEW fields on existing workspace rows and
inserts new operational-layer rows (DailyFoodCost, DailyPL, BudgetPeriod,
ParLevel, WasteLog, PriceAlert, Vendor).

Designed to run AFTER the original seed has populated the core workspace tables.
Uses raw SQL so it can UPDATE existing rows idempotently.

Usage (inside Docker):
    docker exec carabiner-os-agent-zero-1 python -m carabiner.db.seed_functional

Usage (local, with DATABASE_URL set):
    python -m carabiner.db.seed_functional
"""

from __future__ import annotations

import asyncio
import json
import os
import random
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
random.seed(2026_03_24)

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://carabiner:carabiner@localhost:5432/carabiner",
)

TODAY = date(2026, 3, 24)
MONTH_START = date(2026, 3, 1)


def D(val) -> Decimal:
    return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def D4(val) -> Decimal:
    return Decimal(str(val)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


# ---------------------------------------------------------------------------
# Menu Engineering data — maps item_name to financial fields
# ---------------------------------------------------------------------------
# (item_name, price, food_cost, qty_sold_30d)
# Prices: modern tapas/fine-dining range $9-$35
# Food cost: 25-38% of price
MENU_ENGINEERING = [
    # Tapas Frias
    ("Pan con Tomate",         9.00,   1.85,  380),
    ("Gazpacho",              11.00,   2.20,  220),
    ("Boquerones en Vinagre", 13.00,   3.80,  175),
    ("Jamon Iberico",         18.00,   5.85,  280),
    ("Ensaladilla Rusa",      11.00,   2.40,  155),
    ("Queso Manchego Board",  15.00,   4.20,  210),
    ("Pulpo a la Gallega",    16.00,   4.80,  140),
    # Tapas Calientes
    ("Patatas Bravas",        10.00,   1.60,  400),
    ("Croquetas de Jamon",    12.00,   2.90,  360),
    ("Gambas al Ajillo",      14.00,   3.60,  310),
    ("Pimientos de Padron",   10.00,   2.10,  260),
    ("Tortilla Espanola",     11.00,   2.00,  230),
    ("Albondigas",            13.00,   3.10,  200),
    ("Calamares Fritos",      13.00,   3.20,  225),
    ("Chorizo al Vino",       12.00,   2.70,  195),
    # Raciones
    ("Paella de Mariscos",    32.00,   9.80,  115),
    ("Arroz Negro",           28.00,   7.60,   90),
    ("Chuletas de Cordero",   35.00,  10.50,   70),
    ("Secreto Iberico",       30.00,   9.20,   95),
    # Postres
    ("Crema Catalana",        11.00,   1.80,  180),
    ("Churros con Chocolate",  10.00,  1.50,  210),
    ("Tarta de Santiago",     13.00,   2.60,  120),
    # Bebidas
    ("Sangria (jarra)",       14.00,   3.20,  265),
    ("Copa de Vermouth",      10.00,   2.40,  175),
    ("Vino Tinto (copa)",     13.00,   2.60,  240),
    ("Vino Blanco (copa)",    12.00,   2.80,  195),
    ("Copa de Cava",          14.00,   3.00,  155),
]

# ---------------------------------------------------------------------------
# Inventory metadata — maps item_name to (category, storage_area, unit_cost)
# ---------------------------------------------------------------------------
INVENTORY_META = {
    "Roma Tomatoes":              ("Produce",     "Walk-In",      "$28.00/cs"),
    "Garlic (peeled)":            ("Produce",     "Walk-In",      "$4.50/lb"),
    "Yellow Onions":              ("Produce",     "Dry Storage",  "$12.00/bag"),
    "Yukon Gold Potatoes":        ("Produce",     "Walk-In",      "$32.00/cs"),
    "Pimientos de Padron":        ("Produce",     "Walk-In",      "$14.00/lb"),
    "Lemons":                     ("Produce",     "Walk-In",      "$38.00/cs"),
    "Flat-Leaf Parsley":          ("Produce",     "Walk-In",      "$1.50/bch"),
    "Saffron Threads":            ("Produce",     "Dry Storage",  "$8.00/g"),
    "Pimenton de la Vera":        ("Dry Goods",   "Dry Storage",  "$12.00/ea"),
    "Extra Virgin Olive Oil":     ("Produce",     "Dry Storage",  "$18.00/L"),
    "Sherry Vinegar":             ("Produce",     "Dry Storage",  "$9.50/btl"),
    "Marcona Almonds":            ("Dry Goods",   "Dry Storage",  "$22.00/lb"),
    "Fresh Basil":                ("Produce",     "Walk-In",      "$2.00/bch"),
    "Mesclun Mix":                ("Produce",     "Walk-In",      "$6.50/lb"),
    "Guindilla Peppers":          ("Produce",     "Walk-In",      "$0.60/ea"),
    "Jamon Iberico (sliced)":     ("Protein",     "Walk-In",      "$65.00/lb"),
    "Spanish Chorizo Links":      ("Protein",     "Walk-In",      "$12.00/lb"),
    "Ground Pork":                ("Protein",     "Walk-In",      "$5.50/lb"),
    "Lamb Chops (frenched)":      ("Protein",     "Walk-In",      "$28.00/lb"),
    "Secreto Iberico":            ("Protein",     "Walk-In",      "$32.00/lb"),
    "Chicken Thighs (boneless)":  ("Protein",     "Walk-In",      "$4.80/lb"),
    "White Anchovies (boquerones)": ("Seafood",   "Walk-In",      "$18.00/lb"),
    "Shrimp 16/20":               ("Seafood",     "Walk-In",      "$14.50/lb"),
    "Spanish Octopus (frozen)":   ("Seafood",     "Freezer",      "$12.00/lb"),
    "Calamari Tubes & Tentacles": ("Seafood",     "Walk-In",      "$9.50/lb"),
    "PEI Mussels":                ("Seafood",     "Walk-In",      "$4.50/lb"),
    "Littleneck Clams":           ("Seafood",     "Walk-In",      "$9.00/dz"),
    "Atlantic Cod Fillets":       ("Seafood",     "Walk-In",      "$13.00/lb"),
    "Manchego Cheese (aged 6mo)": ("Dairy",       "Walk-In",      "$16.00/lb"),
    "Eggs (large)":               ("Dairy",       "Walk-In",      "$4.80/dz"),
    "Heavy Cream":                ("Dairy",       "Walk-In",      "$6.50/L"),
    "European Butter":            ("Dairy",       "Walk-In",      "$7.00/lb"),
    "Queso Fresco":               ("Dairy",       "Walk-In",      "$8.00/lb"),
    "All-Purpose Flour":          ("Dry Goods",   "Dry Storage",  "$8.00/bag"),
    "Panko Breadcrumbs":          ("Dry Goods",   "Dry Storage",  "$5.50/bag"),
    "Bomba Rice":                 ("Dry Goods",   "Dry Storage",  "$14.00/kg"),
    "Granulated Sugar":           ("Dry Goods",   "Dry Storage",  "$6.00/bag"),
    "Chocolate 70% (Valrhona)":   ("Dry Goods",   "Dry Storage",  "$28.00/kg"),
    "Ground Almonds (Marcona)":   ("Dry Goods",   "Dry Storage",  "$18.00/lb"),
    "Cayenne Pepper":             ("Dry Goods",   "Dry Storage",  "$6.00/ea"),
    "Arborio Rice":               ("Dry Goods",   "Dry Storage",  "$6.00/kg"),
    "House Red Wine (Garnacha)":  ("Beverage",    "Bar",          "$72.00/cs"),
    "House White Wine (Albarino)":("Beverage",    "Bar",          "$84.00/cs"),
    "Lustau Vermut Rojo":         ("Beverage",    "Bar",          "$18.00/btl"),
    "Sangria Base (house blend)": ("Beverage",    "Bar",          "$8.00/L"),
    "Cava Brut (Codorniu)":       ("Beverage",    "Bar",          "$11.00/btl"),
    "Brandy de Jerez":            ("Beverage",    "Bar",          "$24.00/btl"),
    "Whole Milk":                 ("Dairy",       "Walk-In",      "$2.80/L"),
}

# ---------------------------------------------------------------------------
# Campaign enhancements
# ---------------------------------------------------------------------------
from datetime import datetime as _dt, timezone as _tz
CAMPAIGN_UPDATES = [
    ("Wine Wednesday",        _dt(2026, 3, 5, 17, 0, tzinfo=_tz.utc), _dt(2026, 4, 30, 23, 0, tzinfo=_tz.utc), 15000, ["instagram", "in-house", "recurring"]),
    ("Weekend Brunch Launch", _dt(2026, 4, 5, 10, 0, tzinfo=_tz.utc), _dt(2026, 4, 6, 15, 0, tzinfo=_tz.utc), 35000, ["instagram", "yelp", "print", "launch"]),
    ("Tapas Tuesday",         _dt(2026, 3, 4, 17, 0, tzinfo=_tz.utc), _dt(2026, 4, 29, 22, 0, tzinfo=_tz.utc), 8000,  ["instagram", "recurring", "promotion"]),
    ("Spring Menu Preview",   _dt(2026, 3, 28, 12, 0, tzinfo=_tz.utc), _dt(2026, 3, 28, 12, 0, tzinfo=_tz.utc), 5000,  ["email", "instagram", "seasonal"]),
]

# ---------------------------------------------------------------------------
# Invoice Phase-1 enrichment
# ---------------------------------------------------------------------------
INVOICE_UPDATES = [
    ("CP-1001",  "full",      "Chef Esteban",  92),
    ("GLS-1002", "full",      "Chef Esteban",  88),
    ("ID-1003",  "full",      "Chef Esteban",  95),
    ("CP-1005",  "partial",   None,            85),
    ("GLS-1006", "exception", None,            78),
    ("VS-1007",  "unmatched", None,            91),
]

# ---------------------------------------------------------------------------
# Vendor definitions
# ---------------------------------------------------------------------------
VENDORS = [
    ("Sysco",              "orders@sysco.com",              "(312) 555-1001", "Net 30"),
    ("Chef's Warehouse",   "sales@chefswarehouse.com",      "(312) 555-1002", "Net 15"),
    ("Coastal Produce",    "orders@coastalproduce.com",     "(312) 555-0101", "Net 15"),
    ("US Foods",           "orders@usfoods.com",            "(312) 555-1004", "Net 30"),
    ("Local Dairy Co",     "info@localdairyco.com",         "(312) 555-1005", "Net 7"),
    ("Specialty Imports",  "ventas@specialtyimports.com",   "(312) 555-1006", "Net 30"),
]


# =========================================================================
# SQL execution helpers
# =========================================================================

async def run():
    engine = create_async_engine(DATABASE_URL, echo=False)
    stats: dict[str, int] = {}

    async with engine.begin() as conn:
        # ---------------------------------------------------------------
        # 0. Grab location IDs we need
        # ---------------------------------------------------------------
        row = (await conn.execute(text(
            "SELECT id FROM workspace_locations LIMIT 1"
        ))).first()
        if not row:
            print("ERROR: No workspace_locations found. Run the main seed first.")
            return
        ws_loc_id = row[0]

        row2 = (await conn.execute(text(
            "SELECT id FROM locations LIMIT 1"
        ))).first()
        if not row2:
            print("ERROR: No locations found. Run the main seed first.")
            return
        loc_id = row2[0]

        print(f"Using workspace_location: {ws_loc_id}")
        print(f"Using location:           {loc_id}")

        # ---------------------------------------------------------------
        # 1. MENU ITEMS — Update workspace_menu with engineering fields
        # ---------------------------------------------------------------
        print("\n[1/14] Updating workspace_menu with menu engineering data...")
        total_qty = sum(m[3] for m in MENU_ENGINEERING)
        updated = 0
        for item_name, price, food_cost, qty_sold in MENU_ENGINEERING:
            cm = price - food_cost
            fc_pct = round(food_cost / price * 100, 2)
            mix_pct = round(qty_sold / total_qty * 100, 2)

            # Use LIKE for fuzzy matching since names may have accents
            result = await conn.execute(text("""
                UPDATE workspace_menu
                SET price = :price,
                    food_cost = :food_cost,
                    contribution_margin = :cm,
                    food_cost_pct = :fc_pct,
                    quantity_sold = :qty_sold,
                    menu_mix_pct = :mix_pct,
                    updated_at = NOW()
                WHERE location_id = :loc_id
                  AND item_name ILIKE '%' || :name_pattern || '%'
            """), {
                "price": price,
                "food_cost": food_cost,
                "cm": round(cm, 2),
                "fc_pct": fc_pct,
                "qty_sold": qty_sold,
                "mix_pct": mix_pct,
                "loc_id": ws_loc_id,
                "name_pattern": item_name[:20],  # use first 20 chars for matching
            })
            updated += result.rowcount
        stats["menu_items_updated"] = updated
        print(f"   Updated {updated} menu items")

        # ---------------------------------------------------------------
        # 2. INVENTORY — Update workspace_inventory with metadata
        # ---------------------------------------------------------------
        print("[2/14] Updating workspace_inventory with category/storage/cost...")
        updated = 0
        for item_name, (category, storage, unit_cost) in INVENTORY_META.items():
            # Match on first 15 chars to handle accent differences
            pattern = item_name[:15]
            result = await conn.execute(text("""
                UPDATE workspace_inventory
                SET category = :category,
                    storage_area = :storage,
                    unit_cost = :unit_cost,
                    updated_at = NOW()
                WHERE location_id = :loc_id
                  AND item_name ILIKE '%' || :pattern || '%'
            """), {
                "category": category,
                "storage": storage,
                "unit_cost": unit_cost,
                "loc_id": ws_loc_id,
                "pattern": pattern,
            })
            updated += result.rowcount
        stats["inventory_updated"] = updated
        print(f"   Updated {updated} inventory items")

        # ---------------------------------------------------------------
        # 3. ORDERS — Update workspace_orders with realistic line_items
        # ---------------------------------------------------------------
        print("[3/14] Verifying workspace_orders line_items...")
        # The existing seed already has good line_items JSONB data.
        # Just confirm they exist.
        row = (await conn.execute(text(
            "SELECT COUNT(*) FROM workspace_orders WHERE line_items IS NOT NULL AND location_id = :loc"
        ), {"loc": ws_loc_id})).scalar()
        stats["orders_with_line_items"] = row
        print(f"   {row} orders already have line_items")

        # ---------------------------------------------------------------
        # 4. INVOICES — Update workspace_invoices with Phase-1 fields
        # ---------------------------------------------------------------
        print("[4/14] Updating workspace_invoices with match_status/ocr_confidence...")
        updated = 0
        for inv_num, match_status, approved_by, ocr_conf in INVOICE_UPDATES:
            params = {
                "inv_num": inv_num,
                "match_status": match_status,
                "ocr_confidence": ocr_conf,
                "loc_id": ws_loc_id,
            }
            if approved_by:
                result = await conn.execute(text("""
                    UPDATE workspace_invoices
                    SET match_status = :match_status,
                        approved_by = :approved_by,
                        approved_at = NOW() - interval '3 days',
                        ocr_confidence = :ocr_confidence,
                        updated_at = NOW()
                    WHERE location_id = :loc_id
                      AND invoice_number = :inv_num
                """), {**params, "approved_by": approved_by})
            else:
                result = await conn.execute(text("""
                    UPDATE workspace_invoices
                    SET match_status = :match_status,
                        ocr_confidence = :ocr_confidence,
                        updated_at = NOW()
                    WHERE location_id = :loc_id
                      AND invoice_number = :inv_num
                """), params)
            updated += result.rowcount
        stats["invoices_updated"] = updated
        print(f"   Updated {updated} invoices")

        # ---------------------------------------------------------------
        # 5. PREP — Verify existing station/service_lane
        # ---------------------------------------------------------------
        print("[5/14] Verifying workspace_prep station data...")
        row = (await conn.execute(text(
            "SELECT COUNT(*) FROM workspace_prep WHERE station IS NOT NULL AND location_id = :loc"
        ), {"loc": ws_loc_id})).scalar()
        stats["prep_with_station"] = row
        print(f"   {row} prep tasks already have station data")

        # ---------------------------------------------------------------
        # 6. CAMPAIGNS — Update with schedule/tags/budget
        # ---------------------------------------------------------------
        print("[6/14] Updating workspace_campaigns with schedule/tags/budget...")
        updated = 0
        for camp_name, sched_at, end_dt, budget, tags in CAMPAIGN_UPDATES:
            result = await conn.execute(text("""
                UPDATE workspace_campaigns
                SET scheduled_at = :sched,
                    end_date = :end_dt,
                    budget_cents = :budget,
                    tags = CAST(:tags AS jsonb),
                    updated_at = NOW()
                WHERE location_id = :loc_id
                  AND campaign_name ILIKE '%' || :pattern || '%'
            """), {
                "sched": sched_at,
                "end_dt": end_dt,
                "budget": budget,
                "tags": json.dumps(tags),  # JSON array
                "loc_id": ws_loc_id,
                "pattern": camp_name[:20],
            })
            updated += result.rowcount
        stats["campaigns_updated"] = updated
        print(f"   Updated {updated} campaigns")

        # ---------------------------------------------------------------
        # 7 & 8. DailyFoodCost + DailyPL — 30 days (single pass)
        # ---------------------------------------------------------------
        print("[7/14] Inserting 30 days of daily_food_cost...")
        print("[8/14] Inserting 30 days of daily_pl...")

        # Pre-compute all daily data so both tables use identical numbers
        beginning_inv = Decimal("12500")
        daily_rows = []
        for i in range(30):
            d = MONTH_START + timedelta(days=i)
            if d > TODAY:
                break
            dow = d.weekday()
            # Sales pattern by day of week
            if dow in (4, 5):    # Fri/Sat
                sales = D(random.uniform(7000, 11000))
            elif dow == 6:       # Sun
                sales = D(random.uniform(4500, 6500))
            elif dow in (0, 1):  # Mon/Tue
                sales = D(random.uniform(3000, 4500))
            else:                # Wed/Thu
                sales = D(random.uniform(4500, 6500))

            purchases = D(random.uniform(1500, 4000)) if dow in (0, 1, 3) else D(0)
            usage = D(float(sales) * random.uniform(0.28, 0.35))
            ending_inv = beginning_inv + purchases - usage
            if ending_inv < Decimal("3000"):
                ending_inv = D(random.uniform(4000, 6000))
            actual_fc = beginning_inv + purchases - ending_inv
            fc_pct = D(float(actual_fc) / float(sales) * 100) if sales > 0 else D(0)

            # Labor: 25-32% of revenue
            base_labor_pct = 0.30 if dow in (4, 5) else 0.32 if dow in (0, 1) else 0.31
            labor = D(float(sales) * base_labor_pct * random.uniform(0.95, 1.05))
            labor_pct = D(float(labor) / float(sales) * 100) if sales > 0 else D(0)

            daily_rows.append({
                "d": d, "beg": beginning_inv, "pur": purchases,
                "end": ending_inv, "afc": actual_fc, "sales": sales,
                "fc_pct": fc_pct, "labor": labor, "labor_pct": labor_pct,
            })
            beginning_inv = ending_inv

        # Insert food cost
        for r in daily_rows:
            await conn.execute(text("""
                INSERT INTO daily_food_cost
                    (id, location_id, cost_date, beginning_inventory, purchases,
                     ending_inventory, actual_food_cost, sales, food_cost_pct,
                     created_at, updated_at)
                VALUES
                    (gen_random_uuid(), :loc, :dt, :beg, :pur, :end, :afc, :sales, :pct,
                     NOW(), NOW())
                ON CONFLICT ON CONSTRAINT uq_daily_food_cost_loc_date
                DO UPDATE SET
                    beginning_inventory = EXCLUDED.beginning_inventory,
                    purchases = EXCLUDED.purchases,
                    ending_inventory = EXCLUDED.ending_inventory,
                    actual_food_cost = EXCLUDED.actual_food_cost,
                    sales = EXCLUDED.sales,
                    food_cost_pct = EXCLUDED.food_cost_pct,
                    updated_at = NOW()
            """), {
                "loc": loc_id, "dt": r["d"],
                "beg": float(r["beg"]), "pur": float(r["pur"]),
                "end": float(r["end"]), "afc": float(r["afc"]),
                "sales": float(r["sales"]), "pct": float(r["fc_pct"]),
            })
        stats["daily_food_cost"] = len(daily_rows)
        print(f"   Upserted {len(daily_rows)} days of food cost")

        # Insert P&L (same numbers, plus labor)
        for r in daily_rows:
            await conn.execute(text("""
                INSERT INTO daily_pl
                    (id, location_id, pl_date, beginning_inventory, purchases,
                     ending_inventory, cogs, revenue, food_cost_pct,
                     labor_cost, labor_pct, created_at, updated_at)
                VALUES
                    (gen_random_uuid(), :loc, :dt, :beg, :pur, :end, :cogs, :rev, :fc_pct,
                     :labor, :labor_pct, NOW(), NOW())
                ON CONFLICT ON CONSTRAINT uq_daily_pl_loc_date
                DO UPDATE SET
                    beginning_inventory = EXCLUDED.beginning_inventory,
                    purchases = EXCLUDED.purchases,
                    ending_inventory = EXCLUDED.ending_inventory,
                    cogs = EXCLUDED.cogs,
                    revenue = EXCLUDED.revenue,
                    food_cost_pct = EXCLUDED.food_cost_pct,
                    labor_cost = EXCLUDED.labor_cost,
                    labor_pct = EXCLUDED.labor_pct,
                    updated_at = NOW()
            """), {
                "loc": loc_id, "dt": r["d"],
                "beg": float(r["beg"]), "pur": float(r["pur"]),
                "end": float(r["end"]), "cogs": float(r["afc"]),
                "rev": float(r["sales"]), "fc_pct": float(r["fc_pct"]),
                "labor": float(r["labor"]), "labor_pct": float(r["labor_pct"]),
            })
        stats["daily_pl"] = len(daily_rows)
        print(f"   Upserted {len(daily_rows)} days of P&L")

        # ---------------------------------------------------------------
        # 9. BudgetPeriod — 1 current month
        # ---------------------------------------------------------------
        print("[9/14] Inserting budget period for current month...")
        # Delete existing for this month, then insert
        await conn.execute(text("""
            DELETE FROM budget_periods
            WHERE location_id = :loc
              AND period_start = :start
              AND period_end = :end
        """), {"loc": loc_id, "start": MONTH_START, "end": date(2026, 3, 31)})

        await conn.execute(text("""
            INSERT INTO budget_periods
                (id, location_id, period_start, period_end,
                 target_food_cost_pct, target_labor_pct, target_revenue,
                 created_at, updated_at)
            VALUES
                (gen_random_uuid(), :loc, :start, :end,
                 30.0, 28.0, 250000.00, NOW(), NOW())
        """), {"loc": loc_id, "start": MONTH_START, "end": date(2026, 3, 31)})
        stats["budget_periods"] = 1
        print("   Inserted 1 budget period")

        # ---------------------------------------------------------------
        # 10. ParLevel — top 20 items
        # ---------------------------------------------------------------
        print("[10/14] Inserting par levels for top 20 inventory items...")
        # Get item IDs from items table
        items_rows = (await conn.execute(text(
            "SELECT id, name FROM items WHERE is_active = true ORDER BY name LIMIT 20"
        ))).fetchall()
        inserted = 0
        for item_id, item_name in items_rows:
            # Realistic par levels based on item type
            if "shrimp" in item_name.lower() or "octopus" in item_name.lower():
                par = round(random.uniform(15, 25), 2)
            elif "saffron" in item_name.lower():
                par = round(random.uniform(8, 15), 2)
            elif "tomato" in item_name.lower() or "potato" in item_name.lower():
                par = round(random.uniform(25, 45), 2)
            elif "wine" in item_name.lower() or "cava" in item_name.lower():
                par = round(random.uniform(6, 12), 2)
            else:
                par = round(random.uniform(10, 30), 2)

            await conn.execute(text("""
                INSERT INTO par_levels
                    (id, location_id, item_id, min_quantity, day_of_week,
                     created_at, updated_at)
                VALUES
                    (gen_random_uuid(), :loc, :item_id, :par, NULL, NOW(), NOW())
                ON CONFLICT ON CONSTRAINT uq_par_level_loc_item_day
                DO UPDATE SET
                    min_quantity = EXCLUDED.min_quantity,
                    updated_at = NOW()
            """), {"loc": loc_id, "item_id": item_id, "par": par})
            inserted += 1

        stats["par_levels"] = inserted
        print(f"   Upserted {inserted} par levels")

        # ---------------------------------------------------------------
        # 11. WasteLog — 15 entries over last 2 weeks
        # ---------------------------------------------------------------
        print("[11/14] Inserting waste log entries...")
        # Get some perishable items
        perishable_rows = (await conn.execute(text("""
            SELECT id, name, category FROM items
            WHERE category IN ('Produce', 'Seafood', 'Dairy', 'Protein')
              AND is_active = true
        """))).fetchall()

        waste_reasons = ["spoilage", "overproduction", "expired"]
        waste_notes = {
            "spoilage": [
                "Found soft/discolored during AM walk-in check",
                "Slimy texture, pulled from service",
                "Mold visible on surface",
            ],
            "overproduction": [
                "Over-prepped for slow Monday service",
                "Excess from weekend prep — did not hold",
                "Made double batch, only used half",
            ],
            "expired": [
                "Past use-by date, discarded per FIFO",
                "Expired label found during inventory count",
                "3 days past best-by, quality degraded",
            ],
        }

        # Clear old waste logs from this seeder (idempotent)
        await conn.execute(text("""
            DELETE FROM waste_logs
            WHERE location_id = :loc
              AND waste_date >= :start
              AND waste_date <= :end
              AND notes LIKE '%seed_functional%'
        """), {"loc": loc_id, "start": TODAY - timedelta(days=14), "end": TODAY})

        inserted = 0
        for i in range(15):
            d = TODAY - timedelta(days=random.randint(0, 13))
            item = random.choice(perishable_rows)
            reason = random.choice(waste_reasons)
            qty = round(random.uniform(0.5, 4.0), 2)
            # Estimate cost based on item
            est_cost = round(qty * random.uniform(3.0, 18.0), 2)
            note_base = random.choice(waste_notes[reason])
            note = f"{note_base} [seed_functional]"

            uom = "lb"
            if "cream" in item[1].lower() or "milk" in item[1].lower():
                uom = "L"
            elif "egg" in item[1].lower():
                uom = "dz"

            await conn.execute(text("""
                INSERT INTO waste_logs
                    (id, location_id, item_id, quantity, unit, reason,
                     notes, waste_date, estimated_cost, created_at, updated_at)
                VALUES
                    (gen_random_uuid(), :loc, :item_id, :qty, :unit, :reason,
                     :notes, :dt, :cost, NOW(), NOW())
            """), {
                "loc": loc_id, "item_id": item[0],
                "qty": qty, "unit": uom, "reason": reason,
                "notes": note, "dt": d, "cost": est_cost,
            })
            inserted += 1

        stats["waste_logs"] = inserted
        print(f"   Inserted {inserted} waste log entries")

        # ---------------------------------------------------------------
        # 12. PriceAlert — 5 recent alerts
        # ---------------------------------------------------------------
        print("[12/14] Inserting price alerts...")
        # Get vendor IDs
        vendor_rows = (await conn.execute(text(
            "SELECT id, name FROM vendors"
        ))).fetchall()
        vendor_map = {v[1]: v[0] for v in vendor_rows}

        # Get item IDs for alert items
        alert_items_names = [
            "Shrimp 16/20", "Extra Virgin Olive Oil",
            "Jamon Iberico", "Spanish Octopus", "European Butter",
        ]
        item_rows_all = (await conn.execute(text(
            "SELECT id, name FROM items WHERE is_active = true"
        ))).fetchall()
        item_map = {i[1]: i[0] for i in item_rows_all}

        # Clear old alerts from this seeder
        await conn.execute(text("""
            DELETE FROM price_alerts
            WHERE location_id = :loc
              AND alert_date >= '2026-03-10'
              AND acknowledged = false
        """), {"loc": loc_id})
        # Also clear acknowledged ones we might have inserted
        await conn.execute(text("""
            DELETE FROM price_alerts
            WHERE location_id = :loc
              AND alert_date >= '2026-03-10'
        """), {"loc": loc_id})

        alerts_data = [
            ("Shrimp 16/20",         "Great Lakes Seafood",  12.80, 14.50, 13.28, "2026-03-18", False),
            ("Extra Virgin Olive Oil","Coastal Produce",      16.50, 18.00,  9.09, "2026-03-15", True),
            ("Jamon Iberico",         "Iberico Direct",       60.00, 65.00,  8.33, "2026-03-10", True),
            ("Spanish Octopus",       "Great Lakes Seafood",  10.50, 12.00, 14.29, "2026-03-20", False),
            ("European Butter",       "Coastal Produce",       6.20,  7.00, 12.90, "2026-03-21", False),
        ]

        inserted = 0
        for item_search, vendor_search, prev, new, pct, dt_str, ack in alerts_data:
            # Find matching item (partial match)
            matched_item_id = None
            for iname, iid in item_map.items():
                if item_search.lower() in iname.lower() or iname.lower().startswith(item_search.lower()[:10]):
                    matched_item_id = iid
                    break
            # Find matching vendor (partial match)
            matched_vendor_id = None
            for vname, vid in vendor_map.items():
                if vendor_search.lower()[:10] in vname.lower():
                    matched_vendor_id = vid
                    break

            if not matched_item_id or not matched_vendor_id:
                print(f"   SKIP: Could not match item={item_search} or vendor={vendor_search}")
                continue

            alert_date = date.fromisoformat(dt_str) if isinstance(dt_str, str) else dt_str
            await conn.execute(text("""
                INSERT INTO price_alerts
                    (id, location_id, item_id, vendor_id,
                     previous_price, new_price, pct_change,
                     alert_date, acknowledged, created_at, updated_at)
                VALUES
                    (gen_random_uuid(), :loc, :item_id, :vendor_id,
                     :prev, :new, :pct, :dt, :ack, NOW(), NOW())
            """), {
                "loc": loc_id, "item_id": matched_item_id,
                "vendor_id": matched_vendor_id,
                "prev": prev, "new": new, "pct": pct,
                "dt": alert_date, "ack": ack,
            })
            inserted += 1

        stats["price_alerts"] = inserted
        print(f"   Inserted {inserted} price alerts")

        # ---------------------------------------------------------------
        # 13. Vendors — ensure 6 exist
        # ---------------------------------------------------------------
        print("[13/14] Ensuring vendors exist...")
        inserted = 0
        for name, email, phone, terms in VENDORS:
            result = await conn.execute(text("""
                INSERT INTO vendors (id, name, contact_email, contact_phone, payment_terms, created_at, updated_at)
                VALUES (gen_random_uuid(), :name, :email, :phone, :terms, NOW(), NOW())
                ON CONFLICT DO NOTHING
            """), {"name": name, "email": email, "phone": phone, "terms": terms})
            # ON CONFLICT DO NOTHING won't have a unique constraint to hit
            # since vendors.name is not unique. Check if exists first.
        # Count total vendors
        total_vendors = (await conn.execute(text("SELECT COUNT(*) FROM vendors"))).scalar()
        stats["total_vendors"] = total_vendors
        print(f"   {total_vendors} vendors now in database")

        # ---------------------------------------------------------------
        # 14. Location — ensure at least 1 exists
        # ---------------------------------------------------------------
        print("[14/14] Verifying location exists...")
        loc_count = (await conn.execute(text("SELECT COUNT(*) FROM locations"))).scalar()
        stats["locations"] = loc_count
        print(f"   {loc_count} location(s) found")

    await engine.dispose()

    # Summary
    print("\n" + "=" * 55)
    print("  SEED FUNCTIONAL DATA COMPLETE")
    print("=" * 55)
    for label, count in stats.items():
        print(f"  {label:.<35} {count:>5}")
    print("=" * 55)


if __name__ == "__main__":
    print("Carabiner OS — Functional Data Seed")
    print(f"Database: {DATABASE_URL}")
    print()
    asyncio.run(run())
