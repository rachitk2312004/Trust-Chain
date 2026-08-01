from ocr.engine import StubOcrEngine, get_engine, list_engines


def test_stub_engine_always_available() -> None:
    engine = get_engine("stub")
    assert engine.name == "stub"
    result = engine.run(b"test-image-bytes")
    assert result["engine"] == "stub"
    assert result["text"] == "STUB OCR TEXT"
    assert result["advisoryOnly"] is True
    assert result["reviewState"] == "pending_review"


def test_unknown_engine_falls_back_to_stub() -> None:
    engine = get_engine("nonexistent")
    assert engine.name == "stub"


def test_list_engines_includes_stub() -> None:
    engines = list_engines()
    assert "stub" in engines
    assert "tesseract" in engines


def test_stub_metadata_fields() -> None:
    result = StubOcrEngine().run(b"abc")
    for key in (
        "confidence",
        "confidenceInterval",
        "modelVersion",
        "evaluationVersion",
        "tokenUsage",
        "computeUsage",
        "storageUsage",
        "estimatedCost",
        "lineage",
    ):
        assert key in result
    assert "low" in result["confidenceInterval"]
    assert "high" in result["confidenceInterval"]
