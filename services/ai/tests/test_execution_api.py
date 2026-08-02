"""Internal execution API tests."""

from __future__ import annotations

from fastapi.testclient import TestClient

from api.app import app
from task_queue.manager import reset_queue_manager_for_tests
from adapters.adapter_factory import reset_adapters_for_tests
from workers.metrics import reset_metrics_for_tests


def setup_function() -> None:
    reset_queue_manager_for_tests()
    reset_adapters_for_tests()
    reset_metrics_for_tests()


def test_execution_submit_drain_status() -> None:
    client = TestClient(app)
    submitted = client.post(
        "/internal/execution/submit",
        json={
            "capability": "ocr",
            "payload": {"imageData": "ff", "engine": "stub"},
            "legacyJobPublicCode": "OCR-JOB-TEST0001",
            "taskId": "AI-TASK-TEST0001",
        },
    )
    assert submitted.status_code == 200
    body = submitted.json()
    assert body["taskId"] == "AI-TASK-TEST0001"
    assert body["status"] == "pending"

    drained = client.post("/internal/execution/drain", json={"capabilities": ["ocr"]})
    assert drained.status_code == 200
    assert drained.json()["processed"] >= 1

    status = client.get("/internal/execution/tasks/AI-TASK-TEST0001")
    assert status.status_code == 200
    assert status.json()["status"] == "completed"
    assert status.json()["result"] is not None


def test_execution_health_and_models() -> None:
    client = TestClient(app)
    health = client.get("/internal/execution/health")
    assert health.status_code == 200
    assert health.json()["advisoryOnly"] is True
    assert "queues" in health.json()
    models = client.get("/internal/execution/models")
    assert models.status_code == 200
    assert len(models.json()["models"]) >= 6
