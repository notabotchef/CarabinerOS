"""Consolidate to single location: cOS Test Kitchen.

Replaces the multi-restaurant seed data from v2 with a single 30-seat
test kitchen. Updates all FK references, removes extra locations, and
reseeds workspace tables with realistic small-restaurant data.

Revision ID: 009
Revises: 008
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal
import random

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None

# The canonical single-location UUID (reuses River North slot)
LOC_ID = uuid.UUID("00000000-0000-0000-0001-000000000001")
ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

# IDs to absorb (West Loop + Fulton Market)
OLD_LOCS = [
    uuid.UUID("00000000-0000-0000-0001-000000000002"),
    uuid.UUID("00000000-0000-0000-0001-000000000003"),
]


def upgrade() -> None:
    conn = op.get_bind()

    # ------------------------------------------------------------------
    # 1. Point all workspace-scoped FKs at the canonical location
    # ------------------------------------------------------------------
    ws_tables = [
        "inbox_items", "workspace_orders", "workspace_inventory",
        "workspace_prep", "workspace_food_cost", "workspace_menu",
        "workspace_campaigns", "workspace_invoices", "workspace_recipes",
        "action_log",
    ]
    for tbl in ws_tables:
        conn.execute(sa.text(
            f"UPDATE {tbl} SET location_id = :loc WHERE location_id != :loc"
        ), {"loc": LOC_ID})

    # ------------------------------------------------------------------
    # 2. Update the canonical workspace_location row
    # ------------------------------------------------------------------
    conn.execute(sa.text("""
        UPDATE workspace_locations
        SET name = 'cOS Test Kitchen',
            slug = 'test-kitchen',
            city = 'Chicago',
            status = 'Stable',
            sales_delta = '+4.2%',
            labor_delta = '-0.8%',
            updated_at = now()
        WHERE id = :loc
    """), {"loc": LOC_ID})

    # Delete the other workspace_locations
    for old in OLD_LOCS:
        conn.execute(sa.text(
            "DELETE FROM workspace_locations WHERE id = :old"
        ), {"old": old})

    # ------------------------------------------------------------------
    # 3. Handle the operational 'locations' table (used by daily_pl etc.)
    # ------------------------------------------------------------------
    # Find operational location IDs that were created for the old ws locs
    op_locs = conn.execute(sa.text(
        "SELECT id, code FROM locations"
    )).fetchall()

    # We keep one operational location; remap others
    keep_op_id = None
    remap_ids = []
    for row in op_locs:
        if keep_op_id is None:
            keep_op_id = row[0]
        else:
            remap_ids.append(row[0])

    if keep_op_id is None:
        # No operational location exists yet -- create one
        keep_op_id = uuid.uuid4()
        conn.execute(sa.text("""
            INSERT INTO locations (id, name, code, address, timezone, created_at, updated_at)
            VALUES (:id, 'cOS Test Kitchen', 'TK', '123 Test Kitchen Ln, Chicago IL 60642',
                    'America/Chicago', now(), now())
        """), {"id": keep_op_id})
    else:
        # Rename the kept one
        conn.execute(sa.text("""
            UPDATE locations
            SET name = 'cOS Test Kitchen',
                code = 'TK',
                address = '123 Test Kitchen Ln, Chicago IL 60642',
                updated_at = now()
            WHERE id = :id
        """), {"id": keep_op_id})

    # Delete data from non-canonical locations (simpler than remapping
    # with unique constraint conflicts on tables like daily_pl)
    op_fk_tables = [
        "invoices", "inventory_counts", "par_levels", "waste_logs",
        "menu_items", "prep_lists", "daily_food_cost", "price_alerts",
        "order_guides", "purchase_orders", "pos_sales", "pos_product_mix",
        "daily_pl", "budget_periods",
    ]
    for tbl in op_fk_tables:
        for old_id in remap_ids:
            conn.execute(sa.text(
                f"DELETE FROM {tbl} WHERE location_id = :old"
            ), {"old": old_id})

    # Delete surplus operational locations
    for old_id in remap_ids:
        conn.execute(sa.text(
            "DELETE FROM locations WHERE id = :old"
        ), {"old": old_id})

    # ------------------------------------------------------------------
    # 4. Clear old workspace seed data and reseed for one small kitchen
    # ------------------------------------------------------------------
    _clear_workspace_data(conn)
    _seed_single_kitchen(conn, keep_op_id)


def _clear_workspace_data(conn) -> None:
    """Remove all existing workspace rows so we can reseed cleanly."""
    tables = [
        "inbox_items", "workspace_orders", "workspace_inventory",
        "workspace_prep", "workspace_food_cost", "workspace_menu",
        "workspace_campaigns", "workspace_invoices",
        # Recipes have cascade deletes so clearing parent is enough
        "recipe_steps", "recipe_component_ingredients",
        "recipe_components", "workspace_recipes",
    ]
    for tbl in tables:
        conn.execute(sa.text(f"DELETE FROM {tbl}"))

    # Clear operational seed data too
    op_tables = [
        "daily_pl", "budget_periods",
    ]
    for tbl in op_tables:
        conn.execute(sa.text(f"DELETE FROM {tbl}"))


def _seed_single_kitchen(conn, op_loc_id) -> None:
    """Seed realistic data for a small 30-seat restaurant."""
    random.seed(42)

    # ---- Inbox ----
    _ins = sa.text("""
        INSERT INTO inbox_items (id, location_id, title, priority, owner, status, module,
            summary, detail_points, prompt, created_at, updated_at)
        VALUES (:id, :loc, :title, :pri, :owner, :status, :module,
            :summary, :dp, :prompt, now(), now())
    """)
    conn.execute(_ins, {
        "id": uuid.uuid4(), "loc": LOC_ID,
        "title": "Tomato prices spiked 18% this week",
        "pri": "High", "owner": "Chef", "status": "Needs review", "module": "food-cost",
        "summary": "Roma tomatoes jumped from $28 to $33/case. Affects bruschetta, pasta sauce, and caprese.",
        "dp": "{\"Vendor price increased 18% week-over-week\",\"Three menu items use Roma tomatoes as a primary ingredient\",\"Coastal Produce has an alternative at $30/case\"}",
        "prompt": "Analyze the tomato price spike and recommend menu adjustments.",
    })
    conn.execute(_ins, {
        "id": uuid.uuid4(), "loc": LOC_ID,
        "title": "Saturday prep list needs approval",
        "pri": "Medium", "owner": "Sous Chef", "status": "Open", "module": "prep",
        "summary": "Weekend prep list is generated but needs chef sign-off before the AM shift starts.",
        "dp": "{\"Prep list covers brunch and dinner service\",\"Two stations still need par counts confirmed\",\"Walk-in inventory was counted this morning\"}",
        "prompt": "Review and approve the Saturday prep list.",
    })

    # ---- Orders ----
    _ins = sa.text("""
        INSERT INTO workspace_orders (id, location_id, vendor, channel, status, total, eta,
            summary, detail_points, prompt, created_at, updated_at)
        VALUES (:id, :loc, :vendor, :channel, :status, :total, :eta,
            :summary, :dp, :prompt, now(), now())
    """)
    conn.execute(_ins, {
        "id": uuid.uuid4(), "loc": LOC_ID,
        "vendor": "Coastal Produce", "channel": "API", "status": "Ready to send",
        "total": "$842", "eta": "Tomorrow, 6:00 AM",
        "summary": "Weekly produce order covering weekend service. Aligned to current pars.",
        "dp": "{\"8 line items below par for weekend service\",\"Includes substitute for high-priced Romas\",\"API channel is active and tested\"}",
        "prompt": "Review and send the Coastal Produce order.",
    })
    conn.execute(_ins, {
        "id": uuid.uuid4(), "loc": LOC_ID,
        "vendor": "Prime Meats", "channel": "Email", "status": "Drafting",
        "total": "$1,180", "eta": "Tomorrow, 7:00 AM",
        "summary": "Protein order for weekend. Short ribs and chicken are the main drivers.",
        "dp": "{\"Short rib demand tied to Saturday dinner reservations\",\"Chicken breast pars adjusted up after last week's sellout\",\"Email is the default vendor channel\"}",
        "prompt": "Finalize the Prime Meats order.",
    })

    # ---- Inventory (15-20 items for a small kitchen) ----
    _ins = sa.text("""
        INSERT INTO workspace_inventory (id, location_id, item_name, on_hand, par, unit, variance,
            summary, detail_points, prompt, created_at, updated_at)
        VALUES (:id, :loc, :item, :oh, :par, :unit, :var,
            :summary, :dp, :prompt, now(), now())
    """)
    inventory_items = [
        # Proteins
        ("Chicken Breast", "12", "20", "lb", "-8", "Below par. Weekend demand expected to spike.",
         "{\"Usage trending up after menu feature\",\"Prime Meats delivery expected tomorrow AM\",\"Consider 86ing if stock drops below 6 lb\"}",
         "Check chicken breast levels and confirm reorder."),
        ("Short Ribs", "18", "24", "lb", "-6", "Short for Saturday dinner service.",
         "{\"Signature dish drives 35% of Saturday protein sales\",\"72-hour sous vide requires advance planning\",\"Reorder already in draft with Prime Meats\"}",
         "Confirm short rib stock against Saturday reservations."),
        ("Salmon Fillet", "8", "10", "lb", "-2", "Slightly below par but manageable.",
         "{\"Consistent seller at lunch and dinner\",\"Next delivery scheduled for Monday\",\"No immediate action needed\"}",
         "Review salmon inventory."),
        ("Ground Beef 80/20", "15", "15", "lb", "0", "At par.",
         "{\"Burger demand is steady\",\"No variance this week\",\"On the Prime Meats standing order\"}",
         "Ground beef is on track."),
        # Produce
        ("Roma Tomatoes", "3", "6", "case", "-3", "Below par. Price spike noted.",
         "{\"Vendor price up 18% this week\",\"Used in bruschetta, pasta sauce, caprese\",\"Coastal Produce has partial substitute at $30/case\"}",
         "Evaluate tomato sourcing options."),
        ("Mixed Greens", "4", "5", "case", "-1", "Slightly below par.",
         "{\"Steady salad demand\",\"Delivery tomorrow will cover gap\",\"Shelf life is 3 days\"}",
         "Mixed greens are fine pending delivery."),
        ("Lemons", "2", "3", "case", "-1", "Below par. Used across bar and kitchen.",
         "{\"Bar uses 40% of lemon stock for cocktails\",\"Kitchen uses rest for dressings and garnish\",\"On the Coastal Produce order\"}",
         "Confirm lemon restock."),
        ("Yellow Onions", "50", "40", "lb", "+10", "Over par after midweek delivery.",
         "{\"French onion soup production draws down fast\",\"No risk of waste at current usage rate\",\"No action needed\"}",
         "Onion stock is healthy."),
        ("Fresh Basil", "6", "8", "bunch", "-2", "Below par for weekend.",
         "{\"Pesto and caprese are the main draws\",\"Quality degrades after 2 days\",\"On the Coastal Produce order\"}",
         "Basil is covered by pending order."),
        # Dairy
        ("Burrata", "4", "6", "tub", "-2", "Below par for appetizer service.",
         "{\"Caprese plate is a top seller\",\"Short shelf life requires just-in-time ordering\",\"Can source locally if vendor is short\"}",
         "Check burrata availability for weekend."),
        ("Heavy Cream", "3", "4", "qt", "-1", "Slightly under par.",
         "{\"Used in soups, sauces, and desserts\",\"Delivery tomorrow\",\"No risk\"}",
         "Heavy cream is fine."),
        ("Butter (unsalted)", "8", "8", "lb", "0", "At par.",
         "{\"Core ingredient across stations\",\"Steady usage\",\"No action needed\"}",
         "Butter is on track."),
        # Dry Goods
        ("Caputo 00 Flour", "40", "50", "lb", "-10", "Below par. Pizza dough production scheduled.",
         "{\"Each batch uses ~2.2 lb flour\",\"Weekend dough production needs 15 lb minimum\",\"Sysco delivery on Monday\"}",
         "Confirm flour is sufficient through weekend."),
        ("Arborio Rice", "10", "8", "lb", "+2", "Over par.",
         "{\"Risotto is a steady dinner seller\",\"No waste risk\",\"No action needed\"}",
         "Rice stock is fine."),
        ("Olive Oil (EVOO)", "2", "3", "gal", "-1", "Below par.",
         "{\"Used across all stations\",\"Sysco has it on standing order\",\"Should last through weekend\"}",
         "Olive oil should hold until Monday delivery."),
        ("Dried Pasta", "12", "10", "lb", "+2", "Over par.",
         "{\"Pappardelle and linguine are the main draws\",\"Long shelf life\",\"No action needed\"}",
         "Pasta stock is healthy."),
    ]
    for item in inventory_items:
        conn.execute(_ins, {
            "id": uuid.uuid4(), "loc": LOC_ID,
            "item": item[0], "oh": item[1], "par": item[2], "unit": item[3], "var": item[4],
            "summary": item[5], "dp": item[6], "prompt": item[7],
        })

    # ---- Prep ----
    _ins = sa.text("""
        INSERT INTO workspace_prep (id, location_id, service_lane, task, station, readiness, shortage,
            summary, detail_points, prompt, created_at, updated_at)
        VALUES (:id, :loc, :lane, :task, :station, :ready, :shortage,
            :summary, :dp, :prompt, now(), now())
    """)
    prep_tasks = [
        ("Brunch", "Portion smoked salmon plates", "Cold line", "Ready", None,
         "Station has full mise and staffing for brunch service.",
         "{\"Salmon stock is sufficient\",\"Garnish kits prepped last night\",\"No blockers\"}",
         "Confirm brunch cold line readiness."),
        ("Brunch", "Batch hollandaise", "Sauce station", "Ready", None,
         "Eggs and butter are on hand. Lemon juice measured.",
         "{\"Yields 24 portions\",\"Hold at 63C in bain-marie\",\"Prep time: 20 min\"}",
         "Hollandaise is ready to fire."),
        ("Dinner", "Sear short ribs (from sous vide)", "Hot line", "At risk", "Short ribs below par",
         "Sous vide bags are ready but stock is below Saturday par.",
         "{\"18 lb on hand vs 24 lb par\",\"Reorder in draft with Prime Meats\",\"May need to 86 after first seating if delivery misses\"}",
         "Monitor short rib stock through Saturday service."),
        ("Dinner", "Prep pizza dough (4 batches)", "Prep station", "Ready", None,
         "All ingredients on hand. Cold ferment starts at 2 PM.",
         "{\"Each batch yields 4 dough balls\",\"16 total for Saturday dinner\",\"24-hour cold ferment\"}",
         "Pizza dough prep is on schedule."),
        ("Dinner", "Caramelize onions for French onion soup", "Prep station", "Ready", None,
         "Onions sliced and staged. Dutch oven is available.",
         "{\"3 kg onions yields 8 portions\",\"90-minute cook time\",\"Start by 1 PM for dinner service\"}",
         "French onion soup prep is on schedule."),
        ("All day", "Restock mise en place bins", "All stations", "In progress", None,
         "AM team is restocking. Should complete by 10:30 AM.",
         "{\"Cold line is done\",\"Hot line needs herb oil and compound butter\",\"ETA 30 minutes\"}",
         "Mise restock is in progress."),
    ]
    for task in prep_tasks:
        conn.execute(_ins, {
            "id": uuid.uuid4(), "loc": LOC_ID,
            "lane": task[0], "task": task[1], "station": task[2], "ready": task[3],
            "shortage": task[4], "summary": task[5], "dp": task[6], "prompt": task[7],
        })

    # ---- Food Cost ----
    _ins = sa.text("""
        INSERT INTO workspace_food_cost (id, location_id, menu_item_name, pressure, current_cost_pct,
            action, summary, detail_points, prompt, created_at, updated_at)
        VALUES (:id, :loc, :item, :pressure, :cost, :action,
            :summary, :dp, :prompt, now(), now())
    """)
    food_cost_items = [
        ("Bruschetta", "+2.1 pts", "33.4%", "Reprice or reduce portion",
         "Tomato price spike is compressing margin on a high-volume appetizer.",
         "{\"Roma tomato cost up 18% this week\",\"Item sells 40+ covers per day\",\"A $1 price increase would restore margin\"}",
         "Analyze bruschetta food cost and recommend action."),
        ("Short Rib Pappardelle", "+1.4 pts", "32.8%", "Tighten prep yield",
         "Protein yield variance is slightly above target. Vendor price is stable.",
         "{\"Trim waste is 8% vs 5% target\",\"Retrain on portioning could recover 1.5 pts\",\"No vendor price change\"}",
         "Review short rib yield at the prep station."),
        ("Margherita Pizza", "-0.3 pts", "24.1%", "No action needed",
         "Below target food cost. Strong margin performer.",
         "{\"Flour and cheese costs are stable\",\"High volume keeps per-unit cost low\",\"Consider featuring more prominently\"}",
         "Pizza margins are healthy."),
        ("Grilled Salmon", "+0.8 pts", "31.2%", "Monitor",
         "Slight uptick in salmon cost. Within tolerance for now.",
         "{\"Salmon price up 3% this month\",\"Still within the 32% target\",\"Revisit if trend continues\"}",
         "Monitor salmon cost trend."),
    ]
    for fc in food_cost_items:
        conn.execute(_ins, {
            "id": uuid.uuid4(), "loc": LOC_ID,
            "item": fc[0], "pressure": fc[1], "cost": fc[2], "action": fc[3],
            "summary": fc[4], "dp": fc[5], "prompt": fc[6],
        })

    # ---- Menu (10-15 items) ----
    _ins = sa.text("""
        INSERT INTO workspace_menu (id, location_id, item_name, category, performance, margin_pct,
            recommendation, summary, detail_points, prompt, created_at, updated_at)
        VALUES (:id, :loc, :item, :cat, :perf, :margin, :rec,
            :summary, :dp, :prompt, now(), now())
    """)
    menu_items = [
        ("Bruschetta", "Appetizer", "Star", "66%", "Feature prominently",
         "High volume, good margin. A reliable starter.",
         "{\"Sells 40+ per day\",\"Margin under pressure from tomato costs\",\"Still a star despite cost uptick\"}",
         "How can we protect bruschetta margins?"),
        ("Burrata Caprese", "Appetizer", "Puzzle", "70%", "Rename and reposition",
         "Great margin but underselling relative to quality.",
         "{\"Guest reviews are very positive\",\"Menu placement is below the fold\",\"A rename could lift orders 15%\"}",
         "Suggest a repositioning strategy for the caprese."),
        ("French Onion Soup", "Appetizer", "Star", "74%", "Keep as anchor",
         "Consistently strong seller with excellent margin.",
         "{\"Low ingredient cost with high perceived value\",\"Comfort food drives repeat visits\",\"No changes recommended\"}",
         "French onion soup is performing well."),
        ("Margherita Pizza", "Entree", "Star", "76%", "Feature more",
         "Best margin on the menu. Volume is already strong.",
         "{\"Flour and mozzarella costs are stable\",\"Dough production is well-calibrated\",\"Add a lunch special to drive more volume\"}",
         "How can we sell more Margherita pizza?"),
        ("Short Rib Pappardelle", "Entree", "Star", "67%", "Monitor food cost",
         "Signature dish with strong demand. Margin is tightening.",
         "{\"Protein yield is the main cost driver\",\"Guest demand is very high\",\"Prep yield retrain recommended\"}",
         "Monitor short rib pappardelle margins."),
        ("Grilled Salmon", "Entree", "Plowhorse", "69%", "Lift price carefully",
         "Steady seller but margin is thinning with salmon cost increases.",
         "{\"Consistent 20+ covers per day\",\"Salmon cost trending up 3%/month\",\"A $2 lift would restore target margin\"}",
         "Recommend a pricing strategy for grilled salmon."),
        ("Chicken Milanese", "Entree", "Star", "72%", "Keep as workhorse",
         "Reliable, well-margined entree that appeals broadly.",
         "{\"Low food cost with high perceived value\",\"Consistent demand across lunch and dinner\",\"No changes needed\"}",
         "Chicken Milanese is a strong performer."),
        ("Risotto of the Day", "Entree", "Puzzle", "71%", "Improve visibility",
         "Good margin but guests don't notice it on the menu.",
         "{\"Rotating preparation keeps kitchen engaged\",\"Server upsell could drive orders\",\"Consider a table tent or verbal feature\"}",
         "How do we sell more risotto?"),
        ("House Burger", "Entree", "Plowhorse", "65%", "Bundle with fries",
         "High volume, decent margin. Could improve with bundling.",
         "{\"Reliable lunch seller\",\"Fry attachment rate is only 40%\",\"A combo price could lift check average\"}",
         "Explore burger combo pricing."),
        ("Tiramisu", "Dessert", "Star", "78%", "Feature on dessert card",
         "Highest margin dessert. Made in-house daily.",
         "{\"Low ingredient cost\",\"Prep is batch-efficient\",\"Server push could increase attachment rate\"}",
         "Feature tiramisu more prominently."),
        ("Lemon Tart", "Dessert", "Puzzle", "75%", "Improve plating",
         "Good margin, but visual appeal could be stronger.",
         "{\"Uses lemon curd sub-recipe\",\"Plating refresh could improve orders\",\"Consider adding a seasonal garnish\"}",
         "Refresh the lemon tart presentation."),
        ("Espresso", "Beverage", "Star", "88%", "Upsell after dinner",
         "Exceptional margin. Under-ordered at dinner.",
         "{\"Cost per cup is $0.35\",\"Dinner attachment rate is only 12%\",\"Server prompt could double orders\"}",
         "Increase espresso attachment rate at dinner."),
    ]
    for mi in menu_items:
        conn.execute(_ins, {
            "id": uuid.uuid4(), "loc": LOC_ID,
            "item": mi[0], "cat": mi[1], "perf": mi[2], "margin": mi[3], "rec": mi[4],
            "summary": mi[5], "dp": mi[6], "prompt": mi[7],
        })

    # ---- Campaigns ----
    _ins = sa.text("""
        INSERT INTO workspace_campaigns (id, location_id, campaign_name, channel, stage, deliverable,
            summary, detail_points, prompt, created_at, updated_at)
        VALUES (:id, :loc, :name, :channel, :stage, :deliv,
            :summary, :dp, :prompt, now(), now())
    """)
    conn.execute(_ins, {
        "id": uuid.uuid4(), "loc": LOC_ID,
        "name": "Weekend brunch feature", "channel": "Instagram + email",
        "stage": "Drafting", "deliv": "Social post + email blast",
        "summary": "Promote the new seasonal brunch menu to drive weekend reservations.",
        "dp": "{\"Feature the smoked salmon plate and new pastry items\",\"Target existing guests with email, new guests with social\",\"Goal: 15% lift in Saturday brunch covers\"}",
        "prompt": "Draft the weekend brunch campaign.",
    })
    conn.execute(_ins, {
        "id": uuid.uuid4(), "loc": LOC_ID,
        "name": "Happy hour launch", "channel": "Local social + in-house signage",
        "stage": "Research", "deliv": "Competitor scan",
        "summary": "Testing a 4-6 PM happy hour with bar bites and discounted drinks.",
        "dp": "{\"Three nearby restaurants run happy hour programs\",\"Bar margin supports a 20% discount on well drinks\",\"Bar bites keep food cost under 25%\"}",
        "prompt": "Research competitor happy hour programs and draft our offering.",
    })

    # ---- Invoices ----
    _ins = sa.text("""
        INSERT INTO workspace_invoices (id, location_id, vendor_name, invoice_number, invoice_date,
            due_date, status, total, line_items, gl_codes, source,
            summary, detail_points, prompt, created_at, updated_at)
        VALUES (:id, :loc, :vendor, :inv_num, :inv_date, :due, :status, :total,
            :lines, :gl, :source, :summary, :dp, :prompt, now(), now())
    """)
    conn.execute(_ins, {
        "id": uuid.uuid4(), "loc": LOC_ID,
        "vendor": "Coastal Produce", "inv_num": "CP-2026-4417",
        "inv_date": "2026-03-19", "due": "2026-04-18",
        "status": "Matched", "total": "$842.00",
        "lines": '[{"description":"Roma Tomatoes (case)","qty":4,"unit_price":33.00,"total":132.00,"gl_code":"5010"},{"description":"Mixed Greens (case)","qty":5,"unit_price":34.00,"total":170.00,"gl_code":"5010"},{"description":"Fresh Basil (bunch)","qty":8,"unit_price":3.75,"total":30.00,"gl_code":"5010"},{"description":"Lemons (case)","qty":3,"unit_price":22.50,"total":67.50,"gl_code":"5010"},{"description":"Seasonal Berries (flat)","qty":4,"unit_price":48.00,"total":192.00,"gl_code":"5010"},{"description":"Burrata (tub)","qty":6,"unit_price":18.00,"total":108.00,"gl_code":"5010"},{"description":"Yellow Onions (50lb bag)","qty":1,"unit_price":28.00,"total":28.00,"gl_code":"5010"},{"description":"Delivery","qty":1,"unit_price":15.00,"total":15.00,"gl_code":"5090"}]',
        "gl": '[{"code":"5010","name":"Food - Produce","total":727.50},{"code":"5090","name":"Food - Delivery","total":15.00}]',
        "source": "upload",
        "summary": "Weekly produce invoice matched to PO. Tomato price variance flagged.",
        "dp": "{\"8 line items matched to PO\",\"Roma tomato price +18% vs PO estimate\",\"All other items within 2% tolerance\",\"GL auto-categorized to Food-Produce\"}",
        "prompt": "Review the Coastal Produce invoice and the tomato price variance.",
    })
    conn.execute(_ins, {
        "id": uuid.uuid4(), "loc": LOC_ID,
        "vendor": "Prime Meats", "inv_num": "PM-88921",
        "inv_date": "2026-03-18", "due": "2026-04-01",
        "status": "Approved", "total": "$1,180.00",
        "lines": '[{"description":"Short Ribs Bone-In (case)","qty":3,"unit_price":185.00,"total":555.00,"gl_code":"5020"},{"description":"Chicken Breast (case)","qty":3,"unit_price":72.00,"total":216.00,"gl_code":"5020"},{"description":"Ground Beef 80/20 (case)","qty":2,"unit_price":128.00,"total":256.00,"gl_code":"5020"},{"description":"Salmon Fillet (case)","qty":1,"unit_price":153.00,"total":153.00,"gl_code":"5020"}]',
        "gl": '[{"code":"5020","name":"Food - Protein","total":1180.00}]',
        "source": "upload",
        "summary": "Protein invoice approved. All items matched PO within tolerance.",
        "dp": "{\"4 line items matched to PO\",\"All prices within 1% of estimates\",\"Approved by Chef on 2026-03-19\",\"Net 14 payment terms\"}",
        "prompt": "Show details of the Prime Meats invoice.",
    })
    conn.execute(_ins, {
        "id": uuid.uuid4(), "loc": LOC_ID,
        "vendor": "Sysco", "inv_num": "SYS-2026-77201",
        "inv_date": "2026-03-17", "due": "2026-04-16",
        "status": "Paid", "total": "$624.00",
        "lines": '[{"description":"Caputo 00 Flour (50lb bag)","qty":2,"unit_price":45.00,"total":90.00,"gl_code":"5010"},{"description":"Arborio Rice (25lb bag)","qty":1,"unit_price":38.00,"total":38.00,"gl_code":"5010"},{"description":"Olive Oil EVOO (gal)","qty":3,"unit_price":42.00,"total":126.00,"gl_code":"5010"},{"description":"Dried Pasta Assorted (case)","qty":2,"unit_price":52.00,"total":104.00,"gl_code":"5010"},{"description":"Heavy Cream (qt, 12pk)","qty":1,"unit_price":68.00,"total":68.00,"gl_code":"5010"},{"description":"Butter Unsalted (case)","qty":2,"unit_price":72.00,"total":144.00,"gl_code":"5010"},{"description":"Sugar, Salt, Misc (mixed)","qty":1,"unit_price":54.00,"total":54.00,"gl_code":"5010"}]',
        "gl": '[{"code":"5010","name":"Food - Dry Goods / Dairy","total":624.00}]',
        "source": "upload",
        "summary": "Weekly dry goods and dairy delivery. Fully processed and paid.",
        "dp": "{\"7 line items, all matched\",\"Payment processed on 2026-03-20 via ACH\",\"GL coded to Food - Dry Goods / Dairy\",\"No variances\"}",
        "prompt": "Show the Sysco invoice details.",
    })

    # ---- Recipes (keep existing from migration 004, just update location_id) ----
    # Already handled by the FK update above. The 5 recipes from 004 are all now on LOC_ID.

    # ---- Daily P&L (reseed for single location, 30 days) ----
    today = date(2026, 3, 21)
    prev_ending_inv = Decimal("6200")

    for day_offset in range(30, 0, -1):
        pl_date = today - timedelta(days=day_offset)
        dow = pl_date.weekday()

        # Small restaurant: ~$4k-6k daily revenue, weekends higher
        weekend_mult = 1.40 if dow in (4, 5) else (1.20 if dow == 6 else 1.0)
        base_revenue = 4800

        revenue = Decimal(str(round(
            base_revenue * weekend_mult + random.uniform(-600, 600), 2
        )))
        beginning_inv = prev_ending_inv
        purchases = Decimal(str(round(1800 + random.uniform(-200, 200), 2)))
        usage_rate = random.uniform(0.88, 0.96)
        ending_inv = Decimal(str(round(
            float(beginning_inv) + float(purchases) - float(purchases) * usage_rate - random.uniform(50, 200), 2
        )))
        ending_inv = max(ending_inv, Decimal("1500"))

        cogs = beginning_inv + purchases - ending_inv
        food_cost_pct = (cogs / revenue * 100).quantize(Decimal("0.01")) if revenue > 0 else Decimal("0")

        labor = Decimal(str(round(
            1400 * weekend_mult + random.uniform(-150, 150), 2
        )))
        labor_pct = (labor / revenue * 100).quantize(Decimal("0.01")) if revenue > 0 else Decimal("0")

        notes = None
        if food_cost_pct > Decimal("33"):
            notes = "Food cost above 33% target"
        elif dow == 0:
            notes = "Monday -- typically slower"

        conn.execute(sa.text("""
            INSERT INTO daily_pl (id, location_id, pl_date, beginning_inventory, purchases,
                ending_inventory, cogs, revenue, food_cost_pct, labor_cost, labor_pct, notes,
                created_at, updated_at)
            VALUES (:id, :loc, :dt, :bi, :pur, :ei, :cogs, :rev, :fcp, :lab, :lp, :notes, now(), now())
        """), {
            "id": uuid.uuid4(), "loc": op_loc_id, "dt": pl_date,
            "bi": beginning_inv, "pur": purchases, "ei": ending_inv,
            "cogs": cogs, "rev": revenue, "fcp": food_cost_pct,
            "lab": labor, "lp": labor_pct, "notes": notes,
        })

        prev_ending_inv = ending_inv

    # Budget target for current month
    conn.execute(sa.text("""
        INSERT INTO budget_periods (id, location_id, period_start, period_end,
            target_food_cost_pct, target_labor_pct, target_revenue, created_at, updated_at)
        VALUES (:id, :loc, :ps, :pe, :fcp, :lp, :rev, now(), now())
    """), {
        "id": uuid.uuid4(), "loc": op_loc_id,
        "ps": date(2026, 3, 1), "pe": date(2026, 3, 31),
        "fcp": 30.0, "lp": 28.0, "rev": 150000,
    })


def downgrade() -> None:
    # Downgrade is impractical for a data migration like this.
    # The forward migration is destructive to multi-location data.
    pass
