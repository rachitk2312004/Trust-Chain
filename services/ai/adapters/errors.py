"""Adapter-layer errors."""

from __future__ import annotations


class AdapterError(Exception):
    """Base adapter failure."""


class AdapterTimeoutError(AdapterError):
    pass


class AdapterValidationError(AdapterError):
    pass


class AdapterUnavailableError(AdapterError):
    pass


class CircuitOpenError(AdapterError):
    pass


class AdapterExhaustedError(AdapterError):
    """All adapters in the fallback chain failed."""
