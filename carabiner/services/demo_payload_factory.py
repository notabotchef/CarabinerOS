from __future__ import annotations

import json
from copy import deepcopy
from functools import lru_cache
from pathlib import Path
from typing import Any

CANONICAL_DEMO_SLUG = "targetrestaurant"
_REQUIRED_SECTIONS = ("restaurant", "landing", "tutorial", "workspace")
_FIXTURE_DIR = Path(__file__).resolve().parents[1] / "demo_fixtures"
_DEMO_ACCOUNTS: dict[str, dict[str, Any]] = {}


class DemoFixtureNotFoundError(FileNotFoundError):
    pass


class DemoFixtureValidationError(ValueError):
    pass


@lru_cache(maxsize=16)
def load_demo_fixture(slug: str = CANONICAL_DEMO_SLUG) -> dict[str, Any]:
    fixture_path = _FIXTURE_DIR / f"{slug}.json"
    if not fixture_path.exists():
        raise DemoFixtureNotFoundError(f"Demo fixture not found for slug '{slug}'")

    with fixture_path.open("r", encoding="utf-8") as fixture_file:
        fixture = json.load(fixture_file)

    missing_sections = [section for section in _REQUIRED_SECTIONS if section not in fixture]
    if missing_sections:
        raise DemoFixtureValidationError(
            f"Demo fixture '{slug}' missing sections: {', '.join(missing_sections)}"
        )

    restaurant = fixture["restaurant"]
    if restaurant.get("slug") != slug:
        raise DemoFixtureValidationError(
            f"Demo fixture slug mismatch: expected '{slug}', got '{restaurant.get('slug')}'"
        )

    return fixture


def _restaurant_payload(fixture: dict[str, Any]) -> dict[str, Any]:
    restaurant = deepcopy(fixture["restaurant"])
    restaurant.pop("provenance", None)
    return restaurant


def _simulation_payload(fixture: dict[str, Any]) -> dict[str, Any]:
    restaurant = fixture["restaurant"]
    return {
        "label": "Prepared from public restaurant information",
        "integration_status": "http_only_demo_fixture",
        "prepared_copy": restaurant.get("prepared_copy"),
        "public_source_summary": deepcopy(restaurant.get("public_source_summary", [])),
        "provenance": deepcopy(restaurant.get("provenance", [])),
    }


def build_landing_payload(slug: str = CANONICAL_DEMO_SLUG) -> dict[str, Any]:
    fixture = load_demo_fixture(slug)
    return {
        "slug": slug,
        "fixture_version": fixture.get("fixture_version"),
        "seed": fixture.get("seed"),
        "restaurant": _restaurant_payload(fixture),
        "landing": deepcopy(fixture["landing"]),
        "simulation": _simulation_payload(fixture),
    }


def build_tutorial_payload(slug: str = CANONICAL_DEMO_SLUG, progress: list[str] | None = None) -> dict[str, Any]:
    fixture = load_demo_fixture(slug)
    tutorial = deepcopy(fixture["tutorial"])
    tutorial_progress = list(progress or [])
    tutorial["step_count"] = len(tutorial.get("steps", []))
    tutorial["completed_step_ids"] = tutorial_progress
    return {
        "slug": slug,
        "fixture_version": fixture.get("fixture_version"),
        "seed": fixture.get("seed"),
        "restaurant": _restaurant_payload(fixture),
        "tutorial": tutorial,
        "simulation": _simulation_payload(fixture),
    }


def build_workspace_payload(slug: str = CANONICAL_DEMO_SLUG) -> dict[str, Any]:
    fixture = load_demo_fixture(slug)
    workspace = deepcopy(fixture["workspace"])
    workspace["action_cards"] = list(workspace.get("action_cards", []))[:3]
    workspace["action_card_count"] = len(workspace.get("action_cards", []))
    workspace["notification_count"] = len(workspace.get("notifications", []))
    return {
        "slug": slug,
        "fixture_version": fixture.get("fixture_version"),
        "seed": fixture.get("seed"),
        "restaurant": _restaurant_payload(fixture),
        "workspace": workspace,
        "simulation": _simulation_payload(fixture),
    }


def load_demo_workspace_payload(slug: str = CANONICAL_DEMO_SLUG) -> dict[str, Any]:
    workspace_payload = build_workspace_payload(slug)
    workspace = workspace_payload["workspace"]
    email_preview = deepcopy(workspace.get("email_preview", {}))
    normalized_email_preview = {
        "subject": email_preview.get("subject", ""),
        "to": email_preview.get("to", ""),
        "previewLabel": email_preview.get("preview_label", "Demo draft"),
        "body": email_preview.get("body", []),
        "disclaimer": email_preview.get("disclaimer", ""),
    }
    return {
        "restaurant": workspace["restaurant"],
        "notifications": workspace.get("notifications", []),
        "cards": workspace.get("action_cards", [])[:3],
        "emailPreview": normalized_email_preview,
        "actionEndpoint": workspace.get("action_endpoint", "/api/demo/card-action"),
        "simulation": workspace_payload["simulation"],
    }


def create_demo_account(
    *,
    restaurant_slug: str,
    name: str,
    email: str,
    password: str,
    mobile: str | None = None,
) -> dict[str, Any]:
    account = {
        "restaurant_slug": restaurant_slug or CANONICAL_DEMO_SLUG,
        "name": name,
        "email": email.lower(),
        "password": password,
        "mobile": mobile,
    }
    _DEMO_ACCOUNTS[account["email"]] = account
    return deepcopy(account)


def authenticate_demo_account(email: str, password: str) -> dict[str, Any] | None:
    account = _DEMO_ACCOUNTS.get(email.lower())
    if not account or account.get("password") != password:
        return None
    return deepcopy(account)


def build_demo_user(account: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": account.get("name"),
        "email": account.get("email"),
        "mobile": account.get("mobile"),
        "restaurantSlug": account.get("restaurant_slug"),
    }


def update_demo_tutorial_progress(progress: list[str], step_id: str) -> list[str]:
    if not step_id:
        return list(progress)
    if step_id in progress:
        return list(progress)
    return [*progress, step_id]


def build_demo_landing_payload(slug: str = CANONICAL_DEMO_SLUG) -> dict[str, Any]:
    return build_landing_payload(slug)


def build_demo_tutorial_payload(slug: str = CANONICAL_DEMO_SLUG, progress: list[str] | None = None) -> dict[str, Any]:
    return build_tutorial_payload(slug, progress)
