"""Phase 2 Step 7 — unit, failure-injection, retry, load, security hardening."""

from __future__ import annotations

import json
import time
from pathlib import Path

import pytest

from adapters.adapter_factory import get_adapter_factory, reset_adapters_for_tests
from adapters.base_adapter import BaseAdapter, REQUIRED_RESULT_KEYS
from adapters.errors import AdapterExhaustedError, AdapterTimeoutError, AdapterValidationError
from adapters.fallback import FallbackAdapter
from adapters.health import with_timeout_retry
from execution.manager import ExecutionManager
from task_queue.leases import LeaseManager
from task_queue.manager import QueueManager, reset_queue_manager_for_tests
from task_queue.memory_backend import MemoryQueueBackend
from task_queue.names import queue_key
from task_queue.types import QueueMessage, TaskState
from workers.heartbeat import HeartbeatService
from workers.lease_manager import WorkerLeaseManager
from workers.lineage_manager import LineageManager
from workers.metrics import reset_metrics_for_tests
from workers.retry_manager import RetryManager
from workers.state_machine import ALLOWED_TRANSITIONS, can_transition, transition, InvalidStateTransition
from workers.timeout_manager import TimeoutManager, TaskTimeoutError
from workers.base_worker import BaseWorker
from workers.worker_manager import WorkerManager


@pytest.fixture(autouse=True)
def _reset():
    reset_queue_manager_for_tests()
    reset_adapters_for_tests()
    reset_metrics_for_tests()
    yield
    reset_adapters_for_tests()
    reset_metrics_for_tests()


@pytest.fixture()
def queues() -> QueueManager:
    return QueueManager(MemoryQueueBackend())


# ── 1. Unit: managers ──────────────────────────────────────────────────────


def test_retry_manager_decisions() -> None:
    rm = RetryManager()
    msg = QueueMessage.create("ocr", {}, max_attempts=2)
    msg.attempt = 1
    d = rm.decide(msg, error="transient")
    assert d.action == "retry"
    assert d.state == TaskState.RETRYING.value
    msg.attempt = 2
    d2 = rm.decide(msg, error="exhausted")
    assert d2.action == "dead_letter"


def test_timeout_manager_expires() -> None:
    tm = TimeoutManager()
    msg = QueueMessage.create("fraud", {}, timeout_ms=1)
    watch = tm.start(msg)
    time.sleep(0.005)
    with pytest.raises(TaskTimeoutError):
        tm.check(watch)


def test_heartbeat_service_renews(queues: QueueManager) -> None:
    leases = WorkerLeaseManager(queues, lease_ttl_ms=2000)
    lease = leases.acquire(capabilities=["ocr"])
    hb = HeartbeatService(leases, lease.worker_id, interval_ms=50)
    assert hb.beat_once() is True
    assert hb.last_heartbeat_at is not None
    hb.start()
    time.sleep(0.12)
    hb.stop()
    assert hb.failures == 0
    leases.release(lease.worker_id)
    assert hb.beat_once() is False


def test_lineage_manager_chain_kinds() -> None:
    chain = LineageManager().build_chain(
        document_id="doc-s7",
        task_public_code="AI-TASK-S7000001",
        capability="extraction",
    )
    assert [n["kind"] for n in chain] == [
        "document",
        "artifact",
        "embedding",
        "inference",
        "review",
    ]


def test_execution_manager_cancel(queues: QueueManager) -> None:
    ex = ExecutionManager(queues)
    submitted = ex.submit("embedding", {"text": "x"})
    cancelled = ex.cancel(submitted["taskId"])
    assert cancelled["status"] == "cancelled"
    assert ex.status(submitted["taskId"])["status"] == "cancelled"


# ── 3. Failure injection ───────────────────────────────────────────────────


def test_adapter_timeout_injection() -> None:
    def boom():
        raise AdapterTimeoutError("injected timeout")

    with pytest.raises(AdapterTimeoutError):
        with_timeout_retry(boom, timeout_s=0.01, retries=0)


