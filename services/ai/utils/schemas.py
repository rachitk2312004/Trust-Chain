from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from .confidence import ConfidenceInterval, CostFields


class HumanReviewState(str, Enum):
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    ESCALATED = "escalated"


DEFAULT_REVIEW_STATE = HumanReviewState.PENDING_REVIEW


class AdvisoryResult(BaseModel):
    """Base advisory result — AI never auto-approves as final decision."""

    advisoryOnly: bool = True
    reviewState: HumanReviewState = DEFAULT_REVIEW_STATE
    lineage: str
    confidence: float = Field(ge=0.0, le=1.0)
    confidenceInterval: ConfidenceInterval
    modelVersion: str
    evaluationVersion: str
    tokenUsage: int = 0
    computeUsage: float = 0.0
    storageUsage: float = 0.0
    estimatedCost: float = 0.0
    payload: Dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def from_metadata(
        cls,
        lineage: str,
        metadata: Dict[str, Any],
        payload: Optional[Dict[str, Any]] = None,
    ) -> "AdvisoryResult":
        return cls(
            lineage=lineage,
            confidence=metadata["confidence"],
            confidenceInterval=ConfidenceInterval(**metadata["confidenceInterval"]),
            modelVersion=metadata["modelVersion"],
            evaluationVersion=metadata["evaluationVersion"],
            tokenUsage=metadata.get("tokenUsage", 0),
            computeUsage=metadata.get("computeUsage", 0.0),
            storageUsage=metadata.get("storageUsage", 0.0),
            estimatedCost=metadata.get("estimatedCost", 0.0),
            payload=payload or {},
        )
