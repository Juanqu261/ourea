"""Text matching between historical adaptation rows and the challenge catalogue."""

from __future__ import annotations

import unicodedata

from institutional import MATCH_PHRASES


def fold(value) -> str:
    text = "" if value is None else str(value)
    normalized = unicodedata.normalize("NFKD", text)
    without = "".join(char for char in normalized if not unicodedata.combining(char))
    return " ".join(without.lower().split())


def match_intervention(measure_name: str) -> str | None:
    """Return a catalogue id only when an explicit phrase is present.

    Loose overlaps such as mobility works or landfill campaigns stay unmatched.
    """
    folded = fold(measure_name)
    hits = [
        intervention_id
        for intervention_id, phrases in MATCH_PHRASES.items()
        if any(phrase in folded for phrase in phrases)
    ]
    if len(hits) == 1:
        return hits[0]
    return None
