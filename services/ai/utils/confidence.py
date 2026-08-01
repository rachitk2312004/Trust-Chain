from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class ConfidenceInterval(BaseModel):
    low: float = Field(ge=0.0, le=1.0)
    high: float = Field(ge=0.0, le=1.0)


class CostFields(BaseModel):
    tokenUsage: int = 0
    computeUsage: float = 0.0
    storageUsage: float = 0.0
    estimatedCost: float = 0.0


class ResultMetadata(BaseModel):
    confidence: float = Field(ge=0.0, le=1.0)
    confidenceInterval: ConfidenceInterval
    modelVersion: str
    evaluationVersion: str
    tokenUsage: int = 0
    computeUsage: float = 0.0
    storageUsage: float = 0.0
    estimatedCost: float = 0.0


def build_result_metadata(
    confidence: float,
    model_version: str,
    evaluation_version: str = "eval-1.0.0",
    margin: float = 0.05,
    token_usage: int = 0,
    compute_usage: float = 0.0,
    storage_usage: float = 0.0,
    estimated_cost: float = 0.0,
) -> Dict[str, Any]:
    """Build standard metadata fields required on every result payload."""
    low = max(0.0, confidence - margin)
    high = min(1.0, confidence + margin)
    return {
        "confidence": round(confidence, 4),
        "confidenceInterval": {"low": round(low, 4), "high": round(high, 4)},
        "modelVersion": model_version,
        "evaluationVersion": evaluation_version,
        "tokenUsage": token_usage,
        "computeUsage": compute_usage,
        "storageUsage": storage_usage,
        "estimatedCost": estimated_cost,
    }


def merge_metadata(base: Dict[str, Any], extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    result = dict(base)
    if extra:
        result.update(extra)
    return result
