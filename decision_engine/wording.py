"""Spanish number formatting and the wording rules every output string follows.

- "casi óptimo en X% de los N mundos probados". Never "probabilidad".
- The score is a priority score: no "% de vulnerabilidad reducida", no avoided losses.
- "sin desagregar" means missing information, never "baja".
"""

from __future__ import annotations

FORBIDDEN = ("probabilidad", "vulnerabilidad reducida", "pérdidas evitadas", "riesgo evitado")


def es_int(value: int) -> str:
    return f"{int(value):,}".replace(",", ".")


def es_num(value: float, decimals: int = 2) -> str:
    text = f"{value:,.{decimals}f}"
    return text.replace(",", "_").replace(".", ",").replace("_", ".")


def es_pct(share: float, decimals: int = 0) -> str:
    return f"{es_num(share * 100, decimals)}%"


def near_best_sentence(share: float, n_worlds: int, threshold: float) -> str:
    return f"casi óptimo (a menos de {es_pct(threshold)} del mejor) en {es_pct(share)} de los {es_int(n_worlds)} mundos probados"


def check(text: str) -> str:
    lowered = text.lower()
    for word in FORBIDDEN:
        if word in lowered:
            raise ValueError(f"Wording rule broken ({word!r}): {text}")
    return text
