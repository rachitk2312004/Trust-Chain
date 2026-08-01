from typing import Any, Dict, List, Optional

from ..registry.registry import ModelSpec, get_registry


class ModelRouter:
    """Route requests to the best available provider."""

    PRIORITY = ["openai", "gemini", "local", "stub"]

    def __init__(self, preferred: Optional[str] = None) -> None:
        self.registry = get_registry()
        self.preferred = preferred

    def resolve(self, provider: Optional[str] = None) -> ModelSpec:
        if provider:
            spec = self.registry.get(provider)
            if spec and spec.available:
                return spec
        order = [self.preferred] + self.PRIORITY if self.preferred else self.PRIORITY
        seen: set = set()
        for p in order:
            if p is None or p in seen:
                continue
            seen.add(p)
            spec = self.registry.get(p)
            if spec and spec.available:
                return spec
        return self.registry.get("stub")  # type: ignore[return-value]


def route_request(
    task: str,
    provider: Optional[str] = None,
    **kwargs: Any,
) -> Dict[str, Any]:
    router = ModelRouter(preferred=provider)
    spec = router.resolve(provider)
    return {
        "task": task,
        "provider": spec.provider,
        "modelId": spec.model_id,
        "modelVersion": spec.version,
        "routed": True,
    }
