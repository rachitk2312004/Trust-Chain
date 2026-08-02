"""Capability adapters that call FastAPI via clients (never engines directly)."""

from __future__ import annotations

from typing import Any, Callable, Dict, Optional

from .base_adapter import BaseAdapter
from .clients import (
    ClassificationClient,
    EmbeddingClient,
    EvaluationClient,
    ExplainabilityClient,
    ExtractionClient,
    FastApiTransport,
    FraudClient,
    OcrClient,
)
from .errors import AdapterError
from .health import with_timeout_retry


class ClientAdapter(BaseAdapter):
    """Generic adapter wrapping a FastAPI client callable."""

    def __init__(
        self,
        *,
        name: str,
        capability: str,
        runner: Callable[[Dict[str, Any]], Dict[str, Any]],
        force_stub: bool = False,
        timeout_s: float = 30.0,
        retries: int = 1,
    ) -> None:
        self.name = name
        self.capability = capability
        self._runner = runner
        self._force_stub = force_stub
        self._timeout_s = timeout_s
        self._retries = retries
        super().__init__()

    def invoke(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        data = dict(payload)
        if self._force_stub:
            data["engine"] = "stub"
            data["provider"] = "stub"
        return with_timeout_retry(
            lambda: self._runner(data),
            timeout_s=self._timeout_s,
            retries=self._retries,
            retry_on=(AdapterError, TimeoutError, ConnectionError),
        )


def build_capability_adapters(
    capability: str,
    transport: Optional[FastApiTransport] = None,
) -> Dict[str, BaseAdapter]:
    """Build primary / secondary / stub adapters for a capability."""
    t = transport
    clients = {
        "ocr": OcrClient(t),
        "extraction": ExtractionClient(t),
        "classification": ClassificationClient(t),
        "embedding": EmbeddingClient(t),
        "fraud": FraudClient(t),
        "evaluation": EvaluationClient(t),
        "explainability": ExplainabilityClient(t),
    }
    if capability not in clients:
        raise KeyError(capability)
    client = clients[capability]
    return {
        "primary": ClientAdapter(
            name=f"{capability}:primary",
            capability=capability,
            runner=client.run,
            force_stub=False,
            retries=1,
        ),
        "secondary": ClientAdapter(
            name=f"{capability}:secondary",
            capability=capability,
            runner=client.run,
            force_stub=False,
            retries=0,
            timeout_s=15.0,
        ),
        "stub": ClientAdapter(
            name=f"{capability}:stub",
            capability=capability,
            runner=client.run,
            force_stub=True,
            retries=0,
            timeout_s=10.0,
        ),
    }
