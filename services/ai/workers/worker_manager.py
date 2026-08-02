"""Worker manager — pool of capability workers (no Express / public API)."""

from __future__ import annotations

from typing import Dict, Iterable, List, Optional
import threading

from task_queue.manager import QueueManager, get_queue_manager
from task_queue.names import CAPABILITY_QUEUES, validate_queue_name

from .base_worker import BaseWorker
from .metrics import WorkerMetrics, get_metrics, reset_metrics_for_tests


class WorkerManager:
    """Owns one BaseWorker per capability (or a subset)."""

    def __init__(
        self,
        queues: Optional[QueueManager] = None,
        *,
        capabilities: Optional[Iterable[str]] = None,
        metrics: Optional[WorkerMetrics] = None,
    ) -> None:
        self.queues = queues or get_queue_manager()
        self.metrics = metrics or get_metrics()
        caps = list(capabilities) if capabilities is not None else sorted(CAPABILITY_QUEUES)
        for cap in caps:
            validate_queue_name(cap)
        self._workers: Dict[str, BaseWorker] = {
            cap: BaseWorker(cap, self.queues, metrics=self.metrics) for cap in caps
        }
        self._threads: Dict[str, threading.Thread] = {}
        self.metrics.set_worker_count(len(self._workers))

    @property
    def workers(self) -> Dict[str, BaseWorker]:
        return dict(self._workers)

    def start_all(self) -> List[str]:
        ids: List[str] = []
        for worker in self._workers.values():
            ids.append(worker.start())
        self.metrics.set_worker_count(len(self._workers))
        return ids

    def stop_all(self) -> None:
        for cap, thread in list(self._threads.items()):
            worker = self._workers[cap]
            worker.stop()
            thread.join(timeout=2.0)
        self._threads.clear()
        for worker in self._workers.values():
            if worker.worker_id:
                worker.stop()

    def run_worker_loop(self, capability: str, *, max_jobs: Optional[int] = None) -> None:
        worker = self._workers[validate_queue_name(capability)]
        worker.max_jobs = max_jobs
        if not worker.worker_id:
            worker.start()
        worker.run_forever()

    def start_background(self, *, max_jobs: Optional[int] = None) -> None:
        """Start each capability worker on a daemon thread."""
        self.start_all()
        for cap, worker in self._workers.items():
            worker.max_jobs = max_jobs
            thread = threading.Thread(
                target=worker.run_forever,
                name=f"worker-{cap}",
                daemon=True,
            )
            self._threads[cap] = thread
            thread.start()

    def poll_all_once(self) -> int:
        """Synchronous single-pass poll across all workers (useful in tests)."""
        if not any(w.worker_id for w in self._workers.values()):
            self.start_all()
        done = 0
        for worker in self._workers.values():
            if worker.poll_once():
                done += 1
        return done

    def drain(self, *, max_rounds: int = 100) -> int:
        """Process until queues empty or max_rounds hit. Returns jobs processed."""
        processed = 0
        for _ in range(max_rounds):
            n = self.poll_all_once()
            if n == 0:
                # Also try reclaim then one more pass
                for cap in self._workers:
                    self.queues.reclaim_expired(cap)
                n = self.poll_all_once()
                if n == 0:
                    break
            processed += n
        return processed

    def health(self) -> Dict[str, object]:
        return {
            "workers": {cap: w.health() for cap, w in self._workers.items()},
            "metrics": self.metrics.snapshot(),
            "queues": self.queues.health(),
            "advisoryOnly": True,
        }


def create_default_worker_manager(queues: Optional[QueueManager] = None) -> WorkerManager:
    return WorkerManager(queues=queues)


__all__ = ["WorkerManager", "create_default_worker_manager", "reset_metrics_for_tests"]
