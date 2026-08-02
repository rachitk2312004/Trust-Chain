"""Capability executors — call existing stub engines (Step 4 will swap adapters)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict

from security.guard import assert_safe_operation
from task_queue.types import QueueMessage


class CapabilityExecutor(ABC):
    capability: str

    @abstractmethod
    def execute(self, message: QueueMessage) -> Dict[str, Any]:
        ...

    def _guard(self) -> None:
        assert_safe_operation(self.capability)
