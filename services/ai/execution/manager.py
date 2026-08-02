"""Execution manager — sole gateway entry into the queue layer.

Express (and any public API) must call this layer, never workers directly.
Workers consume via QueueManager.claim and are started separately (Step 3).
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from task_queue.manager import QueueManager, get_queue_manager
from task_queue.names import DEFAULT_MAX_ATTEMPTS, DEFAULT_VISIBILITY_TIMEOUT_MS, validate_queue_name
from task_queue.types import QueueMessage


class ExecutionManager:
    """Thin orchestration boundary: validate capability → enqueue → return task id."""

    def __init__(self, queues: Optional[QueueManager] = None) -> None:
        self._queues = queues or get_queue_manager()

    def submit(
        self,
        capability: str,
        payload: Dict[str, Any],
        *,
        organization_id: Optional[str] = None,
        document_id: Optional[str] = None,
        legacy_job_public_code: Optional[str] = None,
        max_attempts: int = DEFAULT_MAX_ATTEMPTS,
        timeout_ms: int = DEFAULT_VISIBILITY_TIMEOUT_MS,
        task_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        queue = validate_queue_name(capability)
        message = QueueMessage.create(
            queue,
            payload,
            task_id=task_id,
            max_attempts=max_attempts,
            timeout_ms=timeout_ms,
            legacy_job_public_code=legacy_job_public_code,
            organization_id=organization_id,
            document_id=document_id,
        )
        self._queues.enqueue(message)
        return {
            "taskId": message.task_id,
            "queue": queue,
            "status": "pending",
            "legacyJobPublicCode": legacy_job_public_code,
            "advisoryOnly": True,
        }

    def status(self, task_id: str) -> Dict[str, Any]:
        meta = self._queues.get_status(task_id)
        return {
            "taskId": task_id,
            "status": meta.get("status", "unknown"),
            "queue": meta.get("queue"),
            "attempt": meta.get("attempt"),
            "legacyJobPublicCode": meta.get("legacy_job_public_code"),
            "error": meta.get("error"),
            "advisoryOnly": True,
        }

    def cancel(self, task_id: str) -> Dict[str, Any]:
        self._queues.cancel(task_id)
        return {"taskId": task_id, "status": "cancelled", "advisoryOnly": True}

    def health(self) -> Dict[str, Any]:
        return self._queues.health()