def test_worker_crash_goes_to_retry_then_dlq(queues: QueueManager) -> None:
    class CrashWorker(BaseWorker):
        def _process(self, message: QueueMessage):
            started = time.time()
            self.metrics.task_started()
            return BaseWorker._fail(self, message, "crash", started=started, force_dead_letter=False)

    msg = QueueMessage.create("classification", {"text": "x"}, max_attempts=2)
    queues.enqueue(msg)
    worker = CrashWorker("classification", queues)
    worker.start()
    assert worker.poll_once() is True
    assert queues.get_status(msg.task_id)["status"] == TaskState.RETRYING.value

    raw = queues.backend.lpop(queue_key("classification"))
    assert raw is not None
    data = json.loads(raw)
    data["available_at"] = time.time() - 1
    queues.backend.rpush(queue_key("classification"), json.dumps(data))

    assert worker.poll_once() is True
    assert queues.get_status(msg.task_id)["status"] == TaskState.DEAD_LETTER.value
    worker.stop()


def test_redis_style_backend_failure(queues: QueueManager) -> None:
    class BrokenBackend(MemoryQueueBackend):
        def rpush(self, key: str, value: str) -> int:
            raise RuntimeError("redis unavailable")

    mgr = ExecutionManager(QueueManager(BrokenBackend()))
    with pytest.raises(RuntimeError, match="redis unavailable"):
        mgr.submit("ocr", {"imageData": "aa"})


def test_lease_expiration(queues: QueueManager) -> None:
    leases = LeaseManager(queues.backend, lease_ttl_ms=50)
    lease = leases.acquire(capabilities=["ocr"])
    time.sleep(0.08)
    assert leases.is_alive(lease.worker_id) is False
    queues.enqueue(QueueMessage.create("ocr", {"x": 1}))
    with pytest.raises(RuntimeError):
        queues.claim("ocr", lease.worker_id)


def test_queue_corruption_rejected(queues: QueueManager) -> None:
    queues.backend.rpush(queue_key("ocr"), "{not-json")
    lease = queues.leases.acquire(capabilities=["ocr"])
    with pytest.raises((json.JSONDecodeError, ValueError, KeyError, TypeError)):
        queues.claim("ocr", lease.worker_id)


def test_duplicate_delivery_ack_is_idempotent_status(queues: QueueManager) -> None:
    lease = queues.leases.acquire(capabilities=["fraud"])
    msg = QueueMessage.create("fraud", {"text": "dup"}, max_attempts=3)
    queues.enqueue(msg)
    claimed = queues.claim("fraud", lease.worker_id)
    assert claimed is not None
    queues.ack(claimed, result={"advisoryOnly": True, "ok": True})
    # Second ack on same message should not resurrect pending work
    queues.ack(claimed, result={"advisoryOnly": True, "dup": True})
    assert queues.get_status(msg.task_id)["status"] == TaskState.COMPLETED.value
    assert queues.depth("fraud") == 0


def test_network_failure_exhausts_adapters() -> None:
    class NetDown(BaseAdapter):
        name = "net"
        capability = "ocr"

        def invoke(self, payload):
            raise ConnectionError("network failure")

    chain = FallbackAdapter(
        "ocr",
        {"primary": NetDown(), "secondary": NetDown(), "stub": NetDown()},
    )
    with pytest.raises(AdapterExhaustedError):
        chain.execute({"imageData": "x"})


def test_invalid_model_output_rejected() -> None:
    class Bad(BaseAdapter):
        name = "bad"
        capability = "fraud"

        def invoke(self, payload):
            return {"advisoryOnly": False, "confidence": 0.9}

    with pytest.raises(AdapterValidationError):
        Bad().execute({})


def test_malformed_lineage_gets_normalized() -> None:
    class OddLineage(BaseAdapter):
        name = "odd"
        capability = "evaluation"

        def invoke(self, payload):
            return {"advisoryOnly": True, "lineage": {"broken": True}, "score": 1}

    result = OddLineage().execute({})
    assert result["lineageId"].startswith("LINEAGE-")
    for key in REQUIRED_RESULT_KEYS:
        assert key in result


def test_cancellation_before_claim(queues: QueueManager) -> None:
    ex = ExecutionManager(queues)
    submitted = ex.submit("extraction", {"text": "cancel-me"})
    ex.cancel(submitted["taskId"])
    status = ex.status(submitted["taskId"])
    assert status["status"] == "cancelled"


