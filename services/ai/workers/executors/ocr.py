from __future__ import annotations

from typing import Any, Dict

from ocr.engine import get_engine
from ocr.preprocess import preprocess_image
from task_queue.types import QueueMessage

from .base import CapabilityExecutor


class OcrExecutor(CapabilityExecutor):
    capability = "ocr"

    def execute(self, message: QueueMessage) -> Dict[str, Any]:
        self._guard()
        payload = message.payload
        engine_name = str(payload.get("engine") or "stub")
        raw = _decode_bytes(payload.get("imageData") or payload.get("data") or "")
        preprocess_image(raw)
        result = get_engine(engine_name).run(raw)
        result["advisoryOnly"] = True
        result["capability"] = self.capability
        return result


def _decode_bytes(data: Any) -> bytes:
    if isinstance(data, bytes):
        return data
    if not data:
        return b""
    text = str(data)
    try:
        return bytes.fromhex(text)
    except ValueError:
        return text.encode("utf-8")
