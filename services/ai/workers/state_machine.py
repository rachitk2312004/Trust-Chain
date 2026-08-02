"""Worker task state machine.

pending → processing → completed
                     → retrying → processing …
                     → failed
                     → dead_letter
                     → cancelled
"""

from __future__ import annotations

from typing import Dict, FrozenSet, Set

from task_queue.types import TaskState

ALLOWED_TRANSITIONS: Dict[TaskState, FrozenSet[TaskState]] = {
    TaskState.PENDING: frozenset(
        {TaskState.PROCESSING, TaskState.CANCELLED, TaskState.DEAD_LETTER}
    ),
    TaskState.PROCESSING: frozenset(
        {
            TaskState.COMPLETED,
            TaskState.RETRYING,
            TaskState.FAILED,
            TaskState.DEAD_LETTER,
            TaskState.CANCELLED,
        }
    ),
    TaskState.RETRYING: frozenset(
        {TaskState.PROCESSING, TaskState.DEAD_LETTER, TaskState.CANCELLED, TaskState.FAILED}
    ),
    TaskState.COMPLETED: frozenset(),
    TaskState.FAILED: frozenset({TaskState.DEAD_LETTER}),
    TaskState.CANCELLED: frozenset(),
    TaskState.DEAD_LETTER: frozenset(),
}


class InvalidStateTransition(ValueError):
    pass


def parse_state(value: str) -> TaskState:
    try:
        return TaskState(value)
    except ValueError as exc:
        raise InvalidStateTransition(f"Unknown task state: {value}") from exc


def can_transition(current: TaskState, nxt: TaskState) -> bool:
    return nxt in ALLOWED_TRANSITIONS.get(current, frozenset())


def transition(current: str | TaskState, nxt: str | TaskState) -> TaskState:
    cur = current if isinstance(current, TaskState) else parse_state(current)
    nxt_state = nxt if isinstance(nxt, TaskState) else parse_state(nxt)
    if not can_transition(cur, nxt_state):
        raise InvalidStateTransition(f"Illegal transition {cur.value} → {nxt_state.value}")
    return nxt_state


def terminal_states() -> Set[TaskState]:
    return {TaskState.COMPLETED, TaskState.FAILED, TaskState.CANCELLED, TaskState.DEAD_LETTER}
