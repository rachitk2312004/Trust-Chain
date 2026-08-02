"""Queue manager — enqueue / claim / ack / retry / dead-letter.

Workers and Express must never call this layer in a way that couples Express to
worker processes. Express talks to an Execution manager; the Execution manager
talks to this QueueManager.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import json
import os
import time

from .backend import QueueBackend
from .leases import LeaseManager
from .locks import hold_lock
from .memory_backend import MemoryQueueBackend
from .names import (
    CAPABILITY_QUEUES,
    DEFAULT_MAX_ATTEMPTS,
    DEFAULT_VISIBILITY_TIMEOUT_MS,
    dlq_key,
    processing_key,
    queue_key,
    task_meta_key,
    validate_queue_name,
)
from .timeouts import retry_delay_seconds
from .types import QueueMessage, TaskState


def create_backend(redis_url: Optional[str] = None) -> QueueBackend:
    url = redis_url if redis_url is not None else os.environ.get("REDIS_URL")
    if url:
        try:
            from .redis_backend import RedisQueueBackend

            return RedisQueueBackend(url)
        except Exception:
            # Fall back to memory so CI/local stay green without Redis.
            return MemoryQueueBackend()
    return MemoryQueueBackend()


class QueueManager:
    """Manages per-capability queues + paired dead-letter queues."""

    def __init__(self, backend: Optional[QueueBackend] = None) -> None:
        self.backend = backend or create_backend()
        self.leases = LeaseManager(self.backend)

    def health(self) -> Dict[str, Any]:
        depths = {name: self.depth(name) for name in sorted(CAPABILITY_QUEUES)}
        dlq_depths = {name: self.dlq_depth(name) for name in sorted(CAPABILITY_QUEUES)}
        return {
            "ok": self.backend.ping(),
            "backend": type(self.backend).__name__,
            "queues": depths,
            "dead_letter": dlq_depths,
        }

    def enqueue(self, message: QueueMessage) -> str:
        validate_queue_name(message.queue)
        message.available_at = max(message.available_at, time.time())
        self._store_meta(message, TaskState.PENDING.value)
        self.backend.rpush(queue_key(message.queue), json.dumps(message.to_dict()))
        return message.task_id

    def depth(self, queue: str) -> int:
        return self.backend.llen(queue_key(validate_queue_name(queue)))

    def dlq_depth(self, queue: str) -> int:
        return self.backend.llen(dlq_key(validate_queue_name(queue)))

    def claim(self, queue: str, worker_id: str) -> Optional[QueueMessage]:
        """Claim next available message; skip delayed retries."""
        validate_queue_name(queue)
        if not self.leases.is_alive(worker_id):
            raise RuntimeError(f"Worker lease expired or missing: {worker_id}")

        with hold_lock(self.backend, f"claim:{queue}", wait_ms=2000):
            deferred: List[str] = []
            claimed: Optional[QueueMessage] = None
            try:
                while True:
                    raw = self.backend.lpop(queue_key(queue))
                    if raw is None:
                        break
                    msg = QueueMessage.from_dict(json.loads(raw))
                    if msg.available_at > time.time():
                        deferred.append(raw)
                        continue
                    msg.attempt += 1
                    self._store_meta(msg, TaskState.PROCESSING.value, worker_id=worker_id)
                    self.backend.rpush(processing_key(queue), json.dumps(msg.to_dict()))
                    claimed = msg
                    break
            finally:
                for item in deferred:
                    self.backend.rpush(queue_key(queue), item)
            return claimed

    def ack(self, message: QueueMessage, *, result: Optional[Dict[str, Any]] = None) -> None:
        self._remove_from_processing(message)
        meta = {
            "status": TaskState.COMPLETED.value,
            "result": json.dumps(result or {}),
            "completed_at": str(time.time()),
        }
        self.backend.hset(task_meta_key(message.task_id), meta)

    def nack(
        self,
        message: QueueMessage,
        *,
        error: str,
        force_dead_letter: bool = False,
    ) -> str:
        """Retry with backoff or move to dead-letter queue."""
        self._remove_from_processing(message)
        if force_dead_letter or message.attempt >= message.max_attempts:
            return self.dead_letter(message, error=error)

        message.available_at = time.time() + retry_delay_seconds(message.attempt)
        self._store_meta(message, TaskState.RETRYING.value, error=error)
        self.backend.rpush(queue_key(message.queue), json.dumps(message.to_dict()))
        return TaskState.RETRYING.value

    def dead_letter(self, message: QueueMessage, *, error: str) -> str:
        self._remove_from_processing(message)
        self._store_meta(message, TaskState.DEAD_LETTER.value, error=error)
        payload = message.to_dict()
        payload["error"] = error
        payload["dead_lettered_at"] = time.time()
        self.backend.rpush(dlq_key(message.queue), json.dumps(payload))
        return TaskState.DEAD_LETTER.value

    def cancel(self, task_id: str) -> None:
        self.backend.hset(task_meta_key(task_id), {"status": TaskState.CANCELLED.value})

    def get_status(self, task_id: str) -> Dict[str, str]:
        return self.backend.hgetall(task_meta_key(task_id))

    def reclaim_expired(self, queue: str) -> int:
        """Move timed-out processing messages back for retry / DLQ."""
        validate_queue_name(queue)
        reclaimed = 0
        with hold_lock(self.backend, f"reclaim:{queue}", wait_ms=2000):
            raw_items = self.backend.lrange(processing_key(queue), 0, -1)
            # Drain and rebuild
            while self.backend.lpop(processing_key(queue)) is not None:
                pass
            for raw in raw_items:
                msg = QueueMessage.from_dict(json.loads(raw))
                meta = self.get_status(msg.task_id)
                started = float(meta.get("started_at") or msg.enqueued_at)
                if (time.time() - started) * 1000.0 >= msg.timeout_ms:
                    self.nack(msg, error="visibility_timeout")
                    reclaimed += 1
                else:
                    self.backend.rpush(processing_key(queue), raw)
        return reclaimed

    def _store_meta(
        self,
        message: QueueMessage,
        status: str,
        *,
        worker_id: Optional[str] = None,
        error: Optional[str] = None,
    ) -> None:
        mapping: Dict[str, Any] = {
            "task_id": message.task_id,
            "queue": message.queue,
            "status": status,
            "attempt": message.attempt,
            "max_attempts": message.max_attempts,
            "updated_at": time.time(),
        }
        if worker_id:
            mapping["worker_id"] = worker_id
            mapping["started_at"] = time.time()
        if message.legacy_job_public_code:
            mapping["legacy_job_public_code"] = message.legacy_job_public_code
        if error:
            mapping["error"] = error
        self.backend.hset(task_meta_key(message.task_id), mapping)

    def _remove_from_processing(self, message: QueueMessage) -> None:
        key = processing_key(message.queue)
        items = self.backend.lrange(key, 0, -1)
        while self.backend.lpop(key) is not None:
            pass
        for raw in items:
            data = json.loads(raw)
            if data.get("task_id") != message.task_id:
                self.backend.rpush(key, raw)


_MANAGER: Optional[QueueManager] = None


def get_queue_manager() -> QueueManager:
    global _MANAGER
    if _MANAGER is None:
        _MANAGER = QueueManager()
    return _MANAGER


def reset_queue_manager_for_tests() -> None:
    global _MANAGER
    _MANAGER = QueueManager(MemoryQueueBackend())
