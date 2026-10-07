"""Forbidden claims and forbidden asks, from forbidden_claims.json. No LangChain."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

PATH = Path(__file__).with_name("forbidden_claims.json")


@lru_cache(maxsize=1)
def _spec() -> dict:
    return json.loads(PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _compiled() -> dict:
    spec = _spec()
    flags = re.IGNORECASE | re.UNICODE
    return {
        "claims": [(item, re.compile(item["pattern"], flags)) for item in spec["claims"]],
        "asks": [(item, re.compile(item["pattern"], flags)) for item in spec["asks"]],
        "writes": re.compile(spec["writes"]["pattern"], flags),
        "location": re.compile(spec["location"]["pattern"], flags),
    }


def claims(text: str) -> list[dict]:
    """Every forbidden claim in `text`, with the quote that triggered it."""
    hits = []
    for item, pattern in _compiled()["claims"]:
        match = pattern.search(text or "")
        if match:
            hits.append({"id": item["id"], "quote": match.group(0), "message": item["message"], "gap": item.get("gap")})
    return hits


def ask(question: str) -> dict | None:
    """The forbidden ask in a user question, if any (refused before any tool call)."""
    for item, pattern in _compiled()["asks"]:
        if pattern.search(question or ""):
            return item
    return None


def is_write(question: str) -> bool:
    return bool(_compiled()["writes"].search(question or ""))


def is_location(question: str) -> bool:
    return bool(_compiled()["location"].search(question or ""))
