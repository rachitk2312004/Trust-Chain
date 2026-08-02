from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any, Dict, Optional
import time
import uuid


class TaskState(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"
    DEAD_LETTER = "dead_letter"


@dataclass
class QueueMessage:
    task_id: str
    queue: str
    payload: Dict[str, Any]
    attempt: int = 0
    max_attempts: int = 3
    timeout_ms: int = 120_000
    legacy_job_public_code: Optional[str] = None
    organization_id: Optional[str] = None
    document_id: Optional[str] = None
    enqueued_at: float = field(default_factory=time.time)
    available_at: float = field(default_factory=time.time)

    @staticmethod
    def create(
        queue: str,
        payload: Dict[str, Any],
        *,
        task_id: Optional[str] = None,
        max_attempts: int = 3,
        timeout_ms: int = 120_000,
        legacy_job_public_code: Optional[str] = None,
        organization_id: Optional[str] = None,
        document_id: Optional[str] = None,
    ) -> "QueueMessage":
        return QueueMessage(
            task_id=task_id or f"AI-TASK-{uuid.uuid4().hex[:8].upper()}",
            queue=queue,
            payload=payload,
            max_attempts=max_attempts,
            timeout_ms=timeout_ms,
            legacy_job_public_code=legacy_job_public_code,
            organization_id=organization_id,
            document_id=document_id,
        )

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> "QueueMessage":
        return QueueMessage(
            task_id=str(data["task_id"]),
            queue=str(data["queue"]),
            payload=dict(data.get("payload") or {}),
            attempt=int(data.get("attempt") or 0),
            max_attempts=int(data.get("max_attempts") or 3),
            timeout_ms=int(data.get("timeout_ms") or 120_000),
            legacy_job_public_code=data.get("legacy_job_public_code"),
            organization_id=data.get("organization_id"),
            document_id=data.get("document_id"),
            enqueued_at=float(data.get("enqueued_at") or time.time()),
            available_at=float(data.get("available_at") or time.time()),
        )


@dataclass
class WorkerLease:
    worker_id: str
    lease_expiration: float
    heartbeat_timestamp: float
    last_seen_at: float
    capabilities: list[str] = field(default_factory=list)

    def is_expired(self, now: Optional[float] = None) -> bool:
        return (now or time.time()) >= self.lease_expiration

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> "WorkerLease":
        return WorkerLease(
            worker_id=str(data["worker_id"]),
            lease_expiration=float(data["lease_expiration"]),
            heartbeat_timestamp=float(data["heartbeat_timestamp"]),
            last_seen_at=float(data["last_seen_at"]),
            capabilities=list(data.get("capabilities") or []),
        )
