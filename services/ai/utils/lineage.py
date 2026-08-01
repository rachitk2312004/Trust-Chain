import hashlib
import secrets
from typing import Optional


def generate_lineage_code(seed: Optional[str] = None) -> str:
    """Produce a lineage code like LINEAGE-XXXXXXXX (8 hex uppercase)."""
    if seed is not None:
        digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()[:8]
    else:
        digest = secrets.token_hex(4)
    return f"LINEAGE-{digest.upper()}"
