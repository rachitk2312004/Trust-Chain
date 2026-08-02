from __future__ import annotations

from typing import Any, Dict, Optional

from .http_transport import FastApiTransport, get_transport


class ExplainabilityClient:
    def __init__(self, transport: Optional[FastApiTransport] = None) -> None:
        self._transport = transport or get_transport()

    def run(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        body = {
            "text": str(payload.get("text") or payload.get("summary") or ""),
            "kind": str(payload.get("kind") or "generic"),
            "operation": "explain",
        }
        return self._transport.post("/internal/explain", body)
