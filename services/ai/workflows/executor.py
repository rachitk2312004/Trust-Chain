from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional
import time
import uuid


class JobStatus:
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class JobRecord:
    job_id: str
    status: str
    steps: List[str]
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    completed_at: Optional[float] = None


class InProcessExecutor:
    """In-process workflow executor — no Redis required."""

    def __init__(self) -> None:
        self._jobs: Dict[str, JobRecord] = {}

    def submit(self, steps: List[Callable[..., Dict[str, Any]]], payload: Dict[str, Any]) -> str:
        job_id = str(uuid.uuid4())
        record = JobRecord(job_id=job_id, status=JobStatus.RUNNING, steps=[s.__name__ for s in steps])
        self._jobs[job_id] = record
        try:
            context = dict(payload)
            for step in steps:
                context = step(context)
            record.result = context
            record.status = JobStatus.COMPLETED
        except Exception as exc:  # noqa: BLE001
            record.status = JobStatus.FAILED
            record.error = str(exc)
        record.completed_at = time.time()
        return job_id

    def get_status(self, job_id: str) -> Optional[JobRecord]:
        return self._jobs.get(job_id)


# Optional Celery stub — not required for CI
def celery_task_stub(name: str):
    def decorator(fn):
        fn.celery_task = name
        return fn

    return decorator
