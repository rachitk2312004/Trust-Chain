"""Optional Redis backend — used when REDIS_URL is set and redis-py is installed."""

from __future__ import annotations

from typing import Any, Dict, List, Optional


class RedisQueueBackend:
    def __init__(self, url: str) -> None:
        try:
            import redis  # type: ignore
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError("redis package required when REDIS_URL is set") from exc
        self._client = redis.Redis.from_url(url, decode_responses=True)
        self._client.ping()

    def ping(self) -> bool:
        return bool(self._client.ping())

    def rpush(self, key: str, value: str) -> int:
        return int(self._client.rpush(key, value))

    def lpop(self, key: str) -> Optional[str]:
        value = self._client.lpop(key)
        return str(value) if value is not None else None

    def llen(self, key: str) -> int:
        return int(self._client.llen(key))

    def lrange(self, key: str, start: int, end: int) -> List[str]:
        return [str(v) for v in self._client.lrange(key, start, end)]

    def set(self, key: str, value: str, ex_ms: Optional[int] = None) -> bool:
        if ex_ms is None:
            return bool(self._client.set(key, value))
        return bool(self._client.set(key, value, px=ex_ms))

    def get(self, key: str) -> Optional[str]:
        value = self._client.get(key)
        return str(value) if value is not None else None

    def delete(self, key: str) -> int:
        return int(self._client.delete(key))

    def set_nx(self, key: str, value: str, ex_ms: int) -> bool:
        return bool(self._client.set(key, value, nx=True, px=ex_ms))

    def hset(self, key: str, mapping: Dict[str, Any]) -> int:
        return int(self._client.hset(key, mapping={str(k): str(v) for k, v in mapping.items()}))

    def hgetall(self, key: str) -> Dict[str, str]:
        raw = self._client.hgetall(key) or {}
        return {str(k): str(v) for k, v in raw.items()}

    def expire(self, key: str, ex_ms: int) -> bool:
        return bool(self._client.pexpire(key, ex_ms))
