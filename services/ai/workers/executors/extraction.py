from __future__ import annotations

from typing import Any, Dict

from extraction.extractor import extract_fields
from task_queue.types import QueueMessage

from .base import CapabilityExecutor


class ExtractionExecutor(CapabilityExecutor):
    capability = "extraction"

    def execute(self, message: QueueMessage) -> Dict[str, Any]:
        self._guard()
        text = str(message.payload.get("text") or "")
        provider = message.payload.get("provider")
        document_type = message.payload.get("documentType")
        result = extract_fields(text, provider=provider, document_type=document_type)
        result["advisoryOnly"] = True
        result["capability"] = self.capability
        return result
