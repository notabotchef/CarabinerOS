from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable


@dataclass(frozen=True)
class DemoSandboxResult:
    card_id: str
    operation: str
    title: str
    detail: str
    sandbox_only: bool
    real_send_attempted: bool
    delivery_channel: str
    timestamp: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "cardId": self.card_id,
            "operation": self.operation,
            "title": self.title,
            "detail": self.detail,
            "sandboxOnly": self.sandbox_only,
            "realSendAttempted": self.real_send_attempted,
            "deliveryChannel": self.delivery_channel,
            "timestamp": self.timestamp,
        }


class DemoSandboxService:
    def __init__(self, send_email: Callable[..., Any] | None = None) -> None:
        self._send_email = send_email

    def execute_card_action(
        self,
        *,
        card_id: str,
        operation: str,
        card_summary: str,
        message: str | None = None,
    ) -> DemoSandboxResult:
        timestamp = datetime.now(timezone.utc).isoformat()

        if operation == "commit":
            title = "Sandbox result"
            detail = (
                f"Prepared action for '{card_summary}' was recorded in demo mode. "
                "No live email or vendor send was triggered."
            )
        elif operation == "message":
            prompt = (message or "that request").strip()
            title = "Sandbox result"
            detail = (
                f"Captured demo follow-up for '{card_summary}'. "
                f"CarabinerOS would use '{prompt}' to refine the draft, but this demo stays HTTP-only and sandboxed."
            )
        elif operation == "dismiss":
            title = "Sandbox result"
            detail = (
                f"Dismissed '{card_summary}' inside the prepared workspace. "
                "No live workflow was changed."
            )
        else:
            title = "Sandbox result"
            detail = (
                f"Recorded '{operation}' for '{card_summary}' in the demo sandbox. "
                "No live workflow was changed."
            )

        return DemoSandboxResult(
            card_id=card_id,
            operation=operation,
            title=title,
            detail=detail,
            sandbox_only=True,
            real_send_attempted=False,
            delivery_channel="http",
            timestamp=timestamp,
        )
