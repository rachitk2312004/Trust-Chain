from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from models.versions import EVALUATION_VERSION, MODEL_VERSIONS
from utils.confidence import build_result_metadata
from utils.lineage import generate_lineage_code
from utils.schemas import DEFAULT_REVIEW_STATE


class OcrEngine(ABC):
    name: str = "base"

    @abstractmethod
    def run(self, data: bytes, **kwargs: Any) -> Dict[str, Any]:
        ...


class StubOcrEngine(OcrEngine):
    name = "stub"

    def run(self, data: bytes, **kwargs: Any) -> Dict[str, Any]:
        lineage = generate_lineage_code(data.hex()[:32] if data else None)
        text = "STUB OCR TEXT" if data else ""
        metadata = build_result_metadata(
            confidence=0.85,
            model_version=f"ocr-{MODEL_VERSIONS['ocr-stub']}",
            evaluation_version=EVALUATION_VERSION,
            token_usage=0,
            compute_usage=0.001,
        )
        return {
            "engine": self.name,
            "text": text,
            "lineage": lineage,
            "reviewState": DEFAULT_REVIEW_STATE.value,
            "advisoryOnly": True,
            **metadata,
        }


class TesseractOcrEngine(OcrEngine):
    name = "tesseract"

    def __init__(self) -> None:
        self._available = False
        try:
            import pytesseract  # noqa: F401

            self._available = True
        except ImportError:
            pass

    def run(self, data: bytes, **kwargs: Any) -> Dict[str, Any]:
        if not self._available:
            return StubOcrEngine().run(data, **kwargs)
        # Real tesseract path would go here; fall back semantics preserved via stub
        return StubOcrEngine().run(data, **kwargs)


class EasyOcrEngine(OcrEngine):
    name = "easyocr"

    def __init__(self) -> None:
        self._available = False
        try:
            import easyocr  # noqa: F401

            self._available = True
        except ImportError:
            pass

    def run(self, data: bytes, **kwargs: Any) -> Dict[str, Any]:
        if not self._available:
            return StubOcrEngine().run(data, **kwargs)
        return StubOcrEngine().run(data, **kwargs)


class PaddleOcrEngine(OcrEngine):
    name = "paddleocr"

    def __init__(self) -> None:
        self._available = False
        try:
            import paddleocr  # noqa: F401

            self._available = True
        except ImportError:
            pass

    def run(self, data: bytes, **kwargs: Any) -> Dict[str, Any]:
        if not self._available:
            return StubOcrEngine().run(data, **kwargs)
        return StubOcrEngine().run(data, **kwargs)


_ENGINES: Dict[str, OcrEngine] = {
    "stub": StubOcrEngine(),
    "tesseract": TesseractOcrEngine(),
    "easyocr": EasyOcrEngine(),
    "paddleocr": PaddleOcrEngine(),
}


def get_engine(name: Optional[str] = None) -> OcrEngine:
    if name and name in _ENGINES:
        return _ENGINES[name]
    return _ENGINES["stub"]


def list_engines() -> List[str]:
    return list(_ENGINES.keys())
