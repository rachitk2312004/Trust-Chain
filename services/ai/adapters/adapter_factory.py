"""Adapter factory — workers/executors resolve adapters here only."""

from __future__ import annotations

from typing import Any, Dict, Optional

from .adapter_registry import AdapterRegistry, get_adapter_registry, reset_adapter_registry_for_tests
from .base_adapter import BaseAdapter
from .clients.http_transport import FastApiTransport, reset_transport_for_tests
from .routing import resolve_route


class AdapterFactory:
    def __init__(self, registry: Optional[AdapterRegistry] = None) -> None:
        self._registry = registry or get_adapter_registry()

    def get(self, capability: str) -> BaseAdapter:
        # Ensure route exists (raises KeyError for unknown capabilities).
        resolve_route(capability)
        return self._registry.get(capability)

    def execute(self, capability: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self.get(capability).execute(payload)

    def health(self) -> Dict[str, object]:
        return self._registry.health()


_FACTORY: Optional[AdapterFactory] = None


def get_adapter_factory() -> AdapterFactory:
    global _FACTORY
    if _FACTORY is None:
        _FACTORY = AdapterFactory()
    return _FACTORY


def reset_adapters_for_tests() -> None:
    global _FACTORY
    reset_transport_for_tests()
    reset_adapter_registry_for_tests()
    _FACTORY = None
