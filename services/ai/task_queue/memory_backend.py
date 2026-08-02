"""In-memory queue backend for CI / local without Redis."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import threading
import time


class MemoryQueueBackend:
    def __init__(self) -> None:
        self._lists: Dict[str, List[str]] = {}
        self._kv: Dict[str, str] = {}
        self._kv_exp: Dict[str, float] = {}
        self._hashes: Dict[str, Dict[str, str]] = {}
        self._lock = threading.RLock()

    def ping(self) -> bool:
        return True

    def _purge_expired(self, key: str) -> None:
        exp = self._kv_exp.get(key)
        if exp is not None and time.time() >= exp:
            self._kv.pop(key, None)
            self._kv_exp.pop(key, None)

    def rpush(self, key: str, value: str) -> int:
        with self._lock:
            self._lists.setdefault(key, []).append(value)
            return len(self._lists[key])

    def lpop(self, key: str) -> Optional[str]:
        with self._lock:
            lst = self._lists.get(key) or []
            if not lst:
                return None
            value = lst.pop(0)
            if not lst:
                self._lists.pop(key, None)
            return value

    def llen(self, key: str) -> int:
        with self._lock:
            return len(self._lists.get(key) or [])

    def lrange(self, key: str, start: int, end: int) -> List[str]:
        with self._lock:
            lst = self._lists.get(key) or []
            if end == -1:
                return list(lst[start:])
            return list(lst[start : end + 1])

    def set(self, key: str, value: str, ex_ms: Optional[int] = None) -> bool:
        with self._lock:
            self._kv[key] = value
            if ex_ms is not None:
                self._kv_exp[key] = time.time() + (ex_ms / 1000.0)
            else:
                self._kv_exp.pop(key, None)
            return True

    def get(self, key: str) -> Optional[str]:
        with self._lock:
            self._purge_expired(key)
            return self._kv.get(key)

    def delete(self, key: str) -> int:
        with self._lock:
            removed = 0
            if key in self._kv:
                self._kv.pop(key, None)
                self._kv_exp.pop(key, None)
                removed = 1
            if key in self._lists:
                self._lists.pop(key, None)
                removed = 1
            if key in self._hashes:
                self._hashes.pop(key, None)
                removed = 1
            return removed

    def set_nx(self, key: str, value: str, ex_ms: int) -> bool:
        with self._lock:
            self._purge_expired(key)
            if key in self._kv:
                return False
            self._kv[key] = value
            self._kv_exp[key] = time.time() + (ex_ms / 1000.0)
            return True

    def hset(self, key: str, mapping: Dict[str, Any]) -> int:
        with self._lock:
            bucket = self._hashes.setdefault(key, {})
            for k, v in mapping.items():
                bucket[str(k)] = str(v)
            return len(mapping)

    def hgetall(self, key: str) -> Dict[str, str]:
        with self._lock:
            return dict(self._hashes.get(key) or {})

    def expire(self, key: str, ex_ms: int) -> bool:
        with self._lock:
            if key not in self._kv and key not in self._hashes:
                return False
            self._kv_exp[key] = time.time() + (ex_ms / 1000.0)
            return True
