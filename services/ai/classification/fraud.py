from typing import Any, Dict, List, Optional

from explainability.attribution.attribution import build_attribution
from explainability.evidence.evidence import build_evidence
from explainability.reasoning.reasoning import build_reasoning
from models.routing.routing import route_request
from models.versions import EVALUATION_VERSION
from utils.confidence import build_result_metadata
from utils.lineage import generate_lineage_code
from utils.schemas import DEFAULT_REVIEW_STATE


def assess_fraud_risk(
    text: str,
    *,
    provider: Optional[str] = None,
    signals: Optional[List[str]] = None,
) -> Dict[str, Any]:
    routing = route_request("fraud", provider=provider)
    lineage = generate_lineage_code(text[:64] if text else None)
    detected = signals or []
    if "mismatch" in text.lower():
        detected.append("text_mismatch")
    risk_score = min(1.0, 0.2 + len(detected) * 0.15)
    metadata = build_result_metadata(
        confidence=0.65,
        model_version=routing["modelVersion"],
        evaluation_version=EVALUATION_VERSION,
        token_usage=len(text.split()),
        compute_usage=0.003,
        estimated_cost=0.0002,
    )
    explainability = {
        "evidence": build_evidence("fraud-scan", spans=[{"text": text[:80]}], lineage=lineage),
        "attribution": build_attribution(["signals", "text_length"], [0.6, 0.4]),
        "reasoning": build_reasoning(
            ["Scan text", "Collect signals", "Score risk"],
            f"Advisory risk score {risk_score:.2f}",
        ),
    }
    return {
        "lineage": lineage,
        "routing": routing,
        "riskScore": round(risk_score, 4),
        "signals": detected,
        "advisoryOnly": True,
        "reviewState": DEFAULT_REVIEW_STATE.value,
        "explainability": explainability,
        **metadata,
    }
