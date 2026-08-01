from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class ModelSpec:
    provider: str
    model_id: str
    version: str
    available: bool = True


class ModelRegistry:
    """In-memory model registry for openai, gemini, local, stub providers."""

    def __init__(self) -> None:
        self._models: Dict[str, ModelSpec] = {}
        self._register_defaults()

    def _register_defaults(self) -> None:
        defaults = [
            ("openai", "gpt-4o-mini", "2024-07-18"),
            ("gemini", "gemini-1.5-flash", "001"),
            ("local", "llama-stub", "0.1.0"),
            ("stub", "stub-model", "1.0.0"),
        ]
        for provider, model_id, version in defaults:
            key = f"{provider}:{model_id}"
            self._models[key] = ModelSpec(provider=provider, model_id=model_id, version=version)

    def register(self, provider: str, model_id: str, version: str, available: bool = True) -> None:
        key = f"{provider}:{model_id}"
        self._models[key] = ModelSpec(provider=provider, model_id=model_id, version=version, available=available)

    def get(self, provider: str, model_id: Optional[str] = None) -> Optional[ModelSpec]:
        if model_id:
            return self._models.get(f"{provider}:{model_id}")
        matches = [m for m in self._models.values() if m.provider == provider and m.available]
        return matches[0] if matches else None

    def list_providers(self) -> List[str]:
        return sorted({m.provider for m in self._models.values()})


_registry: Optional[ModelRegistry] = None


def get_registry() -> ModelRegistry:
    global _registry
    if _registry is None:
        _registry = ModelRegistry()
    return _registry
