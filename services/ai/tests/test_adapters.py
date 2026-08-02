"""Adapter layer unit tests — Step 4."""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from adapters.adapter_factory import AdapterFactory, get_adapter_factory, reset_adapters_for_tests
from adapters.base_adapter import BaseAdapter
from adapters.capability_adapters import build_capability_adapters
from adapters.clients.http_transport import FastApiTransport
from adapters.errors import AdapterExhaustedError, AdapterTimeoutError, CircuitOpenError
from adapters.fallback import FallbackAdapter
from adapters.health import CircuitBreaker, with_timeout_retry
from adapters.routing import resolve_route
from execution.manager import ExecutionManager
from task_queue.manager import QueueManager
from task_queue.memory_backend import MemoryQueueBackend
from workers.metrics import reset_metrics_for_tests
from workers.worker_manager import WorkerManager


@pytest.fixture(autouse=True)
def _reset_adapters():
    reset_adapters_for_tests()
    reset_metrics_for_tests()
    yield
    reset_adapters_for_tests()


def test_routing_chain_order() -> None:
    route = resolve_route("ocr")
    assert route.chain() == ["primary", "secondary", "stub"]


def test_ocr_adapter_via_fastapi_asgi() -> None:
    factory = get_adapter_factory()
    result = factory.execute("ocr", {"imageData": "deadbeef", "engine": "stub"})
    assert result["advisoryOnly"] is True
    assert result["capability"] == "ocr"
    assert "text" in result or "engine" in result
    assert result.get("fallbackSlot") in {"primary", "secondary", "stub"}


def test_all_capability_adapters() -> None:
    factory = get_adapter_factory()
    payloads = {
        "ocr": {"imageData": "aa", "engine": "stub"},
        "extraction": {"text": "Invoice #1"},
        "classification": {"text": "certificate document"},
        "embedding": {"text": "hello"},
        "fraud": {"text": "mismatch"},
        "evaluation": {"predicted": 0.9, "reference": 0.85},
        "explainability": {"text": "why", "kind": "ocr"},
    }
    for capability, payload in payloads.items():
        result = factory.execute(capability, payload)
        assert result["advisoryOnly"] is True
        assert result["capability"] == capability


def test_fallback_to_stub_when_primary_fails() -> None:
    class BoomAdapter(BaseAdapter):
        name = "boom"
        capability = "ocr"

        def invoke(self, payload):
            raise RuntimeError("primary down")

    class StubOk(BaseAdapter):
        name = "stub-ok"
        capability = "ocr"

        def invoke(self, payload):
            return {"advisoryOnly": True, "text": "stub"}

    chain = FallbackAdapter(
        "ocr",
        {"primary": BoomAdapter(), "secondary": BoomAdapter(), "stub": StubOk()},
    )
    result = chain.execute({"imageData": "x"})
    assert result["fallbackSlot"] == "stub"
    assert result["text"] == "stub"


def test_fallback_exhausted() -> None:
    class BoomAdapter(BaseAdapter):
        name = "boom"
        capability = "fraud"

        def invoke(self, payload):
            raise RuntimeError("down")

    chain = FallbackAdapter(
        "fraud",
        {
            "primary": BoomAdapter(),
            "secondary": BoomAdapter(),
            "stub": BoomAdapter(),
        },
    )
    with pytest.raises(AdapterExhaustedError):
        chain.execute({"text": "x"})


def test_circuit_breaker_opens() -> None:
    breaker = CircuitBreaker(failure_threshold=2, reset_timeout_s=60)
    breaker.record_failure()
    breaker.record_failure()
    assert breaker.state == "open"
    with pytest.raises(CircuitOpenError):
        breaker.before_call()


def test_timeout_retry_helper() -> None:
    calls = {"n": 0}

    def flaky():
        calls["n"] += 1
        if calls["n"] < 2:
            raise AdapterTimeoutError("slow")
        return "ok"

    assert with_timeout_retry(flaky, timeout_s=5, retries=2) == "ok"
    assert calls["n"] == 2


def test_adapter_health_snapshot() -> None:
    health = get_adapter_factory().health()
    assert "ocr" in health
    assert "explainability" in health


def test_executors_do_not_import_engines() -> None:
    root = Path(__file__).resolve().parents[1] / "workers" / "executors"
    forbidden = {"ocr", "extraction", "classification", "embeddings", "evaluation", "explainability"}
    # Allow importing package names only via adapters — engines live under those top-level pkgs.
    for path in root.glob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module:
                top = node.module.split(".")[0]
                if top in forbidden and "adapters" not in (node.module or ""):
                    # executors may not import engine packages
                    if top in {"ocr", "extraction", "classification", "embeddings", "evaluation"}:
                        if any(
                            part in (node.module or "")
                            for part in ("engine", "extractor", "classifier", "vectors", "metrics", "fraud")
                        ):
                            raise AssertionError(f"{path.name} imports engine module {node.module}")
                # stricter: no direct engine package imports at all from executors except adapters/security/task_queue
                if top in {"ocr", "extraction", "classification", "embeddings", "evaluation"} and top == node.module.split(".")[0]:
                    if node.module.split(".")[0] in forbidden and "adapters" not in node.module:
                        # ocr.engine etc.
                        if len(node.module.split(".")) > 1 or node.module in forbidden:
                            if node.module in (
                                "ocr.engine",
                                "ocr.preprocess",
                                "extraction.extractor",
                                "classification.classifier",
                                "classification.fraud",
                                "embeddings.vectors",
                                "evaluation.metrics",
                            ):
                                raise AssertionError(f"executor {path.name} imports {node.module}")


def test_executors_import_only_adapters() -> None:
    root = Path(__file__).resolve().parents[1] / "workers" / "executors"
    for path in root.glob("*.py"):
        if path.name == "__init__.py":
            continue
        source = path.read_text(encoding="utf-8")
        assert "ocr.engine" not in source
        assert "extraction.extractor" not in source
        assert "classification.classifier" not in source
        assert "embeddings.vectors" not in source
        assert "evaluation.metrics" not in source
        assert "classification.fraud" not in source


def test_worker_still_works_through_adapters() -> None:
    queues = QueueManager(MemoryQueueBackend())
    ex = ExecutionManager(queues)
    ex.submit("ocr", {"imageData": "ff", "engine": "stub"})
    ex.submit("evaluation", {"predicted": 0.5, "reference": 0.5})
    mgr = WorkerManager(queues, capabilities=["ocr", "evaluation"])
    processed = mgr.drain()
    assert processed >= 2
    mgr.stop_all()


def test_build_capability_adapters_slots() -> None:
    transport = FastApiTransport(use_asgi=True)
    slots = build_capability_adapters("classification", transport=transport)
    assert set(slots) == {"primary", "secondary", "stub"}
    result = slots["stub"].execute({"text": "x"})
    assert result["advisoryOnly"] is True
