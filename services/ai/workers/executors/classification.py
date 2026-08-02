from __future__ import annotations

from typing import Any, Dict

from classification.classifier import classify_document
from task_queue.types import QueueMessage

from .base import CapabilityExecutor


class ClassificationExecutor(CapabilityExecutor):
    capability = "classification"

    def execute(self, message: QueueMessage) -> Dict[str, Any]:
        self._guard()
        text = str(message.payload.get("text") or "")
        provider = message.payload.get("provider")
        result = classify_document(text, provider=provider)
        result["advisoryOnly"] = True
        result["capability"] = self.capability
        return result
