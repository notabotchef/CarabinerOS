from __future__ import annotations

from flask import Flask

# Slice 2 moved the demo auth/tutorial routes out of flask_blueprint.py and
# into carabiner.api.demo, where they are mounted on the Flask app via
# engine/agent-zero/helpers/ui_server.py. Register the narrower blueprint
# directly so these tests don't drag in the rest of the workspace API.
from carabiner.api.demo import blueprint
from carabiner.services.demo_payload_factory import clear_demo_account_store


def _make_app() -> Flask:
    app = Flask("test_demo_auth_routes")
    app.secret_key = "demo-test-secret"
    app.register_blueprint(blueprint)
    return app


def test_demo_account_creation_sets_http_only_session_cookie() -> None:
    clear_demo_account_store()
    app = _make_app()
    client = app.test_client()

    response = client.post(
        "/api/demo/account",
        json={
            "restaurantSlug": "targetrestaurant",
            "name": "Chef Demo",
            "email": "chef@targetrestaurant.com",
            "password": "super-secret",
        },
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["ok"] is True
    assert payload["data"]["nextPath"] == "/demo/tutorial"
    assert payload["data"]["sessionMode"] == "http-only-cookie"
    assert "HttpOnly" in response.headers.get("Set-Cookie", "")

    with client.session_transaction() as demo_session:
        assert demo_session["demo_user_email"] == "chef@targetrestaurant.com"
        assert demo_session["demo_restaurant_slug"] == "targetrestaurant"
        assert demo_session["demo_tutorial_progress"] == []


def test_demo_login_restores_cookie_backed_session() -> None:
    clear_demo_account_store()
    app = _make_app()

    creator = app.test_client()
    creator.post(
        "/api/demo/account",
        json={
            "restaurantSlug": "targetrestaurant",
            "name": "Chef Demo",
            "email": "chef@targetrestaurant.com",
            "password": "super-secret",
        },
    )

    client = app.test_client()
    response = client.post(
        "/api/demo/login",
        json={
            "restaurantSlug": "targetrestaurant",
            "email": "chef@targetrestaurant.com",
            "password": "super-secret",
        },
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["ok"] is True
    assert payload["data"]["user"]["email"] == "chef@targetrestaurant.com"

    with client.session_transaction() as demo_session:
        assert demo_session["demo_user_email"] == "chef@targetrestaurant.com"
        assert demo_session["demo_restaurant_slug"] == "targetrestaurant"


def test_demo_tutorial_progress_persists_after_auth() -> None:
    clear_demo_account_store()
    app = _make_app()
    client = app.test_client()

    client.post(
        "/api/demo/account",
        json={
            "restaurantSlug": "targetrestaurant",
            "name": "Chef Demo",
            "email": "chef@targetrestaurant.com",
            "password": "super-secret",
        },
    )

    progress_response = client.post(
        "/api/demo/tutorial/progress",
        json={
            "restaurantSlug": "targetrestaurant",
            "stepId": "welcome",
        },
    )
    assert progress_response.status_code == 200
    progress_payload = progress_response.get_json()
    assert progress_payload["ok"] is True
    # build_tutorial_payload nests progress under data.tutorial.completed_step_ids
    # (snake_case), not a flat camelCase data.completedStepIds — the test was
    # written against an earlier API shape.
    assert progress_payload["data"]["tutorial"]["completed_step_ids"] == ["welcome"]

    tutorial_response = client.get("/api/demo/tutorial?restaurantSlug=targetrestaurant")
    assert tutorial_response.status_code == 200
    tutorial_payload = tutorial_response.get_json()
    assert tutorial_payload["data"]["tutorial"]["completed_step_ids"] == ["welcome"]
