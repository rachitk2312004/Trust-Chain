from __future__ import annotations

from typing import Any, Dict

from task_queue.types import QueueMessage

from .base import CapabilityExecutor


class ClassificationExecutor(CapabilityExecutor):
    capability = "classification"

    def execute(self, message: QueueMessage) -> Dict[str, Any]:
        return self._via_adapter(message.payload)