def test_visibility_timeout_reclaim(queues: QueueManager) -> None:
    lease = queues.leases.acquire(capabilities=["embedding"])
    msg = QueueMessage.create("embedding", {"text": "slow"}, timeout_ms=1, max_attempts=3)
    queues.enqueue(msg)
    claimed = queues.claim("embedding", lease.worker_id)
    assert claimed is not None
    time.sleep(0.005)
    reclaimed = TimeoutManager().reclaim_queue(queues, "embedding")
    assert reclaimed >= 1
    status = queues.get_status(msg.task_id)["status"]
    assert status in {TaskState.RETRYING.value, TaskState.DEAD_LETTER.value}


# ── 4. Retry / state machine ───────────────────────────────────────────────


def test_all_task_states_reachable() -> None:
    states = {s.value for s in TaskState}
    assert states == {
        "pending",
        "processing",
        "retrying",
        "completed",
        "failed",
        "cancelled",
        "dead_letter",
    }
    assert can_transition(TaskState.PENDING, TaskState.PROCESSING)
    assert can_transition(TaskState.PROCESSING, TaskState.RETRYING)
    assert can_transition(TaskState.RETRYING, TaskState.PROCESSING)
    assert can_transition(TaskState.PROCESSING, TaskState.COMPLETED)
    assert can_transition(TaskState.PROCESSING, TaskState.FAILED)
    assert can_transition(TaskState.PROCESSING, TaskState.CANCELLED)
    assert can_transition(TaskState.PROCESSING, TaskState.DEAD_LETTER)
    with pytest.raises(InvalidStateTransition):
        transition(TaskState.COMPLETED, TaskState.PENDING)
    assert set(ALLOWED_TRANSITIONS.keys()) == set(TaskState)


# ── 6. Security ─────────────────────────────────────────────────────────────


def test_fastapi_workers_forbid_blockchain_verification_imports() -> None:
    root = Path(__file__).resolve().parents[1]
    forbidden_roots = {"blockchain", "verification", "apps", "frontend"}
    for path in list((root / "workers").rglob("*.py")) + list((root / "execution").rglob("*.py")):
        text = path.read_text(encoding="utf-8")
        for name in forbidden_roots:
            assert f"import {name}" not in text
            assert f"from {name}" not in text


def test_advisory_only_on_adapter_results() -> None:
    result = get_adapter_factory().execute("fraud", {"text": "check"})
    assert result["advisoryOnly"] is True


# ── 7. Load ─────────────────────────────────────────────────────────────────


def test_load_metrics_snapshot(queues: QueueManager) -> None:
    ex = ExecutionManager(queues)
    n = 40
    for i in range(n):
        cap = ("ocr", "classification", "extraction", "embedding", "fraud", "evaluation")[i % 6]
        payload = {"text": f"item-{i}", "imageData": f"{i:02x}", "predicted": 0.5, "reference": 0.5}
        ex.submit(cap, payload)

    mgr = WorkerManager(queues)
    started = time.time()
    processed = mgr.drain(max_rounds=200)
    elapsed = time.time() - started
    health = mgr.health()
    metrics = health["metrics"]  # type: ignore[index]
    assert processed >= n
    assert metrics["completedCount"] >= n  # type: ignore[index]
    assert metrics["workerCount"] == 6  # type: ignore[index]
    assert isinstance(metrics["averageExecutionTime"], (int, float))  # type: ignore[index]
    assert isinstance(metrics["retryCount"], int)  # type: ignore[index]
    assert isinstance(metrics["deadLetterCount"], int)  # type: ignore[index]
    assert isinstance(metrics["leaseExpirations"], int)  # type: ignore[index]
    assert isinstance(metrics["queueDepth"], dict)  # type: ignore[index]
    # Soft throughput bound — memory path should finish quickly in CI
    assert elapsed < 30.0
    # Persist load summary for Step 7 report consumers
    summary = {
        "tasks": n,
        "processed": processed,
        "elapsedSeconds": round(elapsed, 4),
        "averageExecutionTimeMs": metrics["averageExecutionTime"],
        "retryCount": metrics["retryCount"],
        "deadLetterCount": metrics["deadLetterCount"],
        "leaseExpirations": metrics["leaseExpirations"],
        "workerCount": metrics["workerCount"],
        "queueDepth": metrics["queueDepth"],
        "completedCount": metrics["completedCount"],
    }
    out = Path(__file__).resolve().parents[1] / "tests" / "_step7_load_results.json"
    out.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    mgr.stop_all()
