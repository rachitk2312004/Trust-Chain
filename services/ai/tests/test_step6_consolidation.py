"""Phase 2 Step 6 — stub removal / production rules / timeouts / lineage."""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from adapters.adapter_factory import get_adapter_factory, reset_adapters_for_tests
from adapters.base_adapter import BaseAdapter, REQUIRED_RESULT_KEYS
from adapters.errors import AdapterExhaustedError, AdapterTimeoutError
from adapters.fallback import FallbackAdapter, stub_fallback_allowed
from adapters.health import with_timeout_retry
from execution.manager import ExecutionManager
from task_queue.manager import QueueManager
from task_queue.memory_backend import MemoryQueueBackend
from workers.metrics import reset_metrics_for_tests
from workers.worker_manager import WorkerManager


@pytest.fixture(autouse=True)
def _reset():
    reset_adapters_for_tests()
    reset_metrics_for_tests()
    yield
    reset_adapters_for_tests()


def test_redis_stub_module_removed() -> None:
    path = Path(__file__).resolve().parents[1] / "adapters" / "redis_stub.py"
    assert not path.exists()


def test_internal_pipeline_does_not_use_inprocess_executor() -> None:
    path = Path(__file__).resolve().parents[1] / "api" / "routers" / "internal.py"
    source = path.read_text(encoding="utf-8")
    assert "InProcessExecutor" not in source
    assert "ExecutionManager" in source


def test_express_processor_stubs_absent_from_repo_layout() -> None:
    # Defensive: Python side should not reintroduce RedisStub naming.
    adapters_root = Path(__file__).resolve().parents[1] / "adapters"
    for path in adapters_root.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef) and node.name == "RedisStub":
                raise AssertionError(f"RedisStub found in {path}")


def test_queue_failure_surfaces() -> None:
    class BoomBackend(MemoryQueueBackend):
        def rpush(self, key: str, value: str) -> int:
            raise RuntimeError("queue down")

    mgr = ExecutionManager(QueueManager(BoomBackend()))
    with pytest.raises(RuntimeError, match="queue down"):
        mgr.submit("ocr", {"imageData": "ff"})


def test_timeout_handling() -> None:
    def always_slow():
        raise AdapterTimeoutError("timed out")

    with pytest.raises(AdapterTimeoutError):
        with_timeout_retry(always_slow, timeout_s=0.01, retries=1)


def test_lineage_generated_on_adapter_validate() -> None:
    class Minimal(BaseAdapter):
        name = "min"
        capability = "fraud"

        def invoke(self, payload):
            return {"advisoryOnly": True, "riskScore": 0.2}

    result = Minimal().execute({})
    for key in REQUIRED_RESULT_KEYS:
        assert key in result
    assert result["lineageId"].startswith("LINEAGE-")


def test_worker_drain_timeout_path() -> None:
    queues = QueueManager(MemoryQueueBackend())
    ex = ExecutionManager(queues)
    submitted = ex.submit("ocr", {"imageData": "aa", "engine": "stub"}, timeout_ms=1)
    mgr = WorkerManager(queues, capabilities=["ocr"])
    processed = mgr.drain(max_rounds=5)
    assert processed >= 1
    status = ex.status(submitted["taskId"])
    assert status["status"] in {"completed", "failed", "dead_letter", "retrying"}
    mgr.stop_all()


def test_stub_fallback_env(monkeypatch) -> None:
    monkeypatch.setenv("AI_EXECUTION_MODE", "production")
    assert stub_fallback_allowed() is False
    monkeypatch.setenv("AI_EXECUTION_MODE", "development")
    monkeypatch.setenv("AI_ALLOW_STUB_FALLBACK", "false")
    assert stub_fallback_allowed() is False
    monkeypatch.setenv("AI_ALLOW_STUB_FALLBACK", "true")
    assert stub_fallback_allowed() is True
