"""Load the CORNARE data bundle, the same files `bundleDataset` reads in the browser."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "frontend" / "public" / "data" / "cornare"
MUNICIPALITY_IDS = ("rionegro", "guarne", "marinilla")
CLASS_ORDER = ("muy_baja", "baja", "media", "alta", "muy_alta")


@dataclass(frozen=True)
class Dataset:
    interventions: list[dict]
    dimensions: list[dict]
    metrics: list[dict]
    history: dict
    parameters: dict
    gaps: list[dict]
    mea: dict
    profiles: list[dict]
    lever_readings: list[dict]

    @property
    def measure_ids(self) -> list[str]:
        return [measure["id"] for measure in self.interventions]

    @property
    def dimension_ids(self) -> list[str]:
        return [dimension["id"] for dimension in self.dimensions]

    def measure(self, measure_id: str) -> dict:
        return next(item for item in self.interventions if item["id"] == measure_id)

    def gap(self, gap_id: str) -> dict:
        return next(item for item in self.gaps if item["id"] == gap_id)


def read_json(name: str, directory: Path = DATA):
    return json.loads((directory / name).read_text(encoding="utf-8"))


@lru_cache(maxsize=4)
def load_dataset(directory: Path = DATA) -> Dataset:
    interventions = read_json("interventions.json", directory)
    return Dataset(
        interventions=interventions["interventions"],
        dimensions=interventions["dimensions"],
        metrics=read_json("dimension_metrics.json", directory)["metrics"],
        history=read_json("adaptation_history.json", directory),
        parameters=read_json("decision_model.json", directory),
        gaps=read_json("information_gaps.json", directory)["gaps"],
        mea=read_json("mea_indicators.json", directory),
        profiles=read_json("municipality_profiles.json", directory)["municipalities"],
        lever_readings=_lever_readings(),
    )


def _lever_readings() -> list[dict]:
    """The S/CA readings live in institutional.py (one source per fact)."""
    import sys

    scripts = str(ROOT / "scripts" / "climaterisk")
    if scripts not in sys.path:
        sys.path.insert(0, scripts)
    from institutional import LEVER_READINGS  # noqa: PLC0415

    return LEVER_READINGS


def vulnerability_class(metrics: list[dict], municipality_id: str, dimension_id: str) -> str | None:
    """Mirror of `vulnerabilityClass` in cornareModel.js: a numeric row wins over a class-only row."""
    rows = [
        row for row in metrics
        if row["municipality_id"] == municipality_id
        and row["dimension_id"] == dimension_id
        and row["metric"] == "vulnerability"
        and row["scenario"] == "reference"
    ]
    numeric = next((row for row in rows if row["value"] is not None and row["classification"]), None)
    if numeric:
        return numeric["classification"]
    return next((row["classification"] for row in rows if row["classification"]), None)


def adaptive_capacity_value(metrics: list[dict], municipality_id: str, dimension_id: str) -> float | None:
    row = next(
        (
            row for row in metrics
            if row["municipality_id"] == municipality_id
            and row["dimension_id"] == dimension_id
            and row["metric"] == "adaptive_capacity"
            and row["scenario"] == "reference"
            and row["value"] is not None
        ),
        None,
    )
    return row["value"] if row else None


def class_index(classification: str) -> int:
    """1 (muy baja) … 5 (muy alta)."""
    return CLASS_ORDER.index(classification) + 1
