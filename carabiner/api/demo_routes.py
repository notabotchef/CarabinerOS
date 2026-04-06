from __future__ import annotations

import json

from flask import Blueprint, Response, request

from carabiner.services.demo_payload_factory import load_demo_workspace_payload
from carabiner.services.demo_sandbox import DemoSandboxService


demo_blueprint = Blueprint("carabiner_demo_api", __name__)
_demo_sandbox_service = DemoSandboxService()


def _json_response(payload: dict, status: int = 200) -> Response:
    return Response(
        response=json.dumps(payload, default=str),
        status=status,
        mimetype="application/json",
    )


@demo_blueprint.route("/api/demo/workspace", methods=["GET"])
def get_demo_workspace() -> Response:
    payload = load_demo_workspace_payload()
    return _json_response(payload)


@demo_blueprint.route("/api/demo/card-action", methods=["POST"])
def post_demo_card_action() -> Response:
    body = request.get_json(silent=True) or {}
    card_id = str(body.get("cardId") or "").strip()
    operation = str(body.get("operation") or "commit").strip() or "commit"
    card_summary = str(body.get("cardSummary") or card_id or "demo card").strip()
    message = body.get("message")

    if not card_id:
        return _json_response({"ok": False, "error": "cardId is required"}, status=400)

    result = _demo_sandbox_service.execute_card_action(
        card_id=card_id,
        operation=operation,
        card_summary=card_summary,
        message=str(message) if message is not None else None,
    )

    return _json_response({"ok": True, "result": result.to_dict()})
