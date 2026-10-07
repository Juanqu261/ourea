"""Byte-identical port of frontend/src/domain/fingerprint.js.

Canonical JSON (sorted keys, no spaces, numbers printed the way JS prints them)
hashed with djb2 over UTF-16 code units.
"""

from __future__ import annotations

import json
import math
from decimal import Decimal


def js_number(value: float | int) -> str:
    """Format a number like JavaScript's Number.prototype.toString()."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if math.isnan(value) or math.isinf(value):
        return "null"  # JSON.stringify(NaN) === 'null'
    if value == 0:
        return "0"  # covers -0
    sign = "-" if value < 0 else ""
    # repr gives the shortest round-trip digits, the same digits JS chooses.
    digits_tuple = Decimal(repr(abs(value))).normalize().as_tuple()
    digits = "".join(str(d) for d in digits_tuple.digits)
    k = len(digits)
    n = digits_tuple.exponent + k  # value = 0.d1d2…dk × 10^n
    if k <= n <= 21:
        body = digits + "0" * (n - k)
    elif 0 < n <= 21:
        body = digits[:n] + "." + digits[n:]
    elif -6 < n <= 0:
        body = "0." + "0" * (-n) + digits
    else:
        exponent = n - 1
        mantissa = digits[0] + ("." + digits[1:] if k > 1 else "")
        body = f"{mantissa}e{'+' if exponent >= 0 else '-'}{abs(exponent)}"
    return sign + body


def canonical_json(value) -> str:
    if value is None:
        return "null"
    if isinstance(value, (bool, int, float)):
        return js_number(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(canonical_json(item) for item in value) + "]"
    if isinstance(value, dict):
        keys = sorted(value, key=_utf16_key)
        return "{" + ",".join(f"{json.dumps(key, ensure_ascii=False)}:{canonical_json(value[key])}" for key in keys) + "}"
    if hasattr(value, "item"):  # numpy scalar
        return canonical_json(value.item())
    if hasattr(value, "tolist"):  # numpy array
        return canonical_json(value.tolist())
    raise TypeError(f"Cannot fingerprint {type(value).__name__}")


def _utf16_key(key: str) -> bytes:
    # JS sorts keys by UTF-16 code units, which differs from code points above U+FFFF.
    return key.encode("utf-16-be")


def djb2(text: str) -> str:
    data = text.encode("utf-16-le", "surrogatepass")
    hash_value = 5381
    for index in range(0, len(data), 2):
        unit = data[index] | (data[index + 1] << 8)
        hash_value = (hash_value * 33 + unit) & 0xFFFFFFFF
    return f"{hash_value:08x}"


def decision_fingerprint(parts) -> str:
    return f"ourea-{djb2(canonical_json(parts))}"
