"""In-process worker metrics (ephemeral — not a source of truth)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict
import threading
import time


@dataclass
class WorkerMetrics:
    queue_depth: Dict[str, int] = field(default_factory=dict)
    active_tasks: int = 0
    lease_expirations: int = 0
    retry_count: int = 0
    dead_letter_count: int = 0
    worker_count: int = 0
    execution_times_ms: list[float] = field(default_factory=list)
    completed_count: int = 0
    failed_count: int = 0
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def set_queue_depth(self, queue: str, depth: int) -> None:
        with self._lock:
            self.queue_depth[queue] = depth

    def set_worker_count(self, count: int) -> None:
        with self._lock:
            self.worker_count = count

    def task_started(self) -> None:
        with self._lock:
            self.active_tasks += 1

    def task_finished(self, *, duration_ms: float, ok: bool) -> None:
        with self._lock:
            self.active_tasks = max(0, self.active_tasks - 1)
            self.execution_times_ms.append(duration_ms)
            if ok:
                self.completed_count += 1
            else:
                self.failed_count += 1

    def record_retry(self) -> None:
        with self._lock:
            self.retry_count += 1

    def record_dead_letter(self) -> None:
        with self._lock:
            self.dead_letter_count += 1

    def record_lease_expiration(self) -> None:
        with self._lock:
            self.lease_expirations += 1

    def average_execution_time(self) -> float:
        with self._lock:
            if not self.execution_times_ms:
                return 0.0
            return sum(self.execution_times_ms) / len(self.execution_times_ms)

    def snapshot(self) -> Dict[str, object]:
        with self._lock:
            avg = (
                sum(self.execution_times_ms) / len(self.execution_times_ms)
                if self.execution_times_ms
                else 0.0
            )
            return {
                "queueDepth": dict(self.queue_depth),
                "activeTasks": self.active_tasks,
                "leaseExpirations": self.lease_expirations,
                "retryCount": self.retry_count,
                "deadLetterCount": self.dead_letter_count,
                "workerCount": self.worker_count,
                "averageExecutionTime": round(avg, 3),
                "completedCount": self.completed_count,
                "failedCount": self.failed_count,
                "collectedAt": time.time(),
            }


_METRICS = WorkerMetrics()


def get_metrics() -> WorkerMetrics:
    return _METRICS


def reset_metrics_for_tests() -> None:
    global _METRICS
    _METRICS = WorkerMetrics()
