from __future__ import annotations

from typing import Any

from .client import TrustChainClient


class SignaturesResource:
    def __init__(self, client: TrustChainClient) -> None:
        self._client = client

    def create(self, payload: dict[str, Any], *, idempotency_key: str | None = None) -> dict[str, Any]:
        return self._client.request("POST", "/signatures", body=payload, idempotency_key=idempotency_key)

    def get(self, signature_id: str) -> dict[str, Any]:
        return self._client.request("GET", f"/signatures/{signature_id}")
