from __future__ import annotations

from unittest.mock import Mock

from flask import Flask

from carabiner.api.demo_routes import demo_blueprint
from carabiner.services.demo_sandbox import DemoSandboxService


def _make_app() -> Flask:
    app = Flask("demo_sandbox_test")
    app.register_blueprint(demo_blueprint)
    return app


def test_demo_sandbox_service_never_calls_real_sender() -> None:
    real_sender = Mock()
    service = DemoSandboxService(send_email=real_sender)

    result = service.execute_card_action(
        card_id="demo-order-draft",
        operation="commit",
        card_summary="Prepared draft",
    )

    real_sender.assert_not_called()
    assert result.sandbox_only is True
    assert result.real_send_attempted is False
    assert result.delivery_channel == "http"


def test_demo_card_action_endpoint_returns_sandbox_result() -> None:
    app = _make_app()
    client = app.test_client()

    response = client.post(
        "/api/demo/card-action",
        json={
            "cardId": "demo-order-draft",
            "operation": "commit",
            "cardSummary": "Prepared draft",
        },
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["ok"] is True
    assert payload["result"]["sandboxOnly"] is True
    assert payload["result"]["realSendAttempted"] is False
    assert payload["result"]["deliveryChannel"] == "http"


def test_demo_workspace_endpoint_caps_cards_at_three() -> None:
    app = _make_app()
    client = app.test_client()

    response = client.get("/api/demo/workspace")

    assert response.status_code == 200
    payload = response.get_json()
    assert len(payload["cards"]) == 3
