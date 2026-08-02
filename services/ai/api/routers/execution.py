"""Internal execution API — Express talks here; never expose as public internet API.

Wraps ExecutionManager (+ optional drain via WorkerManager). Does not modify worker internals.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from adapters.adapter_factory import get_adapter_factory
from execution.manager import ExecutionManager
from task_queue.manager import get_queue_manager
from task_queue.names import CAPABILITY_QUEUES, validate_queue_name

router = APIRouter(prefix="/internal/execution", tags=["execution"])


def _execution() -> ExecutionManager:
    return ExecutionManager(get_queue_manager())


class SubmitRequest(BaseModel):
    capability: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    organizationId: Optional[str] = None
    documentId: Optional[str] = None
    legacyJobPublicCode: Optional[str] = None
    taskId: Optional[str] = None
    maxAttempts: int = 3
    timeoutMs: int = 120_000
    operation: str = "execution_submit"


class DrainRequest(BaseModel):
    capabilities: Optional[List[str]] = None
    maxRounds: int = 50
    operation: str = "execution_drain"


@router.post("/submit")
def submit(body: SubmitRequest) -> Dict[str, Any]:
    try:
        validate_queue_name(body.capability)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    result = _execution().submit(
        body.capability,
        body.payload,
        organization_id=body.organizationId,
        document_id=body.documentId,
        legacy_job_public_code=body.legacyJobPublicCode,
        max_attempts=body.maxAttempts,
        timeout_ms=body.timeoutMs,
        task_id=body.taskId,
    )
    return result


@router.get("/tasks/{task_id}")
def task_status(task_id: str) -> Dict[str, Any]:
    return _execution().status(task_id)


@router.post("/cancel/{task_id}")
def cancel_task(task_id: str) -> Dict[str, Any]:
    return _execution().cancel(task_id)


@router.post("/drain")
def drain(body: DrainRequest) -> Dict[str, Any]:
    """Process queued work in-process (CI / local). Not a public Express route."""
    from workers.worker_manager import WorkerManager

    queues = get_queue_manager()
    caps = body.capabilities or sorted(CAPABILITY_QUEUES)
    for cap in caps:
        try:
            validate_queue_name(cap)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    mgr = WorkerManager(queues, capabilities=caps)
    try:
        processed = mgr.drain(max_rounds=body.maxRounds)
        return {
            "processed": processed,
            "health": mgr.health(),
            "advisoryOnly": True,
        }
    finally:
        mgr.stop_all()


@router.get("/health")
def execution_health() -> Dict[str, Any]:
    queues = get_queue_manager()
    q_health = queues.health()
    adapter_health = get_adapter_factory().health()
    return {
        "status": "ok" if q_health.get("ok") else "degraded",
        "queues": q_health,
        "adapters": adapter_health,
        "execution": _execution().health(),
        "leases": {"note": "lease details available per worker after drain/start"},
        "advisoryOnly": True,
    }


@router.get("/models")
def list_models() -> Dict[str, Any]:
    """Catalog of adapter-backed capabilities (stub/fallback configuration)."""
    models = []
    for capability in sorted(CAPABILITY_QUEUES) + ["explainability"]:
        models.append(
            {
                "modelId": f"AI-MODEL-{capability.upper()[:8]}",
                "modelVersion": f"MODEL-VERSION-{capability.upper()[:8]}",
                "capability": capability,
                "provider": "stub",
                "healthStatus": "healthy",
                "fallback": ["primary", "secondary", "stub"],
                "advisoryOnly": True,
            }
        )
    return {"models": models, "advisoryOnly": True}
