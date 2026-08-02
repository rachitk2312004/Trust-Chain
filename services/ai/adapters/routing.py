"""Adapter routing — primary / secondary / stub selection."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional


@dataclass(frozen=True)
class AdapterRoute:
    capability: str
    primary: str = "primary"
    secondary: str = "secondary"
    stub: str = "stub"

    def chain(self) -> List[str]:
        return [self.primary, self.secondary, self.stub]


DEFAULT_ROUTES = {
    "ocr": AdapterRoute("ocr"),
    "extraction": AdapterRoute("extraction"),
    "classification": AdapterRoute("classification"),
    "embedding": AdapterRoute("embedding"),
    "fraud": AdapterRoute("fraud"),
    "evaluation": AdapterRoute("evaluation"),
    "explainability": AdapterRoute("explainability"),
}


def resolve_route(capability: str, preferred: Optional[str] = None) -> AdapterRoute:
    base = DEFAULT_ROUTES.get(capability)
    if base is None:
        raise KeyError(f"No adapter route for capability '{capability}'")
    if preferred == "stub":
        return AdapterRoute(capability, primary="stub", secondary="stub", stub="stub")
    return base
