"""Retry / dead-letter decisions for workers."""

from __future__ import annotations

from dataclasses import dataclass

from task_queue.manager import QueueManager
from task_queue.types import QueueMessage, TaskState
from .state_machine import transition


@dataclass
class RetryDecision:
    action: str  # retry | dead_letter | fail
    state: str
    error: str


class RetryManager:
    def decide(self, message: QueueMessage, *, error: str, force_dead_letter: bool = False) -> RetryDecision:
        if force_dead_letter or message.attempt >= message.max_attempts:
            transition(TaskState.PROCESSING, TaskState.DEAD_LETTER)
            return RetryDecision(
                action="dead_letter",
                state=TaskState.DEAD_LETTER.value,
                error=error,
            )
        transition(TaskState.PROCESSING, TaskState.RETRYING)
        return RetryDecision(action="retry", state=TaskState.RETRYING.value, error=error)

    def apply(self, queues: QueueManager, message: QueueMessage, decision: RetryDecision) -> str:
        if decision.action == "dead_letter":
            return queues.dead_letter(message, error=decision.error)
        return queues.nack(message, error=decision.error, force_dead_letter=False)
