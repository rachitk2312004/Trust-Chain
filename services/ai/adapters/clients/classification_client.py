from __future__ import annotations

from typing import Any, Dict, Optional

from .http_transport import FastApiTransport, get_transport


class ClassificationClient:
    def __init__(self, transport: Optional[FastApiTransport] = None) -> None:
        self._transport = transport or get_transport()

    def run(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        body = {
            "text": str(payload.get("text") or ""),
            "provider": payload.get("provider"),
            "operation": "classify",
        }
        return self._transport.post("/internal/classify", body)
