from typing import Any, Dict, List, Optional


def build_evidence(
    source: str,
    spans: Optional[List[Dict[str, Any]]] = None,
    *,
    lineage: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "type": "evidence",
        "source": source,
        "lineage": lineage,
        "spans": spans or [],
        "advisoryOnly": True,
    }
