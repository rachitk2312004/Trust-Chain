import pytest

from security.guard import DANGEROUS_OPERATIONS, SecurityViolation, assert_safe_operation


@pytest.mark.parametrize(
    "op",
    sorted(DANGEROUS_OPERATIONS),
)
def test_assert_safe_operation_rejects_dangerous_ops(op: str) -> None:
    with pytest.raises(SecurityViolation):
        assert_safe_operation(op)


def test_assert_safe_operation_allows_safe_ops() -> None:
    assert_safe_operation("ocr")
    assert_safe_operation("classify")
    assert_safe_operation("extract")


def test_case_insensitive_rejection() -> None:
    with pytest.raises(SecurityViolation):
        assert_safe_operation("REVOKE")
