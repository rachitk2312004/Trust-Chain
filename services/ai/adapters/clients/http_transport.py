"""Shared HTTP / ASGI transport to the FastAPI AI service (internal only)."""

from __future__ import annotations

from typing import Any, Dict, Optional, Protocol
import os
import threading

from adapters.errors import AdapterTimeoutError, AdapterUnavailableError

_DEFAULT_TIMEOUT_S = 30.0
_lock = threading.Lock()
_shared: Optional["FastApiTransport"] = None


class _ResponseProto(Protocol):
    status_code: int
    text: str

    def json(self) -> Any: ...


class FastApiTransport:
    """Talks only to FastAPI — never imports OCR/engine modules directly.

    Modes:
    - ``asgi``: Starlette TestClient against in-process app (CI default)
    - ``http``: httpx against ``AI_SERVICE_URL``
    """

    def __init__(
        self,
        *,
        base_url: Optional[str] = None,
        timeout_s: float = _DEFAULT_TIMEOUT_S,
        use_asgi: Optional[bool] = None,
    ) -> None:
        self.timeout_s = timeout_s
        env_url = (base_url if base_url is not None else os.environ.get("AI_SERVICE_URL", "")).rstrip(
            "/"
        )
        prefer_asgi = use_asgi if use_asgi is not None else not bool(env_url)
        self.mode = "asgi" if prefer_asgi else "http"
        self.base_url = env_url or "http://ai.internal"
        self._httpx = None
        self._test_client = None
        if prefer_asgi:
            from starlette.testclient import TestClient
            from api.app import app

            self._test_client = TestClient(app)
        else:
            import httpx

            self._httpx = httpx.Client(base_url=self.base_url, timeout=self.timeout_s)

    def post(self, path: str, json: Dict[str, Any]) -> Dict[str, Any]:
        try:
            if self._test_client is not None:
                response = self._test_client.post(path, json=json)
            else:
                assert self._httpx is not None
                response = self._httpx.post(path, json=json)
        except Exception as exc:  # noqa: BLE001
            name = type(exc).__name__
            if "Timeout" in name:
                raise AdapterTimeoutError(f"Timeout calling {path}") from exc
            raise AdapterUnavailableError(f"HTTP error calling {path}: {exc}") from exc
        return self._parse(path, response)

    def get(self, path: str) -> Dict[str, Any]:
        try:
            if self._test_client is not None:
                response = self._test_client.get(path)
            else:
                assert self._httpx is not None
                response = self._httpx.get(path)
        except Exception as exc:  # noqa: BLE001
            name = type(exc).__name__
            if "Timeout" in name:
                raise AdapterTimeoutError(f"Timeout calling {path}") from exc
            raise AdapterUnavailableError(f"HTTP error calling {path}: {exc}") from exc
        return self._parse(path, response)

    def _parse(self, path: str, response: _ResponseProto) -> Dict[str, Any]:
        if response.status_code >= 500:
            raise AdapterUnavailableError(f"{path} returned {response.status_code}")
        if response.status_code >= 400:
            raise AdapterUnavailableError(f"{path} rejected: {response.text}")
        data = response.json()
        if not isinstance(data, dict):
            raise AdapterUnavailableError(f"{path} returned non-object JSON")
        return data

    def close(self) -> None:
        if self._httpx is not None:
            try:
                self._httpx.close()
            except Exception:  # noqa: BLE001
                pass
            self._httpx = None
        # Starlette TestClient context manager optional; drop reference.
        self._test_client = None


def get_transport(**kwargs: Any) -> FastApiTransport:
    global _shared
    with _lock:
        if _shared is None:
            _shared = FastApiTransport(**kwargs)
        return _shared


def reset_transport_for_tests() -> None:
    global _shared
    with _lock:
        if _shared is not None:
            _shared.close()
        _shared = None
