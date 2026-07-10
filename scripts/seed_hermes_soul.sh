#!/usr/bin/env bash
# Seed the live Hermes home with the tracked CarabinerOS soul + skill.
# Safe to re-run: only touches SOUL.md and the carabineros-restaurant
# skill. Never touches auth.json, .env, config.yaml, or any secrets.
#
# Usage:
#   scripts/seed_hermes_soul.sh
#   HERMES_HOME_DIR=/custom/path scripts/seed_hermes_soul.sh
#
# Exits 0 on success, 1 on any failure.

set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
HOME_DIR="${HERMES_HOME_DIR:-$ROOT/var/hermes-home}"
SKILL_SRC="$ROOT/hermes/skills/carabineros-restaurant"
SKILL_DST="$HOME_DIR/skills/carabineros-restaurant"

mkdir -p "$HOME_DIR"
mkdir -p "$SKILL_DST"

cp "$ROOT/hermes/SOUL.md" "$HOME_DIR/SOUL.md"
cp "$SKILL_SRC/SKILL.md" "$SKILL_DST/SKILL.md"

# CarabinerOS also ships a location-context skill. Seed it if present.
LCTX_SRC="$ROOT/hermes/skills/carabineros-location-context"
LCTX_DST="$HOME_DIR/skills/carabineros-location-context"
if [ -f "$LCTX_SRC/SKILL.md" ]; then
  mkdir -p "$LCTX_DST"
  cp "$LCTX_SRC/SKILL.md" "$LCTX_DST/SKILL.md"
  grep -q "carabineros-location-context" "$LCTX_DST/SKILL.md" || {
    echo "FAIL: seeded location-context skill is malformed" >&2
    exit 1
  }
  echo "Seeded: $LCTX_DST/SKILL.md"
fi

# Light assertions so a silent copy failure is impossible.
grep -q "CarabinerOS" "$HOME_DIR/SOUL.md" || {
  echo "FAIL: seeded SOUL.md does not contain CarabinerOS" >&2
  exit 1
}
grep -q "carabineros-restaurant" "$SKILL_DST/SKILL.md" || {
  echo "FAIL: seeded skill does not contain carabineros-restaurant" >&2
  exit 1
}

echo "Seeded: $HOME_DIR/SOUL.md"
echo "Seeded: $SKILL_DST/SKILL.md"
