from __future__ import annotations

from typing import Any

from .client import TrustChainClient


class DocumentsResource:
    def __init__(self, client: TrustChainClient) -> None:
        self._client = client

    def create(self, payload: dict[str, Any], *, idempotency_key: str | None = None) -> dict[str, Any]:
        return self._client.request("POST", "/documents", body=payload, idempotency_key=idempotency_key)

    def get(self, document_id: str) -> dict[str, Any]:
        return self._client.request("GET", f"/documents/{document_id}")
