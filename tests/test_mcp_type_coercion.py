"""Tests for MCP server type coercion and UUID parsing fixes."""

import uuid
from decimal import Decimal

import pytest


# ---------------------------------------------------------------------------
# Import the helpers under test
# ---------------------------------------------------------------------------

from carabiner.mcp.server import _parse_uuid, _coerce_types


# ---------------------------------------------------------------------------
# _parse_uuid tests
# ---------------------------------------------------------------------------

SAMPLE_UUID = "550e8400-e29b-41d4-a716-446655440000"


def test_parse_uuid_plain():
    """Normal UUID string parses correctly."""
    result = _parse_uuid(SAMPLE_UUID)
    assert isinstance(result, uuid.UUID)
    assert str(result) == SAMPLE_UUID


def test_parse_uuid_repr_format():
    """UUID('...') wrapper (Python repr from LLMs) is handled."""
    wrapped = f"UUID('{SAMPLE_UUID}')"
    result = _parse_uuid(wrapped)
    assert isinstance(result, uuid.UUID)
    assert str(result) == SAMPLE_UUID


def test_parse_uuid_repr_format_double_quotes():
    """UUID(\"...\") wrapper with double quotes is handled."""
    wrapped = f'UUID("{SAMPLE_UUID}")'
    result = _parse_uuid(wrapped)
    assert isinstance(result, uuid.UUID)
    assert str(result) == SAMPLE_UUID


def test_parse_uuid_already_uuid():
    """uuid.UUID object passes through unchanged."""
    original = uuid.UUID(SAMPLE_UUID)
    result = _parse_uuid(original)
    assert result is original


def test_parse_uuid_invalid_raises():
    """Invalid UUID string raises ValueError."""
    with pytest.raises(ValueError, match="Invalid UUID"):
        _parse_uuid("not-a-uuid")


# ---------------------------------------------------------------------------
# _coerce_types tests
# ---------------------------------------------------------------------------


def test_coerce_numeric_from_string():
    """String '42.5' is coerced to Decimal for Numeric columns."""
    data = {"yield_quantity": "42.5", "name": "Test Recipe"}
    result = _coerce_types("recipes", data)
    assert isinstance(result["yield_quantity"], Decimal)
    assert result["yield_quantity"] == Decimal("42.5")
    # Non-numeric fields should be untouched
    assert result["name"] == "Test Recipe"


def test_coerce_integer_from_string():
    """String '3' is coerced to int for Integer columns (RecipeComponent.sort_order)."""
    # RecipeComponent is not in _MODULE_REGISTRY directly, but we test via
    # a model that has Integer columns. WorkspaceRecipe doesn't have Integer
    # columns, so we test with the _coerce_types_for_model helper directly.
    from carabiner.mcp.server import _coerce_types_for_model
    from carabiner.db.workspace_models import RecipeComponent

    data = {"sort_order": "3", "name": "Component A"}
    result = _coerce_types_for_model(RecipeComponent, data)
    assert isinstance(result["sort_order"], int)
    assert result["sort_order"] == 3
    assert result["name"] == "Component A"


def test_coerce_skips_none():
    """None values are left as None."""
    data = {"yield_quantity": None, "name": "Test"}
    result = _coerce_types("recipes", data)
    assert result["yield_quantity"] is None


def test_coerce_skips_correct_type():
    """Already-correct Decimal values are not re-coerced."""
    val = Decimal("99.99")
    data = {"total_cost": val, "name": "Test"}
    result = _coerce_types("recipes", data)
    assert result["total_cost"] is val


def test_coerce_unknown_module_returns_unchanged():
    """Unknown module name returns data unchanged (no crash)."""
    data = {"foo": "bar"}
    result = _coerce_types("nonexistent_module", data)
    assert result == {"foo": "bar"}


def test_coerce_uuid_columns_generic():
    """UUID-typed columns are parsed generically from strings."""
    sample = "550e8400-e29b-41d4-a716-446655440000"
    data = {"location_id": sample, "name": "Test"}
    result = _coerce_types("recipes", data)
    assert isinstance(result["location_id"], uuid.UUID)
    assert str(result["location_id"]) == sample


def test_coerce_uuid_columns_repr_format():
    """UUID-typed columns handle UUID('...') repr format."""
    sample = "550e8400-e29b-41d4-a716-446655440000"
    data = {"location_id": f"UUID('{sample}')", "name": "Test"}
    result = _coerce_types("recipes", data)
    assert isinstance(result["location_id"], uuid.UUID)
    assert str(result["location_id"]) == sample
