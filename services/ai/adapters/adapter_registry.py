"""Adapter registry — one FallbackAdapter per capability."""

from __future__ import annotations

from typing import Dict, Optional

from .base_adapter import BaseAdapter
from .capability_adapters import build_capability_adapters
from .clients.http_transport import FastApiTransport
from .fallback import FallbackAdapter

CAPABILITIES = (
    "ocr",
    "extraction",
    "classification",
    "embedding",
    "fraud",
    "evaluation",
    "explainability",
)


class AdapterRegistry:
    def __init__(self, transport: Optional[FastApiTransport] = None) -> None:
        self._transport = transport
        self._adapters: Dict[str, BaseAdapter] = {}
        for capability in CAPABILITIES:
            slots = build_capability_adapters(capability, transport=transport)
            self._adapters[capability] = FallbackAdapter(capability, slots)

    def get(self, capability: str) -> BaseAdapter:
        adapter = self._adapters.get(capability)
        if adapter is None:
            raise KeyError(f"No adapter registered for '{capability}'")
        return adapter

    def health(self) -> Dict[str, object]:
        return {name: adapter.health_check() for name, adapter in self._adapters.items()}


_REGISTRY: Optional[AdapterRegistry] = None


def get_adapter_registry(transport: Optional[FastApiTransport] = None) -> AdapterRegistry:
    global _REGISTRY
    if _REGISTRY is None:
        _REGISTRY = AdapterRegistry(transport=transport)
    return _REGISTRY


def reset_adapter_registry_for_tests() -> None:
    global _REGISTRY
    _REGISTRY = None
