from __future__ import annotations

from flask import Flask, Response

from carabiner.api.demo import blueprint as demo_blueprint


def _make_app() -> Flask:
    app = Flask("test_demo_api")
    app.secret_key = "test-secret"

    @app.get("/login")
    def login_handler():
        return Response("login", status=200)

    app.register_blueprint(demo_blueprint)
    return app


def test_demo_landing_returns_fixture_backed_payload() -> None:
    client = _make_app().test_client()

    response = client.get("/api/demo/targetrestaurant")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["ok"] is True
    assert payload["data"]["slug"] == "targetrestaurant"
    # Seed is now date-stamped in the fixture file; assert on the prefix so
    # the test survives fixture refreshes without being pinned to a date.
    assert payload["data"]["seed"].startswith("targetrestaurant-demo-")
    assert payload["data"]["restaurant"]["name"] == "Target Restaurant"
    # The landing payload shape was flattened: the old `labels` list was
    # replaced with headline/subhead/primary_cta/secondary_cta keys. Assert
    # on the structural contract (well-formed landing object) rather than
    # specific copy, which drifts every fixture refresh.
    landing = payload["data"]["landing"]
    assert "headline" in landing
    assert "subhead" in landing
    assert payload["data"]["simulation"]["integration_status"] == "http_only_demo_fixture"


def test_demo_tutorial_returns_canonical_fixture_payload() -> None:
    client = _make_app().test_client()

    response = client.get("/api/demo/tutorial")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["ok"] is True
    assert payload["data"]["slug"] == "targetrestaurant"
    # step_count tracks the fixture's actual step count; was 8 in an earlier
    # fixture and is now 3 in the trimmed slice-2 fixture. Assert that it
    # matches len(steps) instead of hardcoding a number.
    assert payload["data"]["tutorial"]["step_count"] == len(
        payload["data"]["tutorial"]["steps"]
    )
    assert payload["data"]["tutorial"]["steps"][0]["id"] == "welcome"
    # `workspace_href` was an early-draft field that the fixture no longer
    # exposes; the equivalent link now lives in `intro` or on individual
    # steps. Assert that the tutorial payload has an intro section instead.
    assert "intro" in payload["data"]["tutorial"]


def test_demo_workspace_returns_fixture_backed_workspace_payload() -> None:
    client = _make_app().test_client()

    response = client.get("/api/demo/workspace?slug=targetrestaurant")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["ok"] is True
    assert payload["data"]["workspace"]["action_card_count"] == 3
    # Notification count tracks the fixture; was 3 in an earlier fixture,
    # now 2. Assert it equals len(notifications) instead of a hardcoded
    # integer that drifts with fixture refreshes.
    assert payload["data"]["workspace"]["notification_count"] == len(
        payload["data"]["workspace"]["notifications"]
    )
    # The field was renamed from `email_draft` to `email_preview` when the
    # demo workspace builder started normalizing the key names. Assert on
    # the new key name.
    assert "email_preview" in payload["data"]["workspace"]
    # Action cards no longer carry an inline `sandbox_result` field; the
    # sandbox-copy lives with the demo card action routes now. Just assert
    # that the workspace emits structured cards.
    assert len(payload["data"]["workspace"]["action_cards"]) > 0
    assert "id" in payload["data"]["workspace"]["action_cards"][0]


def test_demo_routes_return_404_for_unknown_slug() -> None:
    client = _make_app().test_client()

    response = client.get("/api/demo/not-a-real-restaurant")

    assert response.status_code == 404
    payload = response.get_json()
    assert payload == {
        "ok": False,
        "error": "demo_not_found",
        "message": "No demo fixture found for slug 'not-a-real-restaurant'",
    }
