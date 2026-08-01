from typing import Any, Dict, List, Optional

from models.routing.routing import route_request
from models.versions import EVALUATION_VERSION
from utils.confidence import build_result_metadata
from utils.lineage import generate_lineage_code
from utils.schemas import DEFAULT_REVIEW_STATE

LABELS = ["identity", "certificate", "invoice", "unknown"]


def classify_document(
    text: str,
    *,
    provider: Optional[str] = None,
    labels: Optional[List[str]] = None,
) -> Dict[str, Any]:
    routing = route_request("classify", provider=provider)
    lineage = generate_lineage_code(text[:64] if text else None)
    candidates = labels or LABELS
    label = candidates[hash(text) % len(candidates)] if text else "unknown"
    metadata = build_result_metadata(
        confidence=0.68,
        model_version=routing["modelVersion"],
        evaluation_version=EVALUATION_VERSION,
        token_usage=len(text.split()),
        compute_usage=0.001,
    )
    return {
        "lineage": lineage,
        "routing": routing,
        "label": label,
        "candidates": candidates,
        "reviewState": DEFAULT_REVIEW_STATE.value,
        "advisoryOnly": True,
        **metadata,
    }
