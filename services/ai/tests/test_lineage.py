import re

from utils.lineage import generate_lineage_code

LINEAGE_PATTERN = re.compile(r"^LINEAGE-[0-9A-F]{8}$")


def test_lineage_format() -> None:
    code = generate_lineage_code()
    assert LINEAGE_PATTERN.match(code)


def test_lineage_deterministic_with_seed() -> None:
    a = generate_lineage_code("seed-1")
    b = generate_lineage_code("seed-1")
    c = generate_lineage_code("seed-2")
    assert a == b
    assert a != c


def test_lineage_uppercase_hex() -> None:
    code = generate_lineage_code("test")
    suffix = code.split("-", 1)[1]
    assert suffix == suffix.upper()
