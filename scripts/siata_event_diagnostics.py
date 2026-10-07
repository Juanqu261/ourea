"""Historical-event diagnostics for OUREA SIATA features.

This module deliberately stops short of fitting/calibrating a landslide model.
It consumes the output of ``siata_ingest.py`` and summarizes the rainfall state
around a known event timestamp so the June 2022 hindcast can be inspected
without manufacturing labels or filling missing data.

Example:
    python scripts/siata_event_diagnostics.py \
        data/derived/siata_features.csv \
        --event-time 2022-06-20T12:00:00 \
        --before-hours 360 \
        --after-hours 48

The exact June 2022 event timestamp must be verified before final use; the
script intentionally requires the caller to supply it.
"""
from __future__ import annotations

from pathlib import Path
import argparse
import json

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DERIVED = ROOT / "data" / "derived"

ACCUMULATION_FIELDS = (
    "r1h_mm",
    "r6h_mm",
    "r24h_mm",
    "r3d_mm",
    "r7d_mm",
    "r15d_mm",
)


def _number(value):
    return None if pd.isna(value) else round(float(value), 3)


def _nearest_valid(group: pd.DataFrame, event_time: pd.Timestamp):
    if group.empty:
        return None
    distance = (group["timestamp"] - event_time).abs()
    index = distance.idxmin()
    row = group.loc[index]
    return row, distance.loc[index]


def summarize_event(
    features: pd.DataFrame,
    event_time: pd.Timestamp,
    *,
    before_hours: float = 360,
    after_hours: float = 48,
    nearest_tolerance_minutes: float = 30,
) -> dict:
    required = {"timestamp", "station_id", "rain_increment_mm"}
    missing = required.difference(features.columns)
    if missing:
        raise ValueError(f"Missing required SIATA feature columns: {sorted(missing)}")

    frame = features.copy()
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], errors="coerce")
    frame = frame.dropna(subset=["timestamp"]).sort_values("timestamp")
    event_time = pd.Timestamp(event_time)

    start = event_time - pd.Timedelta(hours=float(before_hours))
    end = event_time + pd.Timedelta(hours=float(after_hours))
    frame = frame[(frame["timestamp"] >= start) & (frame["timestamp"] <= end)].copy()

    stations = []
    tolerance = pd.Timedelta(minutes=float(nearest_tolerance_minutes))

    for station_id, group in frame.groupby("station_id", dropna=False):
        nearest = _nearest_valid(group, event_time)
        if nearest is None:
            continue
        nearest_row, nearest_distance = nearest

        record = {
            "station_id": str(station_id),
            "rows_in_window": int(len(group)),
            "window_start": group["timestamp"].min().isoformat(),
            "window_end": group["timestamp"].max().isoformat(),
            "nearest_timestamp": nearest_row["timestamp"].isoformat(),
            "nearest_distance_minutes": round(nearest_distance.total_seconds() / 60, 3),
            "nearest_within_tolerance": bool(nearest_distance <= tolerance),
            "event_state": {},
            "pre_event_peaks": {},
            "coverage_at_event": {},
        }

        for field in ACCUMULATION_FIELDS:
            if field in group.columns:
                record["event_state"][field] = _number(nearest_row.get(field))
                pre = group[group["timestamp"] <= event_time]
                record["pre_event_peaks"][field] = _number(
                    pd.to_numeric(pre[field], errors="coerce").max()
                )

            coverage_field = f"{field}_coverage"
            if coverage_field in group.columns:
                record["coverage_at_event"][coverage_field] = _number(
                    nearest_row.get(coverage_field)
                )

        stations.append(record)

    valid_nearest = [
        item for item in stations if item["nearest_within_tolerance"]
    ]

    return {
        "status": "raw-rainfall-event-diagnostic-not-landslide-calibration",
        "event_time": event_time.isoformat(),
        "analysis_window": {
            "start": start.isoformat(),
            "end": end.isoformat(),
            "before_hours": float(before_hours),
            "after_hours": float(after_hours),
        },
        "nearest_tolerance_minutes": float(nearest_tolerance_minutes),
        "stations_in_window": len(stations),
        "stations_with_event_nearest_within_tolerance": len(valid_nearest),
        "stations": stations,
        "guardrails": [
            "This output summarizes observed rainfall features around a known event timestamp.",
            "It is not a calibrated landslide probability or causal attribution model.",
            "Missing accumulations remain null and must not be interpreted as zero rainfall.",
            "The exact event timestamp and relevant SIATA stations must be verified before final hindcast claims.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("features_csv", type=Path)
    parser.add_argument("--event-time", required=True)
    parser.add_argument("--before-hours", type=float, default=360)
    parser.add_argument("--after-hours", type=float, default=48)
    parser.add_argument("--nearest-tolerance-minutes", type=float, default=30)
    parser.add_argument(
        "--output",
        type=Path,
        default=DERIVED / "siata_event_diagnostic.json",
    )
    args = parser.parse_args()

    if not args.features_csv.exists():
        raise FileNotFoundError(args.features_csv)

    features = pd.read_csv(args.features_csv)
    report = summarize_event(
        features,
        pd.Timestamp(args.event_time),
        before_hours=args.before_hours,
        after_hours=args.after_hours,
        nearest_tolerance_minutes=args.nearest_tolerance_minutes,
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
