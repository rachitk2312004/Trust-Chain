"""Worker infrastructure unit tests — Step 3 only."""

from __future__ import annotations

import ast
import time

import pytest

from execution.manager import ExecutionManager
from task_queue.manager import QueueManager
from task_queue.memory_backend import MemoryQueueBackend
from task_queue.types import QueueMessage, TaskState
from workers.base_worker import BaseWorker
from workers.executors import EXECUTOR_REGISTRY, get_executor
from workers.lineage_manager import LineageManager
from workers.metrics import reset_metrics_for_tests
from workers.state_machine import InvalidStateTransition, can_transition, transition
from workers.worker_manager import WorkerManager


@pytest.fixture()
def queues() -> QueueManager:
    reset_metrics_for_tests()
    return QueueManager(MemoryQueueBackend())


def test_state_machine_transitions() -> None:
    assert can_transition(TaskState.PENDING, TaskState.PROCESSING)
    assert transition(TaskState.PROCESSING, TaskState.COMPLETED) == TaskState.COMPLETED
    with pytest.raises(InvalidStateTransition):
        transition(TaskState.COMPLETED, TaskState.PROCESSING)


def test_all_executors_registered() -> None:
    for cap in ("ocr", "extraction", "classification", "embedding", "fraud", "evaluation"):
        assert get_executor(cap).capability == cap
    assert set(EXECUTOR_REGISTRY) == {
        "ocr",
        "extraction",
        "classification",
        "embedding",
        "fraud",
        "evaluation",
    }


def test_ocr_worker_completes_task(queues: QueueManager) -> None:
    ex = ExecutionManager(queues)
    submitted = ex.submit("ocr", {"imageData": "abcd", "engine": "stub"}, document_id="doc-1")
    worker = BaseWorker("ocr", queues, max_jobs=1)
    worker.start()
    assert worker.poll_once() is True
    status = queues.get_status(submitted["taskId"])
    assert status["status"] == TaskState.COMPLETED.value
    worker.stop()


def test_worker_manager_drain_all_capabilities(queues: QueueManager) -> None:
    ex = ExecutionManager(queues)
    ex.submit("ocr", {"imageData": "11"})
    ex.submit("classification", {"text": "invoice receipt"})
    ex.submit("extraction", {"text": "Invoice #9"})
    ex.submit("embedding", {"text": "hello world"})
    ex.submit("fraud", {"text": "short"})
    ex.submit("evaluation", {"predicted": 0.8, "reference": 0.75})

    mgr = WorkerManager(queues)
    processed = mgr.drain()
    assert processed >= 6
    health = mgr.health()
    assert health["metrics"]["completedCount"] >= 6  # type: ignore[index]
    assert health["metrics"]["workerCount"] == 6  # type: ignore[index]
    mgr.stop_all()


def test_retry_then_dead_letter(queues: QueueManager) -> None:
    class BoomWorker(BaseWorker):
        def _process(self, message: QueueMessage):
            from workers.base_worker import BaseWorker as BW

            started = time.time()
            self.metrics.task_started()
            return BW._fail(self, message, "forced", started=started, force_dead_letter=False)

    msg = QueueMessage.create("fraud", {"text": "x"}, max_attempts=2)
    queues.enqueue(msg)
    worker = BoomWorker("fraud", queues)
    worker.start()
    assert worker.poll_once() is True
    assert queues.get_status(msg.task_id)["status"] == TaskState.RETRYING.value

    # Make available immediately
    import json
    from task_queue.names import queue_key

    raw = queues.backend.lpop(queue_key("fraud"))
    assert raw is not None
    data = json.loads(raw)
    data["available_at"] = time.time() - 1
    queues.backend.rpush(queue_key("fraud"), json.dumps(data))

    assert worker.poll_once() is True
    assert queues.get_status(msg.task_id)["status"] == TaskState.DEAD_LETTER.value
    assert queues.dlq_depth("fraud") == 1
    snap = worker.metrics.snapshot()
    assert snap["retryCount"] >= 1
    assert snap["deadLetterCount"] >= 1
    worker.stop()


def test_lineage_chain() -> None:
    lm = LineageManager()
    chain = lm.build_chain(
        document_id="doc-9",
        task_public_code="AI-TASK-TEST0001",
        capability="ocr",
    )
    kinds = [n["kind"] for n in chain]
    assert kinds == ["document", "artifact", "embedding", "inference", "review"]
    assert all(n["public_code"].startswith("AI-ARTIFACT-") for n in chain)
    assert chain[1]["parent_public_code"] == chain[0]["public_code"]


def test_lease_heartbeat_fields(queues: QueueManager) -> None:
    worker = BaseWorker("embedding", queues)
    wid = worker.start()
    assert wid.startswith("AI-WORKER-")
    snap = worker.leases.snapshot(wid)
    assert snap["alive"] is True
    assert "leaseExpiration" in snap
    assert "heartbeatTimestamp" in snap
    assert "lastSeenAt" in snap
    assert worker._heartbeat is not None
    assert worker._heartbeat.beat_once() is True
    worker.stop()


def test_workers_forbid_dangerous_imports() -> None:
    import workers.base_worker as bw
    import workers.worker_manager as wm

    for mod in (bw, wm):
        tree = ast.parse(open(mod.__file__, encoding="utf-8").read())
        imported: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported.update(a.name.split(".")[0] for a in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.add(node.module.split(".")[0])
        for forbidden in ("blockchain", "verification", "apps", "express", "frontend"):
            assert forbidden not in imported


def test_execution_manager_still_has_no_worker_imports() -> None:
    import execution.manager as em

    tree = ast.parse(open(em.__file__, encoding="utf-8").read())
    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module.split(".")[0])
    assert "workers" not in imported
