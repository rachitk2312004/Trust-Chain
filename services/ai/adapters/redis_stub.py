from typing import Any, Dict, Optional


class RedisStub:
    """In-memory Redis stub for optional caching.

    Phase 2 queue / lock / lease coordination uses ``task_queue.manager.QueueManager``
    (memory or redis-py backend). Prefer that for AI task queues.
    """

    def __init__(self) -> None:
        self._data: Dict[str, Any] = {}

    def get(self, key: str) -> Optional[Any]:
        return self._data.get(key)

    def set(self, key: str, value: Any, ex: Optional[int] = None) -> bool:
        self._data[key] = value
        return True

    def delete(self, key: str) -> int:
        return 1 if self._data.pop(key, None) is not None else 0

    def ping(self) -> bool:
        return True
