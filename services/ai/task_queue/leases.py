"""Worker lease coordination (heartbeat + expiration)."""

from __future__ import annotations

from typing import List, Optional
import json
import time
import uuid

from .backend import QueueBackend
from .names import DEFAULT_LEASE_TTL_MS, lease_key
from .types import WorkerLease


def new_worker_id() -> str:
    return f"AI-WORKER-{uuid.uuid4().hex[:8].upper()}"


class LeaseManager:
    def __init__(self, backend: QueueBackend, lease_ttl_ms: int = DEFAULT_LEASE_TTL_MS) -> None:
        self._backend = backend
        self._lease_ttl_ms = lease_ttl_ms

    def acquire(
        self,
        *,
        worker_id: Optional[str] = None,
        capabilities: Optional[List[str]] = None,
    ) -> WorkerLease:
        wid = worker_id or new_worker_id()
        now = time.time()
        lease = WorkerLease(
            worker_id=wid,
            lease_expiration=now + (self._lease_ttl_ms / 1000.0),
            heartbeat_timestamp=now,
            last_seen_at=now,
            capabilities=list(capabilities or []),
        )
        self._backend.set(lease_key(wid), json.dumps(lease.to_dict()), ex_ms=self._lease_ttl_ms)
        return lease

    def heartbeat(self, worker_id: str) -> Optional[WorkerLease]:
        raw = self._backend.get(lease_key(worker_id))
        if not raw:
            return None
        lease = WorkerLease.from_dict(json.loads(raw))
        now = time.time()
        lease.heartbeat_timestamp = now
        lease.last_seen_at = now
        lease.lease_expiration = now + (self._lease_ttl_ms / 1000.0)
        self._backend.set(
            lease_key(worker_id),
            json.dumps(lease.to_dict()),
            ex_ms=self._lease_ttl_ms,
        )
        return lease

    def get(self, worker_id: str) -> Optional[WorkerLease]:
        raw = self._backend.get(lease_key(worker_id))
        if not raw:
            return None
        return WorkerLease.from_dict(json.loads(raw))

    def release(self, worker_id: str) -> None:
        self._backend.delete(lease_key(worker_id))

    def is_alive(self, worker_id: str) -> bool:
        lease = self.get(worker_id)
        return lease is not None and not lease.is_expired()
