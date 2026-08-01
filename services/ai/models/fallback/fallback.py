from typing import Callable, List, Optional, TypeVar

from ..registry.registry import ModelSpec, get_registry

T = TypeVar("T")


class FallbackChain:
    """Try providers in order, falling back to stub."""

    DEFAULT_CHAIN = ["openai", "gemini", "local", "stub"]

    def __init__(self, chain: Optional[List[str]] = None) -> None:
        self.chain = chain or self.DEFAULT_CHAIN
        self.registry = get_registry()

    def execute(self, fn: Callable[[ModelSpec], T]) -> T:
        last_error: Optional[Exception] = None
        for provider in self.chain:
            spec = self.registry.get(provider)
            if not spec or not spec.available:
                continue
            try:
                return fn(spec)
            except Exception as exc:  # noqa: BLE001 — intentional fallback
                last_error = exc
                continue
        spec = self.registry.get("stub")
        if spec:
            return fn(spec)
        raise RuntimeError("No providers available") from last_error
