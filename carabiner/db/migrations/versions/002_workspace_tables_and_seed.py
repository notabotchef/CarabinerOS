"""Add workspace tables and seed data from carabiner-store.js.

Revision ID: 002
Revises: 001
"""

import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None

# Fixed UUIDs for seed data (deterministic for testing)
ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
LOC_RIVER_NORTH = uuid.UUID("00000000-0000-0000-0001-000000000001")
LOC_WEST_LOOP = uuid.UUID("00000000-0000-0000-0001-000000000002")
LOC_FULTON_MARKET = uuid.UUID("00000000-0000-0000-0001-000000000003")


def upgrade() -> None:
    # --- Create workspace tables ---

    op.create_table(
        "organizations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(100), unique=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "workspace_locations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("slug", sa.String(100), unique=True, nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="Stable"),
        sa.Column("sales_delta", sa.String(20)),
        sa.Column("labor_delta", sa.String(20)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    for table_name, columns in [
        ("inbox_items", [
            sa.Column("title", sa.String(300), nullable=False),
            sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
            sa.Column("owner", sa.String(100)),
            sa.Column("status", sa.String(100), nullable=False, server_default="Open"),
            sa.Column("module", sa.String(50), nullable=False, server_default="inbox"),
        ]),
        ("workspace_orders", [
            sa.Column("vendor", sa.String(200), nullable=False),
            sa.Column("channel", sa.String(50), nullable=False),
            sa.Column("status", sa.String(50), nullable=False, server_default="Drafting"),
            sa.Column("total", sa.String(50), nullable=False),
            sa.Column("eta", sa.String(100)),
            sa.Column("line_items", JSONB, server_default="[]"),
        ]),
        ("workspace_inventory", [
            sa.Column("item_name", sa.String(200), nullable=False),
            sa.Column("on_hand", sa.String(50), nullable=False),
            sa.Column("par", sa.String(50), nullable=False),
            sa.Column("variance", sa.String(20), nullable=False),
        ]),
        ("workspace_prep", [
            sa.Column("service_lane", sa.String(50), nullable=False),
            sa.Column("task", sa.String(200), nullable=False),
            sa.Column("station", sa.String(100), nullable=False),
            sa.Column("readiness", sa.String(50), nullable=False, server_default="Ready"),
            sa.Column("shortage", sa.String(200)),
        ]),
        ("workspace_food_cost", [
            sa.Column("menu_item_name", sa.String(200), nullable=False),
            sa.Column("pressure", sa.String(30), nullable=False),
            sa.Column("current_cost_pct", sa.String(20), nullable=False),
            sa.Column("action", sa.String(200), nullable=False),
        ]),
        ("workspace_menu", [
            sa.Column("item_name", sa.String(200), nullable=False),
            sa.Column("category", sa.String(100), nullable=False),
            sa.Column("performance", sa.String(50), nullable=False),
            sa.Column("margin_pct", sa.String(20), nullable=False),
            sa.Column("recommendation", sa.String(200), nullable=False),
            sa.Column("recipe", JSONB),
        ]),
        ("workspace_campaigns", [
            sa.Column("campaign_name", sa.String(200), nullable=False),
            sa.Column("channel", sa.String(100), nullable=False),
            sa.Column("stage", sa.String(50), nullable=False, server_default="Drafting"),
            sa.Column("deliverable", sa.String(200), nullable=False),
        ]),
    ]:
        op.create_table(
            table_name,
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("location_id", UUID(as_uuid=True),
                       sa.ForeignKey("workspace_locations.id", ondelete="CASCADE"),
                       nullable=False, index=True),
            *columns,
            sa.Column("summary", sa.Text),
            sa.Column("detail_points", ARRAY(sa.Text), server_default="{}"),
            sa.Column("prompt", sa.Text),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    op.create_table(
        "action_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="SET NULL")),
        sa.Column("location_id", UUID(as_uuid=True), sa.ForeignKey("workspace_locations.id", ondelete="SET NULL")),
        sa.Column("provider_id", sa.String(100)),
        sa.Column("action_type", sa.String(100), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("agent_context_id", sa.String(200)),
        sa.Column("metadata", JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- Seed data ---
    _seed_data()


def _seed_data() -> None:
    """Insert seed data ported from carabiner-store.js."""

    org_table = sa.table("organizations",
        sa.column("id", UUID), sa.column("name", sa.String), sa.column("slug", sa.String))
    op.bulk_insert(org_table, [
        {"id": ORG_ID, "name": "Carabiner Restaurant Group", "slug": "carabiner"},
    ])

    loc_table = sa.table("workspace_locations",
        sa.column("id", UUID), sa.column("org_id", UUID), sa.column("slug", sa.String),
        sa.column("name", sa.String), sa.column("city", sa.String),
        sa.column("status", sa.String), sa.column("sales_delta", sa.String),
        sa.column("labor_delta", sa.String))
    op.bulk_insert(loc_table, [
        {"id": LOC_RIVER_NORTH, "org_id": ORG_ID, "slug": "river-north", "name": "River North",
         "city": "Chicago", "status": "Stable", "sales_delta": "+7.2%", "labor_delta": "-1.3%"},
        {"id": LOC_WEST_LOOP, "org_id": ORG_ID, "slug": "west-loop", "name": "West Loop",
         "city": "Chicago", "status": "Attention", "sales_delta": "+2.4%", "labor_delta": "+4.9%"},
        {"id": LOC_FULTON_MARKET, "org_id": ORG_ID, "slug": "fulton-market", "name": "Fulton Market",
         "city": "Chicago", "status": "Launch week", "sales_delta": "+12.1%", "labor_delta": "+2.0%"},
    ])

    # Inbox
    inbox = sa.table("inbox_items",
        sa.column("id", UUID), sa.column("location_id", UUID), sa.column("title", sa.String),
        sa.column("priority", sa.String), sa.column("owner", sa.String),
        sa.column("status", sa.String), sa.column("module", sa.String),
        sa.column("summary", sa.Text), sa.column("detail_points", ARRAY(sa.Text)),
        sa.column("prompt", sa.Text))
    op.bulk_insert(inbox, [
        {"id": uuid.uuid4(), "location_id": LOC_RIVER_NORTH,
         "title": "Avocado cost spike requires menu action", "priority": "High",
         "owner": "Chef Ana", "status": "Needs review", "module": "food-cost",
         "summary": "Hass avocados are 14% above target and the lunch menu is absorbing the variance.",
         "detail_points": ["Current variance is 14% above target food cost.",
                           "Impact is concentrated on brunch and lunch volume.",
                           "Two alternative produce vendors are available for comparison."],
         "prompt": "Analyze avocado cost spike at River North and recommend menu actions."},
        {"id": uuid.uuid4(), "location_id": LOC_WEST_LOOP,
         "title": "Bakery cutoff is approaching", "priority": "Medium",
         "owner": "Ops Lead", "status": "Order due by 4 PM", "module": "orders",
         "summary": "West Loop still needs tomorrow's pastry order approved before the daily cutoff.",
         "detail_points": ["Morning pastry sell-through is running ahead of forecast.",
                           "Croissant and brioche par levels were both missed yesterday.",
                           "Preferred execution channel is email unless API is available."],
         "prompt": "Build the bakery order for West Loop before the 4 PM cutoff."},
        {"id": uuid.uuid4(), "location_id": LOC_FULTON_MARKET,
         "title": "Brunch prep counts are incomplete", "priority": "Medium",
         "owner": "Sous Chef", "status": "Awaiting counts", "module": "prep",
         "summary": "The Fulton Market brunch prep board is missing station counts for cold line and pastry.",
         "detail_points": ["Cold line and pastry counts are missing from this morning's update.",
                           "Launch-week demand is still trending above the opening forecast.",
                           "The team needs a provisional prep plan before 8 AM."],
         "prompt": "Generate a provisional brunch prep plan for Fulton Market."},
    ])

    # Orders
    orders = sa.table("workspace_orders",
        sa.column("id", UUID), sa.column("location_id", UUID), sa.column("vendor", sa.String),
        sa.column("channel", sa.String), sa.column("status", sa.String),
        sa.column("total", sa.String), sa.column("eta", sa.String),
        sa.column("summary", sa.Text), sa.column("detail_points", ARRAY(sa.Text)),
        sa.column("prompt", sa.Text))
    op.bulk_insert(orders, [
        {"id": uuid.uuid4(), "location_id": LOC_RIVER_NORTH,
         "vendor": "Coastal Produce", "channel": "API", "status": "Ready to send",
         "total": "$1,284", "eta": "Today, 4:30 PM",
         "summary": "Produce replenishment aligned to weekend volume and current on-hand counts.",
         "detail_points": ["12 line items are below par for dinner service.",
                           "Tomatoes and basil both include approved substitutes.",
                           "Execution channel is API with demo mode currently active."],
         "prompt": "Review and send the Coastal Produce order for River North."},
        {"id": uuid.uuid4(), "location_id": LOC_WEST_LOOP,
         "vendor": "Prime Meats", "channel": "Browser fallback", "status": "Drafting",
         "total": "$2,046", "eta": "Tomorrow, 6:00 AM",
         "summary": "Protein order is waiting on final trim quantities and short-rib demand check.",
         "detail_points": ["Burger trim is the main driver of the draft total.",
                           "Short-rib demand is tied to Friday dinner reservations.",
                           "No direct API is configured, so browser automation is the fallback path."],
         "prompt": "Finalize the Prime Meats order for West Loop."},
        {"id": uuid.uuid4(), "location_id": LOC_FULTON_MARKET,
         "vendor": "Lakefront Seafood", "channel": "Email", "status": "Awaiting approval",
         "total": "$1,612", "eta": "Tomorrow, 9:00 AM",
         "summary": "Seafood replenishment is drafted with launch-week buffers still enabled.",
         "detail_points": ["Shrimp and scallops include launch-week buffer quantities.",
                           "Email is the default vendor channel.",
                           "Service demand is still stabilizing after launch."],
         "prompt": "Review the Lakefront Seafood order for Fulton Market."},
    ])

    # Inventory
    inv = sa.table("workspace_inventory",
        sa.column("id", UUID), sa.column("location_id", UUID), sa.column("item_name", sa.String),
        sa.column("on_hand", sa.String), sa.column("par", sa.String),
        sa.column("variance", sa.String),
        sa.column("summary", sa.Text), sa.column("detail_points", ARRAY(sa.Text)),
        sa.column("prompt", sa.Text))
    op.bulk_insert(inv, [
        {"id": uuid.uuid4(), "location_id": LOC_RIVER_NORTH,
         "item_name": "Avocados", "on_hand": "18 case", "par": "24 case", "variance": "-6",
         "summary": "Below par ahead of lunch and dinner service.",
         "detail_points": ["Usage velocity increased after the brunch feature launch.",
                           "Two locations have spare stock that could be reallocated.",
                           "Vendor replacement ETA is still within same-day service."],
         "prompt": "Check avocado inventory at River North and recommend replenishment."},
        {"id": uuid.uuid4(), "location_id": LOC_WEST_LOOP,
         "item_name": "Chicken stock", "on_hand": "11 qt", "par": "8 qt", "variance": "+3",
         "summary": "Over par after prep and invoice reconciliation.",
         "detail_points": ["Excess is tied to lower-than-forecast soup sales.",
                           "Prep can use some volume for braise and sauce production.",
                           "No immediate repurchase is needed."],
         "prompt": "Review chicken stock levels at West Loop."},
        {"id": uuid.uuid4(), "location_id": LOC_FULTON_MARKET,
         "item_name": "Burrata", "on_hand": "6 tub", "par": "10 tub", "variance": "-4",
         "summary": "At-risk SKU for launch-week appetizer volume.",
         "detail_points": ["The appetizer mix is outpacing the initial forecast.",
                           "River North has excess burrata available for transfer.",
                           "Seafood vendor drop-off window closes at 2 PM."],
         "prompt": "Check burrata availability across locations and arrange transfer if needed."},
    ])

    # Prep
    prep = sa.table("workspace_prep",
        sa.column("id", UUID), sa.column("location_id", UUID),
        sa.column("service_lane", sa.String), sa.column("task", sa.String),
        sa.column("station", sa.String), sa.column("readiness", sa.String),
        sa.column("shortage", sa.String),
        sa.column("summary", sa.Text), sa.column("detail_points", ARRAY(sa.Text)),
        sa.column("prompt", sa.Text))
    op.bulk_insert(prep, [
        {"id": uuid.uuid4(), "location_id": LOC_RIVER_NORTH,
         "service_lane": "Brunch", "task": "Portion smoked salmon", "station": "Cold line",
         "readiness": "At risk", "shortage": "Cream cheese low",
         "summary": "Station can prep immediately, but one garnish component is trending short.",
         "detail_points": ["Cold line has staffing coverage for the full prep window.",
                           "Cream cheese is the only blocking component right now.",
                           "Reservation pace is 8% above last Sunday."],
         "prompt": "Check cream cheese availability and adjust brunch prep plan for River North."},
        {"id": uuid.uuid4(), "location_id": LOC_WEST_LOOP,
         "service_lane": "Dinner", "task": "Batch short-rib glaze", "station": "Hot line",
         "readiness": "Ready", "shortage": "No shortage",
         "summary": "All ingredients are on hand and the prep window is clear.",
         "detail_points": ["Protein thawing is already complete.",
                           "Sauce volume is calibrated to current reservation pace.",
                           "No inventory blockers are present."],
         "prompt": "Confirm dinner prep readiness at West Loop."},
        {"id": uuid.uuid4(), "location_id": LOC_FULTON_MARKET,
         "service_lane": "Happy hour", "task": "Build oyster garnish kits", "station": "Raw bar",
         "readiness": "Blocked", "shortage": "Limes below par",
         "summary": "Prep is paused until citrus is reallocated or replenished.",
         "detail_points": ["Raw bar prep cannot finish without citrus garnish kits.",
                           "West Loop has temporary transfer capacity.",
                           "The top-up order would arrive after first seating."],
         "prompt": "Resolve lime shortage for Fulton Market happy hour prep."},
    ])

    # Food Cost
    fc = sa.table("workspace_food_cost",
        sa.column("id", UUID), sa.column("location_id", UUID),
        sa.column("menu_item_name", sa.String), sa.column("pressure", sa.String),
        sa.column("current_cost_pct", sa.String), sa.column("action", sa.String),
        sa.column("summary", sa.Text), sa.column("detail_points", ARRAY(sa.Text)),
        sa.column("prompt", sa.Text))
    op.bulk_insert(fc, [
        {"id": uuid.uuid4(), "location_id": LOC_RIVER_NORTH,
         "menu_item_name": "Avocado Toast", "pressure": "+2.8 pts", "current_cost_pct": "34.1%",
         "action": "Reprice or source swap",
         "summary": "Produce inflation is compressing margin on a top-volume brunch item.",
         "detail_points": ["Guest demand remains strong despite the cost increase.",
                           "Portioning and menu price are the fastest levers.",
                           "Alternative vendor pricing is available for comparison."],
         "prompt": "Analyze food cost pressure on Avocado Toast at River North."},
        {"id": uuid.uuid4(), "location_id": LOC_WEST_LOOP,
         "menu_item_name": "Short Rib Pappardelle", "pressure": "+1.2 pts",
         "current_cost_pct": "31.6%", "action": "Tighten prep yield",
         "summary": "Protein yield variance is driving cost more than vendor pricing this week.",
         "detail_points": ["Yield tracking is below the standard recipe target.",
                           "Vendor pricing is stable week-over-week.",
                           "A prep retrain may recover the margin without repricing."],
         "prompt": "Review short rib yield variance at West Loop."},
        {"id": uuid.uuid4(), "location_id": LOC_FULTON_MARKET,
         "menu_item_name": "Oyster Board", "pressure": "+3.4 pts",
         "current_cost_pct": "39.8%", "action": "Rebuild mix and price",
         "summary": "Launch-week promotional pricing is no longer protecting contribution margin.",
         "detail_points": ["Promotional pricing is still in effect from launch week.",
                           "Attachment rate is strong enough to support a modest price move.",
                           "Garnish and sauce costs are also rising."],
         "prompt": "Rebuild pricing for the Oyster Board at Fulton Market."},
    ])

    # Menu
    menu = sa.table("workspace_menu",
        sa.column("id", UUID), sa.column("location_id", UUID),
        sa.column("item_name", sa.String), sa.column("category", sa.String),
        sa.column("performance", sa.String), sa.column("margin_pct", sa.String),
        sa.column("recommendation", sa.String),
        sa.column("summary", sa.Text), sa.column("detail_points", ARRAY(sa.Text)),
        sa.column("prompt", sa.Text))
    op.bulk_insert(menu, [
        {"id": uuid.uuid4(), "location_id": LOC_RIVER_NORTH,
         "item_name": "Hot Honey Chicken Sandwich", "category": "Lunch",
         "performance": "Star", "margin_pct": "72%",
         "recommendation": "Feature more prominently",
         "summary": "High contribution margin and strong sales velocity make this a placement priority.",
         "detail_points": ["The item is outperforming the category average on both volume and margin.",
                           "Placement changes could increase attachment further.",
                           "No ingredient inflation risk is affecting this item right now."],
         "prompt": "How can we feature the Hot Honey Chicken Sandwich more prominently?"},
        {"id": uuid.uuid4(), "location_id": LOC_WEST_LOOP,
         "item_name": "Citrus Burrata", "category": "Dinner",
         "performance": "Puzzle", "margin_pct": "69%",
         "recommendation": "Rename and reposition",
         "summary": "Strong margin, but ordering rate is lagging relative to guest sentiment.",
         "detail_points": ["Guest reviews are positive but item selection remains soft.",
                           "The current title may under-sell the dish.",
                           "Visual hierarchy on the menu is weak."],
         "prompt": "Suggest a rename and repositioning strategy for the Citrus Burrata."},
        {"id": uuid.uuid4(), "location_id": LOC_FULTON_MARKET,
         "item_name": "Lobster Roll", "category": "Happy hour",
         "performance": "Plowhorse", "margin_pct": "48%",
         "recommendation": "Lift price carefully",
         "summary": "It sells consistently, but margin is thin for the volume it carries.",
         "detail_points": ["This item anchors happy-hour traffic.",
                           "Food cost has moved more quickly than menu price.",
                           "A small price lift may be absorbed if framed correctly."],
         "prompt": "Recommend a pricing strategy for the Lobster Roll at Fulton Market."},
    ])

    # Campaigns (Marketing)
    camp = sa.table("workspace_campaigns",
        sa.column("id", UUID), sa.column("location_id", UUID),
        sa.column("campaign_name", sa.String), sa.column("channel", sa.String),
        sa.column("stage", sa.String), sa.column("deliverable", sa.String),
        sa.column("summary", sa.Text), sa.column("detail_points", ARRAY(sa.Text)),
        sa.column("prompt", sa.Text))
    op.bulk_insert(camp, [
        {"id": uuid.uuid4(), "location_id": LOC_RIVER_NORTH,
         "campaign_name": "Weekend brunch reset", "channel": "Email + local social",
         "stage": "Drafting", "deliverable": "Audience brief",
         "summary": "A brunch campaign concept focused on line-skipping reservations and new seasonal dishes.",
         "detail_points": ["The campaign should emphasize seasonal menu updates.",
                           "Reservation conversion is the main KPI.",
                           "Email and local social are the initial channels."],
         "prompt": "Draft a brunch campaign brief for River North."},
        {"id": uuid.uuid4(), "location_id": LOC_WEST_LOOP,
         "campaign_name": "Patio happy hour", "channel": "Organic social + creator outreach",
         "stage": "Research", "deliverable": "Competitor scan",
         "summary": "Need localized positioning before finalizing launch messaging for patio season.",
         "detail_points": ["Nearby patio concepts are leaning heavily on live music and discounting.",
                           "The opportunity is a sharper culinary position with less price dependence.",
                           "Launch timing targets the first warm-weather weekend."],
         "prompt": "Research competitor patio strategies for West Loop positioning."},
        {"id": uuid.uuid4(), "location_id": LOC_FULTON_MARKET,
         "campaign_name": "Launch-week retention", "channel": "SMS + paid social",
         "stage": "Ready for review", "deliverable": "Offer test plan",
         "summary": "Turning launch traffic into repeat traffic with targeted follow-up messaging.",
         "detail_points": ["SMS opt-ins are already ahead of target.",
                           "Paid social should reinforce repeat behavior, not broad awareness.",
                           "The offer needs to feel premium rather than discount-heavy."],
         "prompt": "Design a retention offer for Fulton Market launch-week guests."},
    ])


def downgrade() -> None:
    op.drop_table("action_log")
    op.drop_table("workspace_campaigns")
    op.drop_table("workspace_menu")
    op.drop_table("workspace_food_cost")
    op.drop_table("workspace_prep")
    op.drop_table("workspace_inventory")
    op.drop_table("workspace_orders")
    op.drop_table("inbox_items")
    op.drop_table("workspace_locations")
    op.drop_table("organizations")
