from __future__ import annotations


class TrustChainError(Exception):
    def __init__(
        self,
        message: str,
        *,
        code: str = "SDK_ERROR",
        status_code: int | None = None,
        details=None,
        request_id: str | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details
        self.request_id = request_id


class TrustChainAuthError(TrustChainError):
    def __init__(self, message: str = "Authentication failed", request_id: str | None = None) -> None:
        super().__init__(message, code="UNAUTHORIZED", status_code=401, request_id=request_id)


class TrustChainRateLimitError(TrustChainError):
    def __init__(self, message: str = "Rate limit exceeded", request_id: str | None = None) -> None:
        super().__init__(message, code="RATE_LIMITED", status_code=429, request_id=request_id)


class TrustChainValidationError(TrustChainError):
    def __init__(
        self,
        message: str,
        details=None,
        request_id: str | None = None,
    ) -> None:
        super().__init__(
            message,
            code="VALIDATION_ERROR",
            status_code=400,
            details=details,
            request_id=request_id,
        )
