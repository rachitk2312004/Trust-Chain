"""Phase 2 Step 7 — FastAPI integration covering Express AI surface mapping."""

from __future__ import annotations

from fastapi.testclient import TestClient

from api.app import app
from adapters.adapter_factory import reset_adapters_for_tests
from task_queue.manager import reset_queue_manager_for_tests
from workers.metrics import reset_metrics_for_tests


def setup_function() -> None:
    reset_queue_manager_for_tests()
    reset_adapters_for_tests()
    reset_metrics_for_tests()


def _drain(client: TestClient, capabilities: list[str]) -> None:
    drained = client.post(
        "/internal/execution/drain",
        json={"capabilities": capabilities, "maxRounds": 50},
    )
    assert drained.status_code == 200


def test_integration_ocr_via_execution_api() -> None:
    client = TestClient(app)
    submitted = client.post(
        "/internal/execution/submit",
        json={
            "capability": "ocr",
            "payload": {"imageData": "ff00", "engine": "stub"},
            "legacyJobPublicCode": "OCR-JOB-S7OCR001",
            "taskId": "AI-TASK-S7OCR001",
        },
    )
    assert submitted.status_code == 200
    _drain(client, ["ocr"])
    status = client.get("/internal/execution/tasks/AI-TASK-S7OCR001")
    body = status.json()
    assert body["status"] == "completed"
    assert body["result"]["advisoryOnly"] is True
    assert "modelId" in body["result"]
    assert "lineageId" in body["result"]


def test_integration_extract_classify_fraud_embed() -> None:
    client = TestClient(app)
    cases = [
        ("extraction", {"text": "Invoice #99 dated 2026-08-01"}, "AI-JOB-S7EXT001"),
        ("classification", {"text": "this is an invoice"}, "CLASSIFICATION-JOB-S7CL01"),
        ("fraud", {"text": "mismatch anomaly"}, "AI-JOB-S7FRD001"),
        ("embedding", {"text": "search corpus text"}, "EMBEDDING-JOB-S7EM01"),
    ]
    for capability, payload, legacy in cases:
        task_id = f"AI-TASK-{capability[:6].upper()}01"
        submitted = client.post(
            "/internal/execution/submit",
            json={
                "capability": capability,
                "payload": payload,
                "legacyJobPublicCode": legacy,
                "taskId": task_id,
            },
        )
        assert submitted.status_code == 200, capability
        _drain(client, [capability])
        status = client.get(f"/internal/execution/tasks/{task_id}")
        assert status.json()["status"] == "completed", capability
        assert status.json()["result"]["advisoryOnly"] is True


def test_integration_models_and_health() -> None:
    client = TestClient(app)
    health = client.get("/internal/execution/health")
    assert health.status_code == 200
    assert health.json()["advisoryOnly"] is True
    assert "queues" in health.json()
    assert "adapters" in health.json()

    models = client.get("/internal/execution/models")
    assert models.status_code == 200
    body = models.json()
    assert body["advisoryOnly"] is True
    assert len(body["models"]) >= 6
    for model in body["models"]:
        assert model["modelId"].startswith("AI-MODEL-")
        assert model["modelVersion"].startswith("MODEL-VERSION-")
        assert model["advisoryOnly"] is True


def test_integration_cancel_task() -> None:
    client = TestClient(app)
    submitted = client.post(
        "/internal/execution/submit",
        json={
            "capability": "evaluation",
            "payload": {"predicted": 0.1, "reference": 0.2},
            "taskId": "AI-TASK-S7CAN001",
        },
    )
    assert submitted.status_code == 200
    cancelled = client.post("/internal/execution/cancel/AI-TASK-S7CAN001")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"


def test_integration_pipeline_uses_queue_path() -> None:
    client = TestClient(app)
    response = client.post(
        "/internal/pipeline",
        json={"imageData": "abcd", "ocrEngine": "stub", "operation": "pipeline"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["advisoryOnly"] is True
    assert body["jobId"].startswith("AI-TASK-")
    assert body["status"] in {"completed", "failed", "pending", "processing"}


def test_integration_internal_engines_remain_private() -> None:
    """Direct engine routes stay under /internal (not public Express)."""
    client = TestClient(app)
    for path, payload in (
        ("/internal/ocr", {"imageData": "aa", "engine": "stub"}),
        ("/internal/extract", {"text": "Invoice"}),
        ("/internal/classify", {"text": "certificate"}),
        ("/internal/fraud", {"text": "risk"}),
        ("/internal/search", {"query": "q", "corpus": ["a"]}),
    ):
        response = client.post(path, json=payload)
        assert response.status_code == 200, path
        assert response.json().get("advisoryOnly") is True or "text" in response.json() or "label" in response.json() or "matches" in response.json() or "riskScore" in response.json()
