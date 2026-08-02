"""Dedicated capability queues — never a single shared queue."""

from typing import FrozenSet

CAPABILITY_QUEUES: FrozenSet[str] = frozenset(
    {
        "ocr",
        "classification",
        "extraction",
        "embedding",
        "fraud",
        "evaluation",
    }
)

DEFAULT_MAX_ATTEMPTS = 3
DEFAULT_VISIBILITY_TIMEOUT_MS = 120_000
DEFAULT_LEASE_TTL_MS = 60_000
DEFAULT_LOCK_TTL_MS = 30_000
DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000

KEY_PREFIX = "tc:ai"


def validate_queue_name(name: str) -> str:
    if name not in CAPABILITY_QUEUES:
        raise ValueError(f"Unknown AI queue '{name}'. Allowed: {sorted(CAPABILITY_QUEUES)}")
    return name


def dlq_name(queue: str) -> str:
    validate_queue_name(queue)
    return f"{queue}:dead_letter"


def queue_key(queue: str) -> str:
    validate_queue_name(queue)
    return f"{KEY_PREFIX}:q:{queue}"


def dlq_key(queue: str) -> str:
    return f"{KEY_PREFIX}:dlq:{validate_queue_name(queue)}"


def processing_key(queue: str) -> str:
    return f"{KEY_PREFIX}:processing:{validate_queue_name(queue)}"


def lock_key(resource: str) -> str:
    return f"{KEY_PREFIX}:lock:{resource}"


def lease_key(worker_id: str) -> str:
    return f"{KEY_PREFIX}:lease:{worker_id}"


def task_meta_key(task_id: str) -> str:
    return f"{KEY_PREFIX}:task:{task_id}"
