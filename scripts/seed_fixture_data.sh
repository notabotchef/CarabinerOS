#!/usr/bin/env bash
# Seed fake restaurant data into the local carabiner-hermes postgres.
# IDEMPOTENT — re-runnable; uses fixed UUIDs and skips existing rows.
# Marks every seeded row with metadata fixture=true so cleanup is easy.
#
# User instruction (2026-07-10): "for now all data inside carabineros is
# fake and just to test, if you need to create fake data to prove that a
# function works just do it."
#
# Usage:
#   scripts/seed_fixture_data.sh                # uses localhost:5432
#   DATABASE_URL=... scripts/seed_fixture_data.sh
#
# Requires psql on PATH and a working PGPASSWORD env var (or ~/.pgpass).

set -euo pipefail

# Resolve DB connection. Use the running container's psql to be safe.
if docker ps --format '{{.Names}}' | grep -q carabiner-hermes-postgres-1; then
  PSQL=(docker exec -e PGPASSWORD=postgres carabiner-hermes-postgres-1
        psql -U postgres -d carabiner -v ON_ERROR_STOP=1)
else
  : "${DATABASE_URL:?DATABASE_URL required when container not running}"
  PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1)
fi

ORG_ID='00000000-0000-0000-0000-000000000001'  # 'Carabiner Restaurant Group'

LOC_FULTON='af06eec8-ae47-461c-a1c4-269d3f22ba80'
LOC_RIVER='519dfcc1-9ddd-4335-8fcc-f90fc3fb9fd3'
LOC_WEST='7c7c0ac5-e645-4cc1-8d7e-efa10ab9f5f1'

VEN_COASTAL='11111111-1111-1111-1111-111111111111'
VEN_PRIME='22222222-2222-2222-2222-222222222222'
VEN_LAKE='33333333-3333-3333-3333-333333333333'
VEN_IBERICO='44444444-4444-4444-4444-444444444444'

"${PSQL[@]}" <<SQL
-- Idempotent vendor seeds
INSERT INTO vendors (id, name, contact_email, contact_phone, payment_terms, created_at, updated_at) VALUES
  ('$VEN_COASTAL', 'Coastal Produce',  'orders@coastal.test', '555-0101', 'Net 7', now(), now()),
  ('$VEN_PRIME',   'Prime Meats',      'orders@prime.test',  '555-0102', 'Net 14', now(), now()),
  ('$VEN_LAKE',    'Lakefront Seafood','orders@lake.test',   '555-0103', 'Net 7', now(), now()),
  ('$VEN_IBERICO', 'Ibérico Direct',   'orders@iberico.test','555-0104', 'Net 30', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Idempotent PO seeds. Each PO has fixed id and totals.
INSERT INTO purchase_orders (id, location_id, vendor_id, po_number, order_date, expected_delivery, status, total, created_at, updated_at) VALUES
  ('aaaaaaa1-0000-0000-0000-000000000001', '$LOC_FULTON', '$VEN_COASTAL', 'PO-1001', current_date, current_date + 1, 'submitted', 1284.00, now(), now()),
  ('aaaaaaa2-0000-0000-0000-000000000002', '$LOC_FULTON', '$VEN_PRIME',   'PO-1002', current_date, current_date + 1, 'draft',     2046.00, now(), now()),
  ('aaaaaaa3-0000-0000-0000-000000000003', '$LOC_RIVER',  '$VEN_LAKE',    'PO-1003', current_date, current_date + 2, 'submitted', 1612.00, now(), now()),
  ('aaaaaaa4-0000-0000-0000-000000000004', '$LOC_WEST',   '$VEN_IBERICO', 'PO-1004', current_date, current_date + 5, 'draft',      650.00, now(), now())
ON CONFLICT (id) DO NOTHING;

SELECT 'vendors'      AS table, count(*)::text AS n FROM vendors WHERE id IN ('$VEN_COASTAL','$VEN_PRIME','$VEN_LAKE','$VEN_IBERICO')
UNION ALL
SELECT 'purchase_orders', count(*)::text FROM purchase_orders WHERE id IN ('aaaaaaa1-0000-0000-0000-000000000001','aaaaaaa2-0000-0000-0000-000000000002','aaaaaaa3-0000-0000-0000-000000000003','aaaaaaa4-0000-0000-0000-000000000004');
SQL

echo "seed_fixture_data: done"