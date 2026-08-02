"""Fallback chain: primary → secondary → stub → failure."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .base_adapter import BaseAdapter
from .errors import AdapterExhaustedError, CircuitOpenError
from .routing import AdapterRoute, resolve_route


class FallbackAdapter(BaseAdapter):
    """Tries adapters in route order until one succeeds."""

    def __init__(
        self,
        capability: str,
        adapters: Dict[str, BaseAdapter],
        *,
        route: Optional[AdapterRoute] = None,
    ) -> None:
        self.name = f"{capability}:fallback"
        self.capability = capability
        self._adapters = adapters
        self._route = route or resolve_route(capability)
        super().__init__()

    def invoke(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        errors: List[str] = []
        for slot in self._route.chain():
            adapter = self._adapters.get(slot)
            if adapter is None:
                errors.append(f"{slot}:missing")
                continue
            try:
                result = adapter.execute(payload)
                result["adapter"] = adapter.name
                result["fallbackSlot"] = slot
                return result
            except CircuitOpenError as exc:
                errors.append(f"{slot}:circuit_open:{exc}")
                continue
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{slot}:{exc}")
                continue
        raise AdapterExhaustedError(
            f"All adapters failed for {self.capability}: {' | '.join(errors)}"
        )

    def health_check(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "capability": self.capability,
            "route": self._route.chain(),
            "adapters": {k: v.health_check() for k, v in self._adapters.items()},
        }
