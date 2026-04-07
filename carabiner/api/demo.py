from __future__ import annotations

from flask import Blueprint, request

from carabiner.services.demo_payload_factory import (
    CANONICAL_DEMO_SLUG,
    DemoFixtureNotFoundError,
    DemoFixtureValidationError,
    build_landing_payload,
    build_tutorial_payload,
    build_workspace_payload,
)

blueprint = Blueprint("carabiner_demo_api", __name__)


def _ok(data: dict) -> tuple[dict, int]:
    return {"ok": True, "data": data}, 200


def _error(status: int, error: str, message: str) -> tuple[dict, int]:
    return {"ok": False, "error": error, "message": message}, status


def _resolve_slug() -> str:
    return request.args.get("slug", CANONICAL_DEMO_SLUG)


@blueprint.get("/api/demo/<slug>")
async def get_demo_landing(slug: str):
    try:
        return _ok(build_landing_payload(slug))
    except DemoFixtureNotFoundError:
        return _error(404, "demo_not_found", f"No demo fixture found for slug '{slug}'")
    except DemoFixtureValidationError as exc:
        return _error(500, "demo_fixture_invalid", str(exc))


@blueprint.get("/api/demo/tutorial")
async def get_demo_tutorial():
    slug = _resolve_slug()
    try:
        return _ok(build_tutorial_payload(slug))
    except DemoFixtureNotFoundError:
        return _error(404, "demo_not_found", f"No demo fixture found for slug '{slug}'")
    except DemoFixtureValidationError as exc:
        return _error(500, "demo_fixture_invalid", str(exc))


@blueprint.get("/api/demo/workspace")
async def get_demo_workspace():
    slug = _resolve_slug()
    try:
        return _ok(build_workspace_payload(slug))
    except DemoFixtureNotFoundError:
        return _error(404, "demo_not_found", f"No demo fixture found for slug '{slug}'")
    except DemoFixtureValidationError as exc:
        return _error(500, "demo_fixture_invalid", str(exc))
