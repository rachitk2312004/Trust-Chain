"""Phase 2 Step 4 — FastAPI adapter layer for AI workers."""

from .adapter_factory import AdapterFactory, get_adapter_factory, reset_adapters_for_tests
from .adapter_registry import AdapterRegistry, get_adapter_registry
from .base_adapter import BaseAdapter
from .errors import AdapterError, AdapterExhaustedError, AdapterTimeoutError
from .r2_reader import R2ReaderStub
from .redis_stub import RedisStub

__all__ = [
    "AdapterError",
    "AdapterExhaustedError",
    "AdapterFactory",
    "AdapterRegistry",
    "AdapterTimeoutError",
    "BaseAdapter",
    "R2ReaderStub",
    "RedisStub",
    "get_adapter_factory",
    "get_adapter_registry",
    "reset_adapters_for_tests",
]
