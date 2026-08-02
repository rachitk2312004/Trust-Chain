"""Worker-facing lease manager — wraps task_queue leases (no Express coupling)."""

from __future__ import annotations

from typing import List, Optional

from task_queue.leases import LeaseManager as QueueLeaseManager
from task_queue.manager import QueueManager
from task_queue.names import DEFAULT_LEASE_TTL_MS
from task_queue.types import WorkerLease


class WorkerLeaseManager:
    """Lease acquisition / renewal for workers only."""

    def __init__(
        self,
        queues: QueueManager,
        *,
        lease_ttl_ms: int = DEFAULT_LEASE_TTL_MS,
    ) -> None:
        self._queues = queues
        self._inner = QueueLeaseManager(queues.backend, lease_ttl_ms=lease_ttl_ms)

    def acquire(
        self,
        *,
        worker_id: Optional[str] = None,
        capabilities: Optional[List[str]] = None,
    ) -> WorkerLease:
        return self._inner.acquire(worker_id=worker_id, capabilities=capabilities)

    def renew(self, worker_id: str) -> Optional[WorkerLease]:
        return self._inner.heartbeat(worker_id)

    def get(self, worker_id: str) -> Optional[WorkerLease]:
        return self._inner.get(worker_id)

    def release(self, worker_id: str) -> None:
        self._inner.release(worker_id)

    def is_alive(self, worker_id: str) -> bool:
        return self._inner.is_alive(worker_id)

    def snapshot(self, worker_id: str) -> dict:
        lease = self.get(worker_id)
        if lease is None:
            return {"workerId": worker_id, "alive": False}
        return {
            "workerId": lease.worker_id,
            "leaseExpiration": lease.lease_expiration,
            "heartbeatTimestamp": lease.heartbeat_timestamp,
            "lastSeenAt": lease.last_seen_at,
            "capabilities": lease.capabilities,
            "alive": not lease.is_expired(),
        }
