from .base import CapabilityExecutor
from .classification import ClassificationExecutor
from .embeddings import EmbeddingExecutor
from .evaluation import EvaluationExecutor
from .extraction import ExtractionExecutor
from .fraud import FraudExecutor
from .ocr import OcrExecutor

EXECUTOR_REGISTRY: dict[str, CapabilityExecutor] = {
    "ocr": OcrExecutor(),
    "extraction": ExtractionExecutor(),
    "classification": ClassificationExecutor(),
    "embedding": EmbeddingExecutor(),
    "fraud": FraudExecutor(),
    "evaluation": EvaluationExecutor(),
}


def get_executor(capability: str) -> CapabilityExecutor:
    executor = EXECUTOR_REGISTRY.get(capability)
    if executor is None:
        raise KeyError(f"No executor registered for capability '{capability}'")
    return executor


__all__ = [
    "CapabilityExecutor",
    "ClassificationExecutor",
    "EmbeddingExecutor",
    "EvaluationExecutor",
    "ExtractionExecutor",
    "FraudExecutor",
    "OcrExecutor",
    "EXECUTOR_REGISTRY",
    "get_executor",
]
