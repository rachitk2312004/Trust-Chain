"""Adapter health, retries, timeouts, and circuit breaking."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, TypeVar
import time

from .errors import AdapterTimeoutError, CircuitOpenError

T = TypeVar("T")


@dataclass
class CircuitBreaker:
    failure_threshold: int = 3
    reset_timeout_s: float = 30.0
    failures: int = 0
    opened_at: float | None = None
    state: str = "closed"  # closed | open | half_open

    def before_call(self) -> None:
        if self.state == "open":
            assert self.opened_at is not None
            if time.time() - self.opened_at >= self.reset_timeout_s:
                self.state = "half_open"
                return
            raise CircuitOpenError("Circuit breaker is open")

    def record_success(self) -> None:
        self.failures = 0
        self.state = "closed"
        self.opened_at = None

    def record_failure(self) -> None:
        self.failures += 1
        if self.failures >= self.failure_threshold:
            self.state = "open"
            self.opened_at = time.time()


@dataclass
class AdapterHealth:
    name: str
    healthy: bool = True
    consecutive_failures: int = 0
    last_error: str | None = None
    last_checked_at: float = field(default_factory=time.time)
    circuit: CircuitBreaker = field(default_factory=CircuitBreaker)

    def snapshot(self) -> dict:
        return {
            "name": self.name,
            "healthy": self.healthy,
            "consecutiveFailures": self.consecutive_failures,
            "lastError": self.last_error,
            "lastCheckedAt": self.last_checked_at,
            "circuit": self.circuit.state,
        }


def with_timeout_retry(
    fn: Callable[[], T],
    *,
    timeout_s: float,
    retries: int = 1,
    retry_on: tuple[type[BaseException], ...] = (AdapterTimeoutError, TimeoutError, ConnectionError),
) -> T:
    """Run fn with a soft timeout budget and limited retries.

    Note: cooperative timeout — callers should enforce HTTP timeouts on the client.
    """
    last: BaseException | None = None
    attempts = max(1, retries + 1)
    deadline = time.time() + timeout_s
    for attempt in range(attempts):
        if time.time() > deadline:
            raise AdapterTimeoutError("Adapter call exceeded timeout budget")
        try:
            return fn()
        except retry_on as exc:
            last = exc
            if attempt >= attempts - 1:
                break
            time.sleep(min(0.05 * (2**attempt), 0.5))
        except Exception:
            raise
    raise AdapterTimeoutError(str(last) if last else "retry exhausted") from last
