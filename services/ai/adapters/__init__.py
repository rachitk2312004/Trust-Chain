"""Phase 2 Step 6 — FastAPI adapter layer for AI workers."""

from .adapter_factory import AdapterFactory, get_adapter_factory, reset_adapters_for_tests
from .adapter_registry import AdapterRegistry, get_adapter_registry
from .base_adapter import BaseAdapter
from .errors import AdapterError, AdapterExhaustedError, AdapterTimeoutError
from .fallback import stub_fallback_allowed
from .r2_reader import R2ReaderStub

__all__ = [
    "AdapterError",
    "AdapterExhaustedError",
    "AdapterFactory",
    "AdapterRegistry",
    "AdapterTimeoutError",
    "BaseAdapter",
    "R2ReaderStub",
    "get_adapter_factory",
    "get_adapter_registry",
    "reset_adapters_for_tests",
    "stub_fallback_allowed",
]
