from __future__ import annotations

from typing import Any, Dict, Optional

from .http_transport import FastApiTransport, get_transport


class OcrClient:
    def __init__(self, transport: Optional[FastApiTransport] = None) -> None:
        self._transport = transport or get_transport()

    def run(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        body = {
            "imageData": _as_text(payload.get("imageData") or payload.get("data") or ""),
            "engine": str(payload.get("engine") or "stub"),
            "operation": "ocr",
        }
        return self._transport.post("/internal/ocr", body)


def _as_text(value: Any) -> str:
    if isinstance(value, bytes):
        return value.hex()
    return str(value) if value is not None else ""
