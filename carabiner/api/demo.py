from __future__ import annotations

from flask import Blueprint, Response, request, session
import json

from carabiner.services.demo_payload_factory import (
    CANONICAL_DEMO_SLUG,
    DemoFixtureNotFoundError,
    DemoFixtureValidationError,
    authenticate_demo_account,
    build_demo_landing_payload,
    build_demo_tutorial_payload,
    build_demo_user,
    build_landing_payload,
    build_tutorial_payload,
    build_workspace_payload,
    create_demo_account,
    update_demo_tutorial_progress,
)

blueprint = Blueprint("carabiner_demo_api", __name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _ok(data: dict, status: int = 200) -> Response:
    return Response(
        response=json.dumps({"ok": True, "data": data}, default=str),
        status=status,
        mimetype="application/json",
    )


def _error(status: int, error: str, message: str) -> Response:
    return Response(
        response=json.dumps({"ok": False, "error": error, "message": message}, default=str),
        status=status,
        mimetype="application/json",
    )


def _bad_request(message: str) -> Response:
    return _error(400, "bad_request", message)


def _unauthorized(message: str) -> Response:
    return _error(401, "unauthorized", message)


def _resolve_slug() -> str:
    return request.args.get("slug", CANONICAL_DEMO_SLUG)


# ---------------------------------------------------------------------------
# Public landing / tutorial / workspace fixture endpoints
# ---------------------------------------------------------------------------


@blueprint.get("/api/demo/<slug>")
def get_demo_landing(slug: str) -> Response:
    try:
        return _ok(build_landing_payload(slug))
    except DemoFixtureNotFoundError:
        return _error(404, "demo_not_found", f"No demo fixture found for slug '{slug}'")
    except DemoFixtureValidationError as exc:
        return _error(500, "demo_fixture_invalid", str(exc))


@blueprint.get("/api/demo/workspace")
def get_demo_workspace() -> Response:
    slug = _resolve_slug()
    try:
        return _ok(build_workspace_payload(slug))
    except DemoFixtureNotFoundError:
        return _error(404, "demo_not_found", f"No demo fixture found for slug '{slug}'")
    except DemoFixtureValidationError as exc:
        return _error(500, "demo_fixture_invalid", str(exc))


# ---------------------------------------------------------------------------
# Demo auth + session-backed tutorial routes (HTTP-only cookie session)
# ---------------------------------------------------------------------------


@blueprint.post("/api/demo/account")
def create_demo_account_route() -> Response:
    body = request.get_json(silent=True) or {}
    name = str(body.get("name", "")).strip()
    email = str(body.get("email", "")).strip().lower()
    password = str(body.get("password", "")).strip()
    restaurant_slug = str(body.get("restaurantSlug", "")).strip() or CANONICAL_DEMO_SLUG
    mobile = body.get("mobile")

    if not name or not email or not password:
        return _bad_request("Name, work email, and password are required.")

    account = create_demo_account(
        restaurant_slug=restaurant_slug,
        name=name,
        email=email,
        password=password,
        mobile=mobile,
    )
    session.permanent = True
    session["demo_user_email"] = account["email"]
    session["demo_restaurant_slug"] = account["restaurant_slug"]
    session["demo_tutorial_progress"] = []

    return _ok(
        {
            "user": build_demo_user(account),
            "nextPath": "/demo/tutorial",
            "sessionMode": "http-only-cookie",
        }
    )


@blueprint.post("/api/demo/login")
def demo_login_route() -> Response:
    body = request.get_json(silent=True) or {}
    email = str(body.get("email", "")).strip().lower()
    password = str(body.get("password", "")).strip()
    restaurant_slug = str(body.get("restaurantSlug", "")).strip()

    if not email or not password:
        return _bad_request("Work email and password are required.")

    account = authenticate_demo_account(email, password)
    if account is None:
        return _unauthorized("Invalid demo credentials.")

    if restaurant_slug and account["restaurant_slug"] != restaurant_slug:
        account["restaurant_slug"] = restaurant_slug

    session.permanent = True
    session["demo_user_email"] = account["email"]
    session["demo_restaurant_slug"] = account["restaurant_slug"]
    session.setdefault("demo_tutorial_progress", [])

    return _ok(
        {
            "user": build_demo_user(account),
            "nextPath": "/demo/tutorial",
            "sessionMode": "http-only-cookie",
        }
    )


@blueprint.get("/api/demo/tutorial")
def get_demo_tutorial_route() -> Response:
    slug = str(
        session.get("demo_restaurant_slug")
        or request.args.get("restaurantSlug")
        or CANONICAL_DEMO_SLUG
    )
    progress = list(session.get("demo_tutorial_progress", []))
    if session.get("demo_user_email"):
        session["demo_restaurant_slug"] = slug
    try:
        return _ok(build_tutorial_payload(slug, progress))
    except DemoFixtureNotFoundError:
        return _error(404, "demo_not_found", f"No demo fixture found for slug '{slug}'")
    except DemoFixtureValidationError as exc:
        return _error(500, "demo_fixture_invalid", str(exc))


@blueprint.post("/api/demo/tutorial/progress")
def update_demo_tutorial_route() -> Response:
    if not session.get("demo_user_email"):
        return _unauthorized("Demo session required.")

    body = request.get_json(silent=True) or {}
    step_id = str(body.get("stepId", "")).strip()
    progress = list(session.get("demo_tutorial_progress", []))
    updated_progress = update_demo_tutorial_progress(progress, step_id)
    session["demo_tutorial_progress"] = updated_progress

    slug = str(
        session.get("demo_restaurant_slug")
        or body.get("restaurantSlug")
        or CANONICAL_DEMO_SLUG
    )
    try:
        return _ok(build_tutorial_payload(slug, updated_progress))
    except DemoFixtureNotFoundError:
        return _error(404, "demo_not_found", f"No demo fixture found for slug '{slug}'")
    except DemoFixtureValidationError as exc:
        return _error(500, "demo_fixture_invalid", str(exc))
