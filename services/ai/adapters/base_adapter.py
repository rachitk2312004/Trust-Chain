"""Base adapter contract with Step 6 result validation."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict
import time
import uuid

from .errors import AdapterValidationError
from .health import AdapterHealth


REQUIRED_RESULT_KEYS = (
    "advisoryOnly",
    "modelId",
    "modelVersion",
    "executionTimeMs",
    "lineageId",
    "confidence",
)


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
        started = time.time()
        try:
            result = self.invoke(payload)
            if "executionTimeMs" not in result:
                result["executionTimeMs"] = round((time.time() - started) * 1000.0, 3)
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
        result.setdefault("advisoryOnly", True)
        if result.get("advisoryOnly") is not True:
            raise AdapterValidationError("AI adapters must return advisoryOnly=true")
        result.setdefault("capability", self.capability)
        result.setdefault(
            "modelId",
            result.get("model_id") or f"AI-MODEL-{self.capability.upper()[:8]}",
        )
        result.setdefault(
            "modelVersion",
            result.get("modelVersion")
            or result.get("model_version")
            or f"MODEL-VERSION-{self.capability.upper()[:8]}",
        )
        if "lineageId" not in result:
            lineage = result.get("lineage")
            if isinstance(lineage, str) and lineage.startswith("LINEAGE-"):
                result["lineageId"] = lineage
            elif isinstance(lineage, list) and lineage:
                first = lineage[0]
                if isinstance(first, dict) and first.get("public_code"):
                    result["lineageId"] = first["public_code"]
                else:
                    result["lineageId"] = f"LINEAGE-{uuid.uuid4().hex[:8].upper()}"
            else:
                result["lineageId"] = f"LINEAGE-{uuid.uuid4().hex[:8].upper()}"
        if "confidence" not in result or not isinstance(result.get("confidence"), (int, float)):
            result["confidence"] = float(result.get("confidence") or 0.7)
        if "executionTimeMs" not in result:
            result["executionTimeMs"] = 0.0
        for key in REQUIRED_RESULT_KEYS:
            if key not in result:
                raise AdapterValidationError(f"Missing required adapter field: {key}")
        return result

    def health_check(self) -> Dict[str, Any]:
        return self.health.snapshot()
