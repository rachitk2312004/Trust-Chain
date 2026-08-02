"""Timeout helpers for task visibility / execution windows."""

from __future__ import annotations

import time

from .names import DEFAULT_VISIBILITY_TIMEOUT_MS


def now_ms() -> int:
    return int(time.time() * 1000)


def deadline_ms(timeout_ms: int = DEFAULT_VISIBILITY_TIMEOUT_MS) -> int:
    return now_ms() + timeout_ms


def is_timed_out(started_at: float, timeout_ms: int) -> bool:
    return (time.time() - started_at) * 1000.0 >= timeout_ms


def retry_delay_seconds(attempt: int, base_seconds: float = 1.0, cap_seconds: float = 60.0) -> float:
    """Exponential backoff with cap."""
    delay = base_seconds * (2 ** max(attempt - 1, 0))
    return min(delay, cap_seconds)
