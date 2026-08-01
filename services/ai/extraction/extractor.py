from typing import Any, Dict, Optional

from models.routing.routing import route_request
from models.versions import EVALUATION_VERSION
from utils.confidence import build_result_metadata
from utils.lineage import generate_lineage_code
from utils.schemas import DEFAULT_REVIEW_STATE


def extract_fields(
    text: str,
    *,
    provider: Optional[str] = None,
    document_type: Optional[str] = None,
) -> Dict[str, Any]:
    routing = route_request("extract", provider=provider)
    lineage = generate_lineage_code(text[:64] if text else None)
    fields = {
        "documentType": document_type or "unknown",
        "rawTextLength": len(text),
        "fields": {"name": None, "idNumber": None, "issueDate": None},
    }
    metadata = build_result_metadata(
        confidence=0.72,
        model_version=routing["modelVersion"],
        evaluation_version=EVALUATION_VERSION,
        token_usage=len(text.split()) * 2,
        compute_usage=0.002,
        estimated_cost=0.0001,
    )
    return {
        "lineage": lineage,
        "routing": routing,
        "extraction": fields,
        "reviewState": DEFAULT_REVIEW_STATE.value,
        "advisoryOnly": True,
        **metadata,
    }
