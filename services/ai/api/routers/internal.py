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
from execution.manager import ExecutionManager
from task_queue.manager import get_queue_manager
from task_queue.names import validate_queue_name

router = APIRouter(prefix="/internal", tags=["internal"])


class OcrRequest(BaseModel):
    imageData: str = Field(default="", description="Base64 or hex image payload")
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


def _decode_payload(data: str) -> bytes:
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
    raw = _decode_payload(body.imageData)
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


class EmbedRequest(BaseModel):
    text: str = ""
    operation: str = "embed"


class EvaluateRequest(BaseModel):
    predicted: float = 0.0
    reference: float = 0.0
    operation: str = "evaluate"


class ExplainRequest(BaseModel):
    text: str = ""
    kind: str = "generic"
    operation: str = "explain"


@router.post("/embed")
def embed_endpoint(body: EmbedRequest) -> Dict[str, Any]:
    _guard(body.operation)
    get_analytics().increment("embed")
    chunks = chunk_text(body.text) if body.text else []
    vectors = [deterministic_embedding(c) for c in chunks] if chunks else []
    if not vectors and body.text:
        vectors = [deterministic_embedding(body.text)]
        chunks = [body.text]
    return {
        "chunks": chunks,
        "embeddings": vectors,
        "count": len(vectors),
        "advisoryOnly": True,
        "reviewState": DEFAULT_REVIEW_STATE.value,
    }


@router.post("/evaluate")
def evaluate_endpoint(body: EvaluateRequest) -> Dict[str, Any]:
    from evaluation.metrics import evaluate_confidence

    _guard(body.operation)
    get_analytics().increment("evaluate")
    result = evaluate_confidence(body.predicted, body.reference)
    result["advisoryOnly"] = True
    result["reviewState"] = DEFAULT_REVIEW_STATE.value
    return result


@router.post("/explain")
def explain_endpoint(body: ExplainRequest) -> Dict[str, Any]:
    from explainability.attribution.attribution import build_attribution
    from explainability.evidence.evidence import build_evidence
    from explainability.reasoning.reasoning import build_reasoning
    from explainability.summaries.summaries import build_summary

    _guard(body.operation)
    get_analytics().increment("explain")
    summary = build_summary(body.text)
    return {
        "kind": body.kind,
        "evidence": build_evidence(body.kind, spans=[{"text": body.text[:80]}]),
        "attribution": build_attribution(["text"], [1.0]),
        "reasoning": build_reasoning([f"Explain {body.kind}"], summary["summary"]),
        "summary": summary,
        "advisoryOnly": True,
        "reviewState": DEFAULT_REVIEW_STATE.value,
    }


@router.post("/pipeline")
def pipeline_endpoint(body: PipelineRequest) -> Dict[str, Any]:
    """Queue-backed pipeline (OCR via execution manager + drain). No in-process dual stack."""
    _guard(body.operation)
    get_analytics().increment("pipeline")
    queues = get_queue_manager()
    mgr = ExecutionManager(queues)
    submitted = mgr.submit(
        "ocr",
        {
            "imageData": body.imageData,
            "engine": body.ocrEngine,
            "provider": body.provider,
        },
    )
    from workers.worker_manager import WorkerManager

    worker_mgr = WorkerManager(queues, capabilities=["ocr"])
    try:
        worker_mgr.drain(max_rounds=20)
    finally:
        worker_mgr.stop_all()
    record = mgr.status(submitted["taskId"])
    return {
        "jobId": submitted["taskId"],
        "status": record.get("status", "unknown"),
        "result": record.get("result"),
        "advisoryOnly": True,
        "reviewState": DEFAULT_REVIEW_STATE.value,
    }


@router.get("/jobs/{job_id}")
def job_status(job_id: str) -> Dict[str, Any]:
    record = ExecutionManager(get_queue_manager()).status(job_id)
    if record.get("status") in {None, "unknown"}:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "jobId": record.get("taskId", job_id),
        "status": record.get("status"),
        "queue": record.get("queue"),
        "result": record.get("result"),
        "error": record.get("error"),
        "advisoryOnly": True,
    }


@router.post("/policies/check")
def policies_check(body: PolicyRequest) -> Dict[str, Any]:
    _guard(body.operation)
    return check_all_policies(body.context)
