from typing import Any, Dict


def build_summary(text: str, max_length: int = 200) -> Dict[str, Any]:
    summary = text[:max_length] + ("..." if len(text) > max_length else "")
    return {
        "type": "summary",
        "summary": summary,
        "originalLength": len(text),
        "advisoryOnly": True,
    }
