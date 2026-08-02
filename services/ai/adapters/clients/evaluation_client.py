from __future__ import annotations

from typing import Any, Dict, Optional

from .http_transport import FastApiTransport, get_transport


class EvaluationClient:
    def __init__(self, transport: Optional[FastApiTransport] = None) -> None:
        self._transport = transport or get_transport()

    def run(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        body = {
            "predicted": float(payload.get("predicted") or 0.0),
            "reference": float(payload.get("reference") or 0.0),
            "operation": "evaluate",
        }
        return self._transport.post("/internal/evaluate", body)
