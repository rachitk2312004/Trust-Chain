"""Queue manager unit tests — memory backend (no Redis required)."""

from __future__ import annotations

import time

import pytest

from execution.manager import ExecutionManager
from task_queue.leases import LeaseManager
from task_queue.locks import DistributedLock
from task_queue.manager import QueueManager, reset_queue_manager_for_tests
from task_queue.memory_backend import MemoryQueueBackend
from task_queue.names import CAPABILITY_QUEUES, dlq_name, validate_queue_name
from task_queue.timeouts import retry_delay_seconds
from task_queue.types import QueueMessage, TaskState


@pytest.fixture()
def qm() -> QueueManager:
    reset_queue_manager_for_tests()
    return QueueManager(MemoryQueueBackend())


def test_separate_capability_queues() -> None:
    assert CAPABILITY_QUEUES == {
        "ocr",
        "classification",
        "extraction",
        "embedding",
        "fraud",
        "evaluation",
    }
    assert dlq_name("ocr") == "ocr:dead_letter"
    with pytest.raises(ValueError):
        validate_queue_name("shared")


def test_enqueue_claim_ack(qm: QueueManager) -> None:
    lease = qm.leases.acquire(capabilities=["ocr"])
    msg = QueueMessage.create("ocr", {"documentId": "doc-1"}, max_attempts=3)
    qm.enqueue(msg)
    assert qm.depth("ocr") == 1

    claimed = qm.claim("ocr", lease.worker_id)
    assert claimed is not None
    assert claimed.task_id == msg.task_id
    assert claimed.attempt == 1
    assert qm.depth("ocr") == 0

    qm.ack(claimed, result={"text": "ok"})
    status = qm.get_status(msg.task_id)
    assert status["status"] == TaskState.COMPLETED.value


def test_retry_then_dead_letter(qm: QueueManager) -> None:
    lease = qm.leases.acquire()
    msg = QueueMessage.create("fraud", {"x": 1}, max_attempts=2)
    qm.enqueue(msg)

    first = qm.claim("fraud", lease.worker_id)
    assert first is not None
    assert qm.nack(first, error="boom") == TaskState.RETRYING.value
    assert qm.get_status(msg.task_id)["status"] == TaskState.RETRYING.value

    # Make retry immediately available
    retry_raw_depth = qm.depth("fraud")
    assert retry_raw_depth == 1
    # Force available_at into the past by claiming after adjusting via second claim path:
    # pop and re-enqueue with available_at now
    import json
    from task_queue.names import queue_key

    raw = qm.backend.lpop(queue_key("fraud"))
    assert raw is not None
    data = json.loads(raw)
    data["available_at"] = time.time() - 1
    qm.backend.rpush(queue_key("fraud"), json.dumps(data))

    second = qm.claim("fraud", lease.worker_id)
    assert second is not None
    assert second.attempt == 2
    assert qm.nack(second, error="boom-again") == TaskState.DEAD_LETTER.value
    assert qm.dlq_depth("fraud") == 1
    assert qm.get_status(msg.task_id)["status"] == TaskState.DEAD_LETTER.value


def test_distributed_lock(qm: QueueManager) -> None:
    lock_a = DistributedLock(qm.backend, "resource-a", ttl_ms=2000)
    lock_b = DistributedLock(qm.backend, "resource-a", ttl_ms=2000)
    assert lock_a.acquire() is True
    assert lock_b.acquire(wait_ms=50) is False
    assert lock_a.release() is True
    assert lock_b.acquire(wait_ms=50) is True
    lock_b.release()


def test_worker_lease_heartbeat(qm: QueueManager) -> None:
    leases = LeaseManager(qm.backend, lease_ttl_ms=500)
    lease = leases.acquire(capabilities=["embedding"])
    assert leases.is_alive(lease.worker_id)
    updated = leases.heartbeat(lease.worker_id)
    assert updated is not None
    assert updated.heartbeat_timestamp >= lease.heartbeat_timestamp
    leases.release(lease.worker_id)
    assert leases.is_alive(lease.worker_id) is False


def test_claim_requires_live_lease(qm: QueueManager) -> None:
    qm.enqueue(QueueMessage.create("extraction", {}))
    with pytest.raises(RuntimeError):
        qm.claim("extraction", "AI-WORKER-DEAD0001")


def test_execution_manager_does_not_import_workers() -> None:
    import execution.manager as em
    import ast

    tree = ast.parse(open(em.__file__, encoding="utf-8").read())
    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module.split(".")[0])
    assert "workers" not in imported
    assert "task_queue" in imported


def test_execution_manager_submit_and_status(qm: QueueManager) -> None:
    ex = ExecutionManager(qm)
    result = ex.submit(
        "classification",
        {"text": "invoice"},
        legacy_job_public_code="AI-JOB-ABCDEF12",
        organization_id="org-1",
    )
    assert result["status"] == "pending"
    assert result["taskId"].startswith("AI-TASK-")
    assert result["legacyJobPublicCode"] == "AI-JOB-ABCDEF12"
    status = ex.status(result["taskId"])
    assert status["status"] == "pending"
    health = ex.health()
    assert health["ok"] is True
    assert health["queues"]["classification"] == 1


def test_retry_delay_backoff() -> None:
    assert retry_delay_seconds(1) == 1.0
    assert retry_delay_seconds(2) == 2.0
    assert retry_delay_seconds(3) == 4.0
    assert retry_delay_seconds(10, cap_seconds=8.0) == 8.0


def test_queues_are_isolated(qm: QueueManager) -> None:
    lease = qm.leases.acquire()
    qm.enqueue(QueueMessage.create("ocr", {"a": 1}))
    qm.enqueue(QueueMessage.create("embedding", {"b": 2}))
    claimed = qm.claim("embedding", lease.worker_id)
    assert claimed is not None
    assert claimed.queue == "embedding"
    assert qm.depth("ocr") == 1
    assert qm.depth("embedding") == 0
