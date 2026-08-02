from __future__ import annotations

from typing import Any, Dict

from classification.fraud import assess_fraud_risk
from task_queue.types import QueueMessage

from .base import CapabilityExecutor


class FraudExecutor(CapabilityExecutor):
    capability = "fraud"

    def execute(self, message: QueueMessage) -> Dict[str, Any]:
        self._guard()
        text = str(message.payload.get("text") or "")
        result = assess_fraud_risk(text)
        result["advisoryOnly"] = True
        result["capability"] = self.capability
        return result
