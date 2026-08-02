"""Execution timeout handling for workers."""

from __future__ import annotations

from dataclasses import dataclass
import time

from task_queue.manager import QueueManager
from task_queue.types import QueueMessage


class TaskTimeoutError(TimeoutError):
    pass


@dataclass
class TimeoutWatch:
    started_at: float
    timeout_ms: int

    def elapsed_ms(self) -> float:
        return (time.time() - self.started_at) * 1000.0

    def expired(self) -> bool:
        return self.elapsed_ms() >= self.timeout_ms


class TimeoutManager:
    def start(self, message: QueueMessage) -> TimeoutWatch:
        return TimeoutWatch(started_at=time.time(), timeout_ms=message.timeout_ms)

    def check(self, watch: TimeoutWatch) -> None:
        if watch.expired():
            raise TaskTimeoutError(f"Task exceeded timeout of {watch.timeout_ms}ms")

    def reclaim_queue(self, queues: QueueManager, queue_name: str) -> int:
        """Reclaim visibility-timed-out processing messages via queue manager."""
        return queues.reclaim_expired(queue_name)
