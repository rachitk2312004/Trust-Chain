from typing import Any, Dict

EVALUATION_VERSION = "eval-1.0.0"


def evaluate_confidence(predicted: float, reference: float) -> Dict[str, Any]:
    delta = abs(predicted - reference)
    within = delta <= 0.1
    return {
        "evaluationVersion": EVALUATION_VERSION,
        "predicted": predicted,
        "reference": reference,
        "delta": round(delta, 4),
        "withinTolerance": within,
    }
