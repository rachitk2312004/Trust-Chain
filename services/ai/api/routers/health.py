from typing import Any, Dict

from fastapi import APIRouter

from analytics.counters import get_analytics

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> Dict[str, Any]:
    analytics = get_analytics().snapshot()
    return {
        "status": "ok",
        "service": "trustchain-ai",
        "version": "0.9.0",
        "advisoryOnly": True,
        "analytics": analytics,
    }
