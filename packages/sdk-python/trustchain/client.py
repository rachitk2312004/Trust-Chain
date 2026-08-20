from __future__ import annotations

import json
import time
import uuid
from typing import Any, Iterator
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .exceptions import (
    TrustChainAuthError,
    TrustChainError,
    TrustChainRateLimitError,
    TrustChainValidationError,
)


def _new_id() -> str:
    return str(uuid.uuid4())


class TrustChainClient:
    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = "http://localhost:4000",
        public_base_path: str = "/api/public/v1",
        max_retries: int = 3,
        retry_delay_ms: int = 200,
        timeout_s: float = 30.0,
    ) -> None:
        if not api_key or not api_key.strip():
            raise TrustChainValidationError("api_key is required")
        self.api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")
        self.public_base_path = public_base_path if public_base_path.startswith("/") else f"/{public_base_path}"
        self.max_retries = max_retries
        self.retry_delay_ms = retry_delay_ms
        self.timeout_s = timeout_s

    def _url(self, path: str, query: dict[str, Any] | None = None) -> str:
        suffix = path if path.startswith("/") else f"/{path}"
        url = f"{self.base_url}{self.public_base_path}{suffix}"
        if query:
            filtered = {k: str(v) for k, v in query.items() if v is not None}
            if filtered:
                url = f"{url}?{urlencode(filtered)}"
        return url

    def request(
        self,
        method: str,
        path: str,
        *,
        body: Any | None = None,
        query: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
        request_id: str | None = None,
        skip_retry: bool = False,
    ) -> Any:
        req_id = request_id or _new_id()
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
            "X-Request-Id": req_id,
        }
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")
        if method.upper() not in {"GET", "HEAD"}:
            headers["Idempotency-Key"] = idempotency_key or _new_id()

        attempts = 1 if skip_retry else self.max_retries + 1
        last_error: Exception | None = None

        for attempt in range(1, attempts + 1):
            try:
                req = Request(self._url(path, query), data=data, headers=headers, method=method.upper())
                with urlopen(req, timeout=self.timeout_s) as resp:
                    raw = resp.read().decode("utf-8")
                    return json.loads(raw) if raw else None
            except HTTPError as exc:
                raw = exc.read().decode("utf-8") if exc.fp else ""
                payload = None
                try:
                    payload = json.loads(raw) if raw else None
                except json.JSONDecodeError:
                    payload = raw
                message = "Request failed"
                code = f"HTTP_{exc.code}"
                details = None
                if isinstance(payload, dict) and isinstance(payload.get("error"), dict):
                    err = payload["error"]
                    message = str(err.get("message") or message)
                    code = str(err.get("code") or code)
                    details = err.get("details")

                if exc.code == 401:
                    raise TrustChainAuthError(message, request_id=req_id) from exc
                if exc.code == 400:
                    raise TrustChainValidationError(message, details=details, request_id=req_id) from exc
                if exc.code == 429:
                    if attempt < attempts:
                        time.sleep((self.retry_delay_ms * (2 ** (attempt - 1))) / 1000)
                        continue
                    raise TrustChainRateLimitError(message, request_id=req_id) from exc
                if exc.code in {408, 429} or exc.code >= 500:
                    if attempt < attempts:
                        time.sleep((self.retry_delay_ms * (2 ** (attempt - 1))) / 1000)
                        continue
                raise TrustChainError(
                    message,
                    code=code,
                    status_code=exc.code,
                    details=details or payload,
                    request_id=req_id,
                ) from exc
            except URLError as exc:
                last_error = exc
                if attempt < attempts:
                    time.sleep((self.retry_delay_ms * (2 ** (attempt - 1))) / 1000)
                    continue
                raise TrustChainError(str(exc.reason), code="NETWORK_ERROR", request_id=req_id) from exc

        raise last_error or TrustChainError("Request failed", code="REQUEST_FAILED", request_id=req_id)

    def health(self) -> dict[str, Any]:
        return self.request("GET", "/health", skip_retry=True)


def paginate_offset(fetch_page, *, page_size: int = 20) -> Iterator[Any]:
    offset = 0
    total = float("inf")
    while offset < total:
        page = fetch_page(offset, page_size)
        total = int(page.get("total", 0))
        items = page.get("items") or []
        for item in items:
            yield item
        if not items:
            break
        offset += int(page.get("limit", page_size))


class TrustChain:
    def __init__(self, api_key: str, **kwargs: Any) -> None:
        from .documents import DocumentsResource
        from .certificates import CertificatesResource
        from .signatures import SignaturesResource
        from .webhooks import WebhooksResource

        self.client = TrustChainClient(api_key, **kwargs)
        self.documents = DocumentsResource(self.client)
        self.certificates = CertificatesResource(self.client)
        self.signatures = SignaturesResource(self.client)
        self.webhooks = WebhooksResource()

    def health(self) -> dict[str, Any]:
        return self.client.health()

    def usage(self, *, days: int | None = None, limit: int | None = None, offset: int | None = None) -> dict[str, Any]:
        return self.client.request(
            "GET",
            "/usage",
            query={"days": days, "limit": limit, "offset": offset},
        )
