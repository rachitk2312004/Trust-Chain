"""Capability executors — call adapters only (never engine modules)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict

from adapters.adapter_factory import get_adapter_factory
from security.guard import assert_safe_operation
from task_queue.types import QueueMessage


class CapabilityExecutor(ABC):
    capability: str

    @abstractmethod
    def execute(self, message: QueueMessage) -> Dict[str, Any]:
        ...

    def _guard(self) -> None:
        assert_safe_operation(self.capability)

    def _via_adapter(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        self._guard()
        result = get_adapter_factory().execute(self.capability, payload)
        result["advisoryOnly"] = True
        result["capability"] = self.capability
        return result
