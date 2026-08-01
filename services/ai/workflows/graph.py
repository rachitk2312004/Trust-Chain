from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List

from classification.classifier import classify_document
from extraction.extractor import extract_fields
from ocr.engine import get_engine
from ocr.preprocess import preprocess_image


StepFn = Callable[[Dict[str, Any]], Dict[str, Any]]


@dataclass
class PipelineGraph:
    name: str
    steps: List[StepFn] = field(default_factory=list)

    def run(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        context = dict(payload)
        for step in self.steps:
            context = step(context)
        return context


def _step_ocr(ctx: Dict[str, Any]) -> Dict[str, Any]:
    data = ctx.get("imageData", b"")
    engine_name = ctx.get("ocrEngine", "stub")
    pre = preprocess_image(data if isinstance(data, bytes) else b"")
    engine = get_engine(engine_name)
    ocr_result = engine.run(data if isinstance(data, bytes) else b"")
    ctx["preprocess"] = pre
    ctx["ocr"] = ocr_result
    ctx["text"] = ocr_result.get("text", "")
    return ctx


def _step_extract(ctx: Dict[str, Any]) -> Dict[str, Any]:
    text = ctx.get("text", "")
    provider = ctx.get("provider")
    ctx["extraction"] = extract_fields(text, provider=provider)
    return ctx


def _step_classify(ctx: Dict[str, Any]) -> Dict[str, Any]:
    text = ctx.get("text", "")
    provider = ctx.get("provider")
    ctx["classification"] = classify_document(text, provider=provider)
    return ctx


def build_default_pipeline() -> PipelineGraph:
    return PipelineGraph(
        name="ocr-extract-classify",
        steps=[_step_ocr, _step_extract, _step_classify],
    )
