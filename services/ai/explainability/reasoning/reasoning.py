from typing import Any, Dict, List


def build_reasoning(steps: List[str], conclusion: str) -> Dict[str, Any]:
    return {
        "type": "reasoning",
        "steps": steps,
        "conclusion": conclusion,
        "advisoryOnly": True,
    }
