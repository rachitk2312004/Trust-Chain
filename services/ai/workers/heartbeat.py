"""Worker heartbeat loop helpers."""

from __future__ import annotations

from typing import Callable, Optional
import threading
import time

from .lease_manager import WorkerLeaseManager
from task_queue.names import DEFAULT_HEARTBEAT_INTERVAL_MS


class HeartbeatService:
    """Periodically renews a worker lease until stopped."""

    def __init__(
        self,
        leases: WorkerLeaseManager,
        worker_id: str,
        *,
        interval_ms: int = DEFAULT_HEARTBEAT_INTERVAL_MS,
        on_failure: Optional[Callable[[], None]] = None,
    ) -> None:
        self._leases = leases
        self._worker_id = worker_id
        self._interval_s = max(interval_ms, 100) / 1000.0
        self._on_failure = on_failure
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self.last_heartbeat_at: Optional[float] = None
        self.failures = 0

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name=f"hb-{self._worker_id}", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)

    def beat_once(self) -> bool:
        lease = self._leases.renew(self._worker_id)
        if lease is None:
            self.failures += 1
            if self._on_failure:
                self._on_failure()
            return False
        self.last_heartbeat_at = time.time()
        return True

    def _run(self) -> None:
        while not self._stop.is_set():
            self.beat_once()
            self._stop.wait(self._interval_s)
