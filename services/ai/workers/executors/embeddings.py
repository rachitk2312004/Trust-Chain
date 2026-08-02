from __future__ import annotations

from typing import Any, Dict

from task_queue.types import QueueMessage

from .base import CapabilityExecutor


class EmbeddingExecutor(CapabilityExecutor):
    capability = "embedding"

    def execute(self, message: QueueMessage) -> Dict[str, Any]:
        return self._via_adapter(message.payload)
