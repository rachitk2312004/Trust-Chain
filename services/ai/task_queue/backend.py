"""Queue backend protocol — Redis or in-memory (CI)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class QueueBackend(ABC):
    @abstractmethod
    def ping(self) -> bool:
        ...

    @abstractmethod
    def rpush(self, key: str, value: str) -> int:
        ...

    @abstractmethod
    def lpop(self, key: str) -> Optional[str]:
        ...

    @abstractmethod
    def llen(self, key: str) -> int:
        ...

    @abstractmethod
    def lrange(self, key: str, start: int, end: int) -> List[str]:
        ...

    @abstractmethod
    def set(self, key: str, value: str, ex_ms: Optional[int] = None) -> bool:
        ...

    @abstractmethod
    def get(self, key: str) -> Optional[str]:
        ...

    @abstractmethod
    def delete(self, key: str) -> int:
        ...

    @abstractmethod
    def set_nx(self, key: str, value: str, ex_ms: int) -> bool:
        """SET if not exists with TTL in milliseconds."""

    @abstractmethod
    def hset(self, key: str, mapping: Dict[str, Any]) -> int:
        ...

    @abstractmethod
    def hgetall(self, key: str) -> Dict[str, str]:
        ...

    @abstractmethod
    def expire(self, key: str, ex_ms: int) -> bool:
        ...
