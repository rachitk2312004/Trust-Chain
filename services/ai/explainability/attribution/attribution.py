from typing import Any, Dict, List


def build_attribution(features: List[str], weights: List[float]) -> Dict[str, Any]:
    pairs = [
        {"feature": f, "weight": round(w, 4)}
        for f, w in zip(features, weights)
    ]
    return {"type": "attribution", "features": pairs, "advisoryOnly": True}
