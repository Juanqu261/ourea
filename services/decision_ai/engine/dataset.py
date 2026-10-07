"""Read-only access to frontend/public/data/cornare/ (+ map/). No LangChain."""

from __future__ import annotations

import json
from functools import lru_cache

from decision_engine.dataset import DATA

MAP = DATA / "map"


def read(name: str):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def sources() -> dict[str, dict]:
    return {source["id"]: source for source in read("source_registry.json")["sources"]}


@lru_cache(maxsize=1)
def gaps() -> dict[str, dict]:
    return {gap["id"]: gap for gap in read("information_gaps.json")["gaps"]}


@lru_cache(maxsize=1)
def interventions() -> dict[str, dict]:
    return {measure["id"]: measure for measure in read("interventions.json")["interventions"]}


@lru_cache(maxsize=1)
def map_catalog() -> dict:
    return json.loads((MAP / "catalog.json").read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def map_provenance() -> dict[str, dict]:
    payload = json.loads((MAP / "provenance.json").read_text(encoding="utf-8"))
    return {source["id"]: source for source in payload["sources"]}


@lru_cache(maxsize=1)
def actor_competencies() -> dict:
    return read("actor_competencies.json")
