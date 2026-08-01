from typing import Dict


class ImmutablePrompt:
    """Versioned immutable prompt template — never self-modifying."""

    def __init__(self, name: str, version: str, template: str) -> None:
        self.name = name
        self.version = version
        self._template = template

    def render(self, **kwargs: str) -> str:
        return self._template.format(**kwargs)

    @property
    def template(self) -> str:
        return self._template


PROMPT_REGISTRY: Dict[str, ImmutablePrompt] = {
    "extract-v1": ImmutablePrompt(
        "extract",
        "1.0.0",
        "Extract structured fields from the following advisory document text:\n{text}",
    ),
    "classify-v1": ImmutablePrompt(
        "classify",
        "1.0.0",
        "Classify the document (advisory only):\n{text}",
    ),
    "fraud-v1": ImmutablePrompt(
        "fraud",
        "1.0.0",
        "Assess fraud risk signals (advisory only, no auto-action):\n{text}",
    ),
}


def get_prompt(key: str) -> ImmutablePrompt:
    if key not in PROMPT_REGISTRY:
        raise KeyError(f"Unknown prompt: {key}")
    return PROMPT_REGISTRY[key]
