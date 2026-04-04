"""
Tests for the langextract plugin.
Tests schema loading and extraction formatting (no LLM calls needed).
"""

import json
import os
import sys
import pytest

# Add project root to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))


class TestSchemas:
    """Test built-in schema definitions."""

    def test_list_schemas(self):
        from usr.plugins.langextract.helpers.schemas import list_schemas
        schemas = list_schemas()
        assert "invoice" in schemas
        assert "recipe" in schemas
        assert "prep_list" in schemas

    def test_get_schema_invoice(self):
        from usr.plugins.langextract.helpers.schemas import get_schema
        schema = get_schema("invoice")
        assert schema is not None
        assert "prompt" in schema
        assert "examples" in schema
        assert len(schema["examples"]) > 0

    def test_get_schema_recipe(self):
        from usr.plugins.langextract.helpers.schemas import get_schema
        schema = get_schema("recipe")
        assert schema is not None
        assert "prompt" in schema
        assert len(schema["examples"]) > 0

    def test_get_schema_prep_list(self):
        from usr.plugins.langextract.helpers.schemas import get_schema
        schema = get_schema("prep_list")
        assert schema is not None
        assert "prompt" in schema

    def test_get_schema_nonexistent(self):
        from usr.plugins.langextract.helpers.schemas import get_schema
        assert get_schema("nonexistent") is None

    def test_schema_examples_have_required_fields(self):
        from usr.plugins.langextract.helpers.schemas import SCHEMAS
        for name, schema in SCHEMAS.items():
            for example in schema["examples"]:
                assert "text" in example, f"{name} example missing 'text'"
                assert "extractions" in example, f"{name} example missing 'extractions'"
                for ext in example["extractions"]:
                    assert "extraction_class" in ext, f"{name} extraction missing 'extraction_class'"
                    assert "extraction_text" in ext, f"{name} extraction missing 'extraction_text'"


class TestFormatting:
    """Test extraction result formatting."""

    def test_format_extractions(self):
        from usr.plugins.langextract.helpers.extractor import format_extractions_for_agent
        result = {
            "count": 2,
            "model": "test-model",
            "json_path": "/tmp/test.json",
            "visualization_path": None,
            "extractions": [
                {
                    "class": "line_item",
                    "text": "Prime Ribeye",
                    "attributes": {"quantity": "12", "unit": "LB"},
                },
                {
                    "class": "line_item",
                    "text": "Arugula",
                    "attributes": {"quantity": "4", "unit": "CS"},
                    "grounded": False,
                },
            ],
        }
        output = format_extractions_for_agent(result)
        assert "Extracted 2 items" in output
        assert "Prime Ribeye" in output
        assert "Arugula" in output
        assert "ungrounded" in output
        assert "test-model" in output

    def test_format_empty_extractions(self):
        from usr.plugins.langextract.helpers.extractor import format_extractions_for_agent
        result = {
            "count": 0,
            "model": "test-model",
            "json_path": "/tmp/test.json",
            "visualization_path": "/tmp/test.html",
            "extractions": [],
        }
        output = format_extractions_for_agent(result)
        assert "Extracted 0 items" in output
        assert "Visualization" in output


class TestFixtures:
    """Test that fixture files are valid and loadable."""

    def test_invoice_fixture_exists(self):
        fixture = os.path.join(
            os.path.dirname(__file__), "fixtures", "sample_invoice.txt"
        )
        assert os.path.isfile(fixture)
        with open(fixture) as f:
            text = f.read()
        assert "US FOODS" in text
        assert "TOTAL" in text

    def test_recipe_fixture_exists(self):
        fixture = os.path.join(
            os.path.dirname(__file__), "fixtures", "sample_recipe.txt"
        )
        assert os.path.isfile(fixture)
        with open(fixture) as f:
            text = f.read()
        assert "Bone Marrow" in text
        assert "Method:" in text
