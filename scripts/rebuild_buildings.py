from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd
from shapely.geometry import box

from geojson_io import read_local_geojson

BBOX = (-75.541116, 6.250378, -75.536620, 6.254920)
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "frontend" / "public" / "data" / "buildings.geojson"


def rebuild(source_path: Path) -> int:
    buildings = read_local_geojson(source_path)
    sandbox = box(*BBOX)
    buildings = buildings[
        buildings.geometry.representative_point().within(sandbox)
    ].copy()

    required = {
        "objectid",
        "numero_pisos",
        "hazard_max",
        "slope_deg",
        "estrato",
        "population_proxy",
        "cell_id",
    }
    missing = sorted(required.difference(buildings.columns))
    if missing:
        raise ValueError(
            "Source is not the fully enriched building dataset. "
            f"Missing columns: {', '.join(missing)}"
        )

    buildings["height_m"] = (
        pd.to_numeric(buildings["numero_pisos"], errors="coerce")
        .fillna(1)
        .clip(lower=1, upper=20)
        * 3
    )
    OUTPUT.write_text(buildings.to_json(), encoding="utf-8")
    return len(buildings)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    args = parser.parse_args()

    if not args.source.exists():
        raise FileNotFoundError(args.source)

    count = rebuild(args.source)
    print(f"Wrote {OUTPUT} with {count:,} buildings.")


if __name__ == "__main__":
    main()
