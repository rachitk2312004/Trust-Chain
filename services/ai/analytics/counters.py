from collections import defaultdict
from typing import Dict


class AnalyticsCounter:
    """In-memory request/operation counters."""

    def __init__(self) -> None:
        self._counts: Dict[str, int] = defaultdict(int)

    def increment(self, key: str, amount: int = 1) -> None:
        self._counts[key] += amount

    def get(self, key: str) -> int:
        return self._counts.get(key, 0)

    def snapshot(self) -> Dict[str, int]:
        return dict(self._counts)


_analytics: AnalyticsCounter | None = None


def get_analytics() -> AnalyticsCounter:
    global _analytics
    if _analytics is None:
        _analytics = AnalyticsCounter()
    return _analytics
