"""Base adapter contract."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

from .errors import AdapterValidationError
from .health import AdapterHealth


REQUIRED_RESULT_KEYS = ("advisoryOnly",)


class BaseAdapter(ABC):
    name: str
    capability: str

    def __init__(self) -> None:
        self.health = AdapterHealth(name=self.name)

    @abstractmethod
    def invoke(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        ...

    def execute(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        self.health.circuit.before_call()
        try:
            result = self.invoke(payload)
            validated = self.validate(result)
            self.health.circuit.record_success()
            self.health.healthy = True
            self.health.consecutive_failures = 0
            self.health.last_error = None
            return validated
        except Exception as exc:  # noqa: BLE001
            self.health.circuit.record_failure()
            self.health.healthy = False
            self.health.consecutive_failures += 1
            self.health.last_error = str(exc)
            raise

    def validate(self, result: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(result, dict):
            raise AdapterValidationError("Adapter result must be a dict")
        for key in REQUIRED_RESULT_KEYS:
            if key not in result:
                result[key] = True
        if result.get("advisoryOnly") is not True:
            raise AdapterValidationError("AI adapters must return advisoryOnly=true")
        result.setdefault("capability", self.capability)
        return result

    def health_check(self) -> Dict[str, Any]:
        return self.health.snapshot()
