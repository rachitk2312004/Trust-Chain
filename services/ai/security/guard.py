from typing import FrozenSet


class SecurityViolation(Exception):
    """Raised when an operation violates advisory-only policy."""


DANGEROUS_OPERATIONS: FrozenSet[str] = frozenset(
    {
        "revoke",
        "blockchain_tx",
        "mutate_verification",
        "autonomous_agent",
        "self_modify_prompt",
    }
)


def assert_safe_operation(op: str) -> None:
    """Reject dangerous operations. Advisory-only AI must never perform these."""
    normalized = op.strip().lower()
    if normalized in DANGEROUS_OPERATIONS:
        raise SecurityViolation(
            f"Operation '{op}' is forbidden. TrustChain AI is advisory-only."
        )


def validate_prompt_output(text: str) -> str:
    """Basic output validation — strip dangerous directive patterns."""
    forbidden = ("revoke certificate", "execute blockchain", "auto-approve")
    lower = text.lower()
    for phrase in forbidden:
        if phrase in lower:
            raise SecurityViolation(f"Output contains forbidden phrase: {phrase}")
    return text
