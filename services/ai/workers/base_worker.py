"""Base worker — claim → adapter executor → ack / retry / dead-letter."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import socket
import time

from security.guard import SecurityViolation
from task_queue.manager import QueueManager
from task_queue.types import QueueMessage, TaskState

from .executors import get_executor
from .heartbeat import HeartbeatService
from .lease_manager import WorkerLeaseManager
from .lineage_manager import LineageManager
from .metrics import WorkerMetrics, get_metrics
from .retry_manager import RetryManager
from .state_machine import InvalidStateTransition, transition
from .timeout_manager import TaskTimeoutError, TimeoutManager


class BaseWorker:
    """Single-capability worker process (in-process loop; no Express / chain access)."""

    def __init__(
        self,
        capability: str,
        queues: QueueManager,
        *,
        metrics: Optional[WorkerMetrics] = None,
        idle_sleep_s: float = 0.05,
        max_jobs: Optional[int] = None,
    ) -> None:
        self.capability = capability
        self.queues = queues
        self.leases = WorkerLeaseManager(queues)
        self.retry = RetryManager()
        self.timeouts = TimeoutManager()
        self.lineage = LineageManager()
        self.metrics = metrics or get_metrics()
        self.idle_sleep_s = idle_sleep_s
        self.max_jobs = max_jobs
        self.hostname = socket.gethostname()
        self.worker_id: Optional[str] = None
        self._heartbeat: Optional[HeartbeatService] = None
        self._running = False
        self.jobs_processed = 0

    def start(self) -> str:
        lease = self.leases.acquire(capabilities=[self.capability])
        self.worker_id = lease.worker_id
        self._heartbeat = HeartbeatService(self.leases, self.worker_id)
        self._heartbeat.start()
        self._running = True
        return self.worker_id

    def stop(self) -> None:
        self._running = False
        if self._heartbeat:
            self._heartbeat.stop()
        if self.worker_id:
            self.leases.release(self.worker_id)

    def run_forever(self) -> None:
        if not self.worker_id:
            self.start()
        assert self.worker_id is not None
        while self._running:
            if self.max_jobs is not None and self.jobs_processed >= self.max_jobs:
                break
            processed = self.poll_once()
            if not processed:
                time.sleep(self.idle_sleep_s)

    def poll_once(self) -> bool:
        """Claim and process at most one message. Returns True if work was done."""
        if not self.worker_id:
            raise RuntimeError("Worker not started")
        if not self.leases.is_alive(self.worker_id):
            self.metrics.record_lease_expiration()
            # Re-acquire lease and continue
            lease = self.leases.acquire(worker_id=self.worker_id, capabilities=[self.capability])
            self.worker_id = lease.worker_id

        self.metrics.set_queue_depth(self.capability, self.queues.depth(self.capability))
        self.timeouts.reclaim_queue(self.queues, self.capability)

        message = self.queues.claim(self.capability, self.worker_id)
        if message is None:
            return False

        self._process(message)
        self.jobs_processed += 1
        return True

    def _process(self, message: QueueMessage) -> Dict[str, Any]:
        self.metrics.task_started()
        started = time.time()
        watch = self.timeouts.start(message)
        try:
            transition(TaskState.PENDING, TaskState.PROCESSING)
        except InvalidStateTransition:
            # Claim already moved meta to processing; allow PROCESSING as current.
            pass

        try:
            # Cancelled tasks must not execute.
            status = self.queues.get_status(message.task_id)
            if status.get("status") == TaskState.CANCELLED.value:
                transition(TaskState.PROCESSING, TaskState.CANCELLED)
                self.metrics.task_finished(duration_ms=(time.time() - started) * 1000.0, ok=False)
                return {"status": "cancelled"}

            self.timeouts.check(watch)
            executor = get_executor(self.capability)
            result = executor.execute(message)
            self.timeouts.check(watch)

            lineage = self.lineage.build_chain(
                document_id=message.document_id,
                task_public_code=message.task_id,
                capability=self.capability,
                result_meta={
                    "modelVersion": result.get("modelVersion"),
                    "confidence": result.get("confidence"),
                },
            )
            envelope = {
                **result,
                "taskId": message.task_id,
                "workerId": self.worker_id,
                "attempt": message.attempt,
                "lineage": lineage,
                "advisoryOnly": True,
            }
            transition(TaskState.PROCESSING, TaskState.COMPLETED)
            self.queues.ack(message, result=envelope)
            self.metrics.task_finished(duration_ms=(time.time() - started) * 1000.0, ok=True)
            return envelope
        except TaskTimeoutError as exc:
            return self._fail(message, str(exc), started=started, force_dead_letter=False)
        except SecurityViolation as exc:
            return self._fail(message, str(exc), started=started, force_dead_letter=True)
        except Exception as exc:  # noqa: BLE001 — worker must never crash the pool
            return self._fail(message, str(exc), started=started, force_dead_letter=False)

    def _fail(
        self,
        message: QueueMessage,
        error: str,
        *,
        started: float,
        force_dead_letter: bool,
    ) -> Dict[str, Any]:
        decision = self.retry.decide(message, error=error, force_dead_letter=force_dead_letter)
        state = self.retry.apply(self.queues, message, decision)
        if decision.action == "retry":
            self.metrics.record_retry()
        else:
            self.metrics.record_dead_letter()
        self.metrics.task_finished(duration_ms=(time.time() - started) * 1000.0, ok=False)
        return {"status": state, "error": error}

    def health(self) -> Dict[str, Any]:
        return {
            "workerId": self.worker_id,
            "capability": self.capability,
            "running": self._running,
            "jobsProcessed": self.jobs_processed,
            "lease": self.leases.snapshot(self.worker_id) if self.worker_id else None,
            "hostname": self.hostname,
        }
