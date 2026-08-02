"""Optional legacy workflow helpers.

Phase 2 Step 6: Express → Execution client → FastAPI execution API is the only
production path. InProcessExecutor is retained for isolated unit experiments only
and must not be wired into /internal routers.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional
import uuid


@dataclass
class JobRecord:
    job_id: str
    status: str
    steps: List[str] = field(default_factory=list)
    result: Any = None
    error: Optional[str] = None


class JobStatus:
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class InProcessExecutor:
    """Deprecated dual-stack helper — do not use from API routers."""

    def __init__(self) -> None:
        self._jobs: Dict[str, JobRecord] = {}

    def submit(self, steps: List[Callable[..., Any]], payload: Dict[str, Any]) -> str:
        job_id = f"WF-{uuid.uuid4().hex[:8].upper()}"
        record = JobRecord(job_id=job_id, status=JobStatus.RUNNING, steps=[s.__name__ for s in steps])
        self._jobs[job_id] = record
        ctx = dict(payload)
        try:
            for step in steps:
                ctx = step(ctx) if callable(step) else ctx
            record.status = JobStatus.COMPLETED
            record.result = ctx
        except Exception as exc:  # noqa: BLE001
            record.status = JobStatus.FAILED
            record.error = str(exc)
        return job_id

    def get_status(self, job_id: str) -> Optional[JobRecord]:
        return self._jobs.get(job_id)


def celery_task_stub(name: str):
    """No-op decorator placeholder for optional Celery wiring in non-CI envs."""

    def decorator(fn):
        fn.celery_name = name
        return fn

    return decorator
