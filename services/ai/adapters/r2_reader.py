from typing import Any, Dict, Optional


class R2ReaderStub:
    """Stub object storage reader."""

    def __init__(self, bucket: str = "trustchain-stub") -> None:
        self.bucket = bucket
        self._store: Dict[str, bytes] = {}

    def put(self, key: str, data: bytes) -> None:
        self._store[key] = data

    def get(self, key: str) -> Optional[bytes]:
        return self._store.get(key)

    def head(self, key: str) -> Dict[str, Any]:
        data = self._store.get(key)
        return {"key": key, "bucket": self.bucket, "exists": data is not None, "size": len(data) if data else 0}
