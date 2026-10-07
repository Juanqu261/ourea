"""es-CO number parsing: 2,87 · 5.000 · 4.800M · −17 % · 23%. No LangChain.

Identifiers (SSP3-7.0, ourea-3e283bb2, Ley 99/1993) and years (2026, 2060) are not figures.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Any, Iterator

MINUS = "−–-"
_NUMBER = re.compile(
    r"(?<![\w\-/.,])"
    r"(?P<sign>(?<!\d)[−–-])?"  # after a digit, a dash is a range (0,66–0,73), not a sign
    r"(?P<body>\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)"
    r"(?P<suffix>\s?%|\s?M\b)?"
    r"(?![\w\-/]|[.,]\d)"
)


@dataclass(frozen=True)
class Number:
    raw: str
    value: float
    decimals: int
    percent: bool


def parse_body(body: str) -> tuple[float, int]:
    """'5.000' → (5000, 0) · '2,87' → (2.87, 2) · '4.800,5' → (4800.5, 1) · '2.81' → (2.81, 2)."""
    if re.fullmatch(r"\d{1,3}(?:\.\d{3})+(?:,\d+)?", body):
        integer, _, fraction = body.partition(",")
        return float(integer.replace(".", "") + ("." + fraction if fraction else "")), len(fraction)
    if "," in body:
        integer, fraction = body.split(",")
        return float(f"{integer}.{fraction}"), len(fraction)
    if "." in body:  # an English decimal slipped through; read it as written
        return float(body), len(body.split(".")[1])
    return float(body), 0


def parse(text: str) -> Number | None:
    numbers = list(extract(text))
    return numbers[0] if len(numbers) == 1 else None


def _is_year(body: str, suffix: str | None) -> bool:
    return not suffix and re.fullmatch(r"\d{4}", body) is not None and 1900 <= int(body) <= 2100


def extract(text: str) -> Iterator[Number]:
    for match in _NUMBER.finditer(text or ""):
        body, suffix, sign = match["body"], match["suffix"], match["sign"]
        if _is_year(body, suffix):
            continue
        value, decimals = parse_body(body)
        if sign:
            value = -value
        yield Number(match.group(0).strip(), value, decimals, bool(suffix and "%" in suffix))


def displays_as(value: float, shown: Number, allow_percent: bool = True) -> bool:
    """Is `shown` a display rounding of the raw `value` (sign aside)? Shares may show ×100 as %."""
    target = abs(shown.value)
    factors = (1.0, 100.0) if allow_percent else (1.0,)
    for factor in factors:
        candidate = abs(value) * factor
        if math.isclose(round(candidate, shown.decimals), target, abs_tol=10 ** -(shown.decimals + 6)):
            return True
    return False


def leaves(payload: Any, path: str = "") -> Iterator[tuple[str, float]]:
    """Numeric leaves of a tool result, plus the numbers written inside its strings."""
    if isinstance(payload, bool) or payload is None:
        return
    if isinstance(payload, (int, float)):
        if not (isinstance(payload, float) and (math.isnan(payload) or math.isinf(payload))):
            yield path, float(payload)
    elif isinstance(payload, str):
        for number in extract(payload):
            yield path, number.value
    elif isinstance(payload, dict):
        for key, value in payload.items():
            yield from leaves(value, f"{path}.{key}" if path else str(key))
    elif isinstance(payload, (list, tuple)):
        for item in payload:
            yield from leaves(item, path)
