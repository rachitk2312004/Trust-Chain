from utils.confidence import build_result_metadata


def test_build_result_metadata_required_fields() -> None:
    meta = build_result_metadata(confidence=0.8, model_version="stub-1.0.0")
    assert meta["confidence"] == 0.8
    assert meta["modelVersion"] == "stub-1.0.0"
    assert meta["evaluationVersion"] == "eval-1.0.0"
    assert meta["confidenceInterval"]["low"] <= meta["confidence"]
    assert meta["confidenceInterval"]["high"] >= meta["confidence"]


def test_cost_fields_present() -> None:
    meta = build_result_metadata(
        confidence=0.5,
        model_version="m",
        token_usage=100,
        compute_usage=0.01,
        storage_usage=0.5,
        estimated_cost=0.001,
    )
    assert meta["tokenUsage"] == 100
    assert meta["computeUsage"] == 0.01
    assert meta["storageUsage"] == 0.5
    assert meta["estimatedCost"] == 0.001


def test_confidence_interval_clamped() -> None:
    meta = build_result_metadata(confidence=0.02, model_version="m", margin=0.1)
    assert meta["confidenceInterval"]["low"] >= 0.0
    meta_high = build_result_metadata(confidence=0.99, model_version="m", margin=0.1)
    assert meta_high["confidenceInterval"]["high"] <= 1.0
