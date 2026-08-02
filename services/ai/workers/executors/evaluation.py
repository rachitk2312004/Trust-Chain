from __future__ import annotations

from typing import Any, Dict

from evaluation.metrics import evaluate_confidence
from task_queue.types import QueueMessage

from .base import CapabilityExecutor


class EvaluationExecutor(CapabilityExecutor):
    capability = "evaluation"

    def execute(self, message: QueueMessage) -> Dict[str, Any]:
        self._guard()
        predicted = float(message.payload.get("predicted") or 0.0)
        reference = float(message.payload.get("reference") or 0.0)
        result = evaluate_confidence(predicted, reference)
        result["advisoryOnly"] = True
        result["capability"] = self.capability
        return result
