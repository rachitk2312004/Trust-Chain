"""Distributed locks via Redis SET NX PX (or memory backend equivalent)."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator, Optional
import time
import uuid

from .backend import QueueBackend
from .names import DEFAULT_LOCK_TTL_MS, lock_key


class DistributedLock:
    def __init__(self, backend: QueueBackend, resource: str, ttl_ms: int = DEFAULT_LOCK_TTL_MS) -> None:
        self._backend = backend
        self._resource = resource
        self._ttl_ms = ttl_ms
        self._token = uuid.uuid4().hex
        self._key = lock_key(resource)

    def acquire(self, wait_ms: int = 0, poll_ms: int = 50) -> bool:
        deadline = time.time() + (wait_ms / 1000.0)
        while True:
            if self._backend.set_nx(self._key, self._token, self._ttl_ms):
                return True
            if time.time() >= deadline:
                return False
            time.sleep(max(poll_ms, 1) / 1000.0)

    def release(self) -> bool:
        current = self._backend.get(self._key)
        if current == self._token:
            self._backend.delete(self._key)
            return True
        return False

    def refresh(self) -> bool:
        current = self._backend.get(self._key)
        if current != self._token:
            return False
        return self._backend.expire(self._key, self._ttl_ms)


@contextmanager
def hold_lock(
    backend: QueueBackend,
    resource: str,
    *,
    ttl_ms: int = DEFAULT_LOCK_TTL_MS,
    wait_ms: int = 1000,
) -> Iterator[DistributedLock]:
    lock = DistributedLock(backend, resource, ttl_ms=ttl_ms)
    if not lock.acquire(wait_ms=wait_ms):
        raise TimeoutError(f"Could not acquire lock for {resource}")
    try:
        yield lock
    finally:
        lock.release()
