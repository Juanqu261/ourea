"""Offline validation of the shipped CHIRPS climate_context.json."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from build_climate_context import (  # noqa: E402
    OUTPUT,
    VERSIONED_CSV,
    VERSIONED_META,
    build_document,
    expand_pentads_to_daily,
    is_valid_precip,
    iter_year_month_pentads,
    load_versioned_metadata,
    load_versioned_pentads,
    sha256_file,
)
from chirps_stats import AVAILABLE_END, AVAILABLE_START  # noqa: E402

REQUIRED_TOP = (
    "schema_version",
    "generated_at",
    "source_name",
    "source_version",
    "source_urls",
    "doi",
    "accessed_at",
    "spatial_resolution",
    "temporal_resolution",
    "area",
    "climatology_period",
    "available_period",
    "daily_percentiles",
    "rolling_accumulation_percentiles",
    "observed_maxima",
    "scenario_presets",
    "method",
    "appropriate_uses",
    "limitations",
    "input_provenance",
)

REQUIRED_PRESET = (
    "id",
    "label",
    "accumulation_window_days",
    "precipitation_mm",
    "percentile",
    "climatology_period",
    "source_name",
)

PRESET_IDS = ("typical_wet", "high_rainfall", "extreme_observed")


def load_climate_context(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_climate_context(document: dict) -> list[str]:
    errors = []
    for key in REQUIRED_TOP:
        if key not in document and key != "coordinates":
            if key == "area" and "coordinates" not in document and "bounds" not in document:
                errors.append("missing area/coordinates/bounds")
            elif key not in document:
                errors.append(f"missing {key}")
    if "coordinates" not in document and "bounds" not in document:
        errors.append("missing coordinates or bounds")
    if document.get("source_version") != "v3.0":
        errors.append("source_version must be v3.0")
    if "Final" not in str(document.get("source_name", "")):
        errors.append("source_name must identify CHIRPS Final")
    if document.get("climatology_period", {}).get("label") != "1991-2020":
        errors.append("climatology_period.label must be 1991-2020")
    rolling = document.get("rolling_accumulation_percentiles") or {}
    for window in ("3", "7", "15", "30"):
        if window not in rolling:
            errors.append(f"missing rolling window {window}")
    presets = document.get("scenario_presets") or []
    ids = [item.get("id") for item in presets]
    if tuple(ids) != PRESET_IDS:
        errors.append(f"preset ids {ids} != {PRESET_IDS}")
    for preset in presets:
        for key in REQUIRED_PRESET:
            if key not in preset:
                errors.append(f"preset {preset.get('id')} missing {key}")
        if "soil" in json.dumps(preset).lower() or "wetness" in json.dumps(preset).lower():
            errors.append("preset uses soil-wetness language")
    blob = json.dumps(document).lower()
    for banned in ("predicts landslide", "real-time warning", "digital twin"):
        if banned in blob:
            errors.append(f"banned claim: {banned}")
    if "chirps" not in blob:
        errors.append("document does not mention CHIRPS")
    sample = (document.get("input_provenance") or {}).get("sample") or {}
    if sample.get("row") is None or sample.get("col") is None:
        errors.append("input_provenance.sample is missing raster row/col")
    if not (document.get("input_provenance") or {}).get("csv_sha256"):
        errors.append("input_provenance.csv_sha256 missing")
    return errors


def rebuild_from_versioned_csv() -> dict:
    if not VERSIONED_CSV.exists() or not VERSIONED_META.exists():
        raise FileNotFoundError("versioned CHIRPS CSV/metadata missing")
    pentads = load_versioned_pentads()
    metadata = load_versioned_metadata()
    keys = iter_year_month_pentads(AVAILABLE_START, AVAILABLE_END)
    series = expand_pentads_to_daily(pentads, AVAILABLE_START, AVAILABLE_END)
    valid = sum(1 for value in pentads.values() if is_valid_precip(value))
    return build_document(series, metadata, valid, len(keys))


def compare_shipped_with_rebuild(shipped: dict, rebuilt: dict) -> list[str]:
    left = json.dumps(shipped, indent=2, ensure_ascii=False)
    right = json.dumps(rebuilt, indent=2, ensure_ascii=False)
    if left == right:
        return []
    return [
        "shipped climate_context.json does not match a deterministic rebuild from the versioned CSV"
    ]


def main() -> int:
    path = OUTPUT
    if not path.exists():
        print(f"missing {path}")
        return 1
    document = load_climate_context(path)
    errors = validate_climate_context(document)
    try:
        rebuilt = rebuild_from_versioned_csv()
        errors.extend(compare_shipped_with_rebuild(document, rebuilt))
        print(f"versioned CSV sha256={sha256_file(VERSIONED_CSV)}")
    except FileNotFoundError as error:
        errors.append(str(error))
    if errors:
        print("\n".join(errors))
        return 1
    print(f"climate_context.json ok ({path})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
