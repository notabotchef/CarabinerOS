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
    assert payload["data"]["seed"] == "targetrestaurant-demo-v1"
    assert payload["data"]["restaurant"]["name"] == "Target Restaurant"
    assert payload["data"]["landing"]["labels"] == [
        "Prepared from public restaurant information",
        "Simulated demo data",
        "No live integrations connected",
    ]
    assert payload["data"]["simulation"]["integration_status"] == "http_only_demo_fixture"


def test_demo_tutorial_returns_canonical_fixture_payload() -> None:
    client = _make_app().test_client()

    response = client.get("/api/demo/tutorial")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["ok"] is True
    assert payload["data"]["slug"] == "targetrestaurant"
    assert payload["data"]["tutorial"]["step_count"] == 8
    assert payload["data"]["tutorial"]["steps"][0]["id"] == "welcome"
    assert payload["data"]["tutorial"]["workspace_href"] == "/demo/home"


def test_demo_workspace_returns_fixture_backed_workspace_payload() -> None:
    client = _make_app().test_client()

    response = client.get("/api/demo/workspace?slug=targetrestaurant")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["ok"] is True
    assert payload["data"]["workspace"]["action_card_count"] == 3
    assert payload["data"]["workspace"]["notification_count"] == 3
    assert payload["data"]["workspace"]["email_draft"]["label"] == "Demo draft, not actually sent"
    assert payload["data"]["workspace"]["action_cards"][0]["sandbox_result"] == (
        "Demo only — no vendor transmission will occur."
    )


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
