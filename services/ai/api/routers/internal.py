from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from analytics.counters import get_analytics
from classification.classifier import classify_document
from classification.fraud import assess_fraud_risk
from embeddings.vectors import chunk_text, deterministic_embedding, search_vectors
from extraction.extractor import extract_fields
from ocr.engine import get_engine, list_engines
from ocr.preprocess import preprocess_image
from policies.engine import check_all_policies
from security.guard import assert_safe_operation, SecurityViolation
from utils.schemas import DEFAULT_REVIEW_STATE
from workflows.executor import InProcessExecutor
from workflows.graph import build_default_pipeline

router = APIRouter(prefix="/internal", tags=["internal"])

_executor = InProcessExecutor()
_pipeline = build_default_pipeline()


class OcrRequest(BaseModel):
    imageData: str = Field(default="", description="Base64 or hex stub payload")
    engine: str = "stub"
    operation: str = "ocr"


class TextRequest(BaseModel):
    text: str = ""
    provider: Optional[str] = None
    operation: str = "process"


class SearchRequest(BaseModel):
    query: str
    corpus: list[str] = Field(default_factory=list)
    topK: int = 5
    operation: str = "search"


class PipelineRequest(BaseModel):
    imageData: str = ""
    provider: Optional[str] = None
    ocrEngine: str = "stub"
    operation: str = "pipeline"


class PolicyRequest(BaseModel):
    context: Dict[str, Any] = Field(default_factory=dict)
    operation: str = "policy_check"


def _decode_stub(data: str) -> bytes:
    if not data:
        return b""
    try:
        return bytes.fromhex(data)
    except ValueError:
        return data.encode("utf-8")


def _guard(op: str) -> None:
    try:
        assert_safe_operation(op)
    except SecurityViolation as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.get("/health")
def internal_health() -> Dict[str, str]:
    return {"status": "ok", "service": "trustchain-ai"}


@router.post("/ocr")
def ocr_endpoint(body: OcrRequest) -> Dict[str, Any]:
    _guard(body.operation)
    get_analytics().increment("ocr")
    raw = _decode_stub(body.imageData)
    preprocess_image(raw)
    engine = get_engine(body.engine)
    result = engine.run(raw)
    result["enginesAvailable"] = list_engines()
    result["reviewState"] = DEFAULT_REVIEW_STATE.value
    return result


@router.post("/extract")
def extract_endpoint(body: TextRequest) -> Dict[str, Any]:
    _guard(body.operation)
    get_analytics().increment("extract")
    return extract_fields(body.text, provider=body.provider)


@router.post("/classify")
def classify_endpoint(body: TextRequest) -> Dict[str, Any]:
    _guard(body.operation)
    get_analytics().increment("classify")
    return classify_document(body.text, provider=body.provider)


@router.post("/search")
def search_endpoint(body: SearchRequest) -> Dict[str, Any]:
    _guard(body.operation)
    get_analytics().increment("search")
    results = search_vectors(body.query, body.corpus, top_k=body.topK)
    return {
        "query": body.query,
        "results": results,
        "embeddingDim": len(deterministic_embedding(body.query)),
        "chunks": chunk_text(body.query),
        "advisoryOnly": True,
        "reviewState": DEFAULT_REVIEW_STATE.value,
    }


@router.post("/fraud")
def fraud_endpoint(body: TextRequest) -> Dict[str, Any]:
    _guard(body.operation)
    get_analytics().increment("fraud")
    return assess_fraud_risk(body.text, provider=body.provider)


@router.post("/pipeline")
def pipeline_endpoint(body: PipelineRequest) -> Dict[str, Any]:
    _guard(body.operation)
    get_analytics().increment("pipeline")
    payload = {
        "imageData": _decode_stub(body.imageData),
        "provider": body.provider,
        "ocrEngine": body.ocrEngine,
    }
    job_id = _executor.submit(_pipeline.steps, payload)
    record = _executor.get_status(job_id)
    return {
        "jobId": job_id,
        "status": record.status if record else "unknown",
        "result": record.result if record else None,
        "advisoryOnly": True,
        "reviewState": DEFAULT_REVIEW_STATE.value,
    }


@router.get("/jobs/{job_id}")
def job_status(job_id: str) -> Dict[str, Any]:
    record = _executor.get_status(job_id)
    if not record:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "jobId": record.job_id,
        "status": record.status,
        "steps": record.steps,
        "result": record.result,
        "error": record.error,
        "advisoryOnly": True,
    }


@router.post("/policies/check")
def policies_check(body: PolicyRequest) -> Dict[str, Any]:
    _guard(body.operation)
    return check_all_policies(body.context)
