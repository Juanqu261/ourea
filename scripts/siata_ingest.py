"""SIATA rainfall ingestion adapter for Ourea.

Missing rainfall stays missing. Cumulative-gauge conversion is explicit. Rolling
accumulations require coverage. Feature extraction stays separate from climate-stress
calibration.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
import argparse
import json
from typing import Iterable

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DERIVED = ROOT / "data" / "derived"
PUBLIC = ROOT / "frontend" / "public" / "data"

DEFAULT_INTERVAL = "10min"
DEFAULT_MIN_COVERAGE = 0.80

WINDOWS = {
    "r1h_mm": pd.Timedelta(hours=1),
    "r6h_mm": pd.Timedelta(hours=6),
    "r24h_mm": pd.Timedelta(hours=24),
    "r3d_mm": pd.Timedelta(days=3),
    "r7d_mm": pd.Timedelta(days=7),
    "r15d_mm": pd.Timedelta(days=15),
}

COLUMN_CANDIDATES = {
    "timestamp": (
        "timestamp", "fecha_hora", "fecha", "datetime", "date_time",
        "fecha_registro", "hora_fecha",
    ),
    "rain": (
        "precipitacion_mm", "precipitacion", "lluvia_mm", "lluvia",
        "rain_mm", "rainfall_mm", "valor",
    ),
    "station": (
        "station_id", "estacion", "codigo_estacion", "id_estacion",
        "station", "codigo",
    ),
}


@dataclass
class QualityReport:
    source_file: str
    timestamp_column: str
    rain_column: str
    station_column: str | None
    rain_mode: str
    interval: str
    min_window_coverage: float
    input_rows: int
    valid_rows: int
    dropped_invalid_rows: int
    negative_increment_rows: int
    stations: int
    start_timestamp: str | None
    end_timestamp: str | None


def _normalize_column(name: str) -> str:
    return str(name).strip().casefold()


def resolve_column(
    columns: Iterable[str],
    explicit: str | None,
    role: str,
    required: bool = True,
) -> str | None:
    columns = list(columns)
    normalized = {_normalize_column(column): column for column in columns}

    if explicit:
        key = _normalize_column(explicit)
        if key not in normalized:
            raise ValueError(
                f"Column '{explicit}' was requested for {role}, but was not found. "
                f"Available columns: {columns}"
            )
        return normalized[key]

    for candidate in COLUMN_CANDIDATES[role]:
        if _normalize_column(candidate) in normalized:
            return normalized[_normalize_column(candidate)]

    if required:
        raise ValueError(
            f"Could not auto-detect the {role} column. "
            f"Pass --{role} explicitly. Available columns: {columns}"
        )
    return None


def read_source(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, sep=None, engine="python")


def cumulative_to_increment(series: pd.Series) -> pd.Series:
    """Convert an explicitly-declared cumulative gauge to increments.

    Negative differences are treated as gauge/reset boundaries: the current
    cumulative value becomes the first increment after reset. This behavior is
    recorded in the quality metadata and should be reviewed against SIATA's
    delivered field definition before final calibration.
    """
    numeric = pd.to_numeric(series, errors="coerce")
    diff = numeric.diff()
    reset = diff < 0
    increment = diff.copy()
    increment.iloc[0] = numeric.iloc[0]
    increment.loc[reset] = numeric.loc[reset]
    return increment


def _expected_bins(window: pd.Timedelta, interval: pd.Timedelta) -> int:
    return max(1, int(round(window / interval)))


def rainfall_features_for_station(
    timestamps: pd.Series,
    rain_values: pd.Series,
    *,
    interval: str = DEFAULT_INTERVAL,
    min_coverage: float = DEFAULT_MIN_COVERAGE,
) -> pd.DataFrame:
    if not 0 < min_coverage <= 1:
        raise ValueError("min_coverage must be within (0, 1].")

    frame = pd.DataFrame(
        {
            "timestamp": pd.to_datetime(timestamps, errors="coerce"),
            "rain_increment_mm": pd.to_numeric(rain_values, errors="coerce"),
        }
    ).dropna(subset=["timestamp"])

    frame = frame.sort_values("timestamp").set_index("timestamp")
    rain = frame["rain_increment_mm"].resample(interval).sum(min_count=1)

    output = pd.DataFrame({"rain_increment_mm": rain})
    interval_td = pd.Timedelta(interval)

    for name, window in WINDOWS.items():
        expected = _expected_bins(window, interval_td)
        rolling = rain.rolling(window, min_periods=1)
        accumulation = rolling.sum()
        coverage = rolling.count() / expected

        output[name] = accumulation.where(coverage >= min_coverage)
        output[f"{name}_coverage"] = np.clip(coverage, 0, 1)

    return output


def ingest(
    path: Path,
    *,
    timestamp_col: str | None = None,
    rain_col: str | None = None,
    station_col: str | None = None,
    rain_mode: str = "increment",
    interval: str = DEFAULT_INTERVAL,
    min_coverage: float = DEFAULT_MIN_COVERAGE,
) -> tuple[pd.DataFrame, QualityReport]:
    raw = read_source(path)
    timestamp_col = resolve_column(raw.columns, timestamp_col, "timestamp")
    rain_col = resolve_column(raw.columns, rain_col, "rain")
    station_col = resolve_column(
        raw.columns,
        station_col,
        "station",
        required=False,
    )

    frame = raw.copy()
    frame["_timestamp"] = pd.to_datetime(frame[timestamp_col], errors="coerce")
    frame["_rain_raw"] = pd.to_numeric(frame[rain_col], errors="coerce")
    if station_col:
        frame["_station"] = frame[station_col].astype("string").fillna("unknown")
    else:
        frame["_station"] = "station"

    before = len(frame)
    frame = frame.dropna(subset=["_timestamp", "_rain_raw"]).copy()

    if rain_mode == "increment":
        frame["_rain_increment"] = frame["_rain_raw"]
    elif rain_mode == "cumulative":
        frame = frame.sort_values(["_station", "_timestamp"])
        frame["_rain_increment"] = (
            frame.groupby("_station", group_keys=False)["_rain_raw"]
            .apply(cumulative_to_increment)
        )
    else:
        raise ValueError("rain_mode must be 'increment' or 'cumulative'.")

    negative_rows = int((frame["_rain_increment"] < 0).sum())
    frame.loc[frame["_rain_increment"] < 0, "_rain_increment"] = np.nan

    outputs = []
    for station_id, group in frame.groupby("_station", dropna=False):
        features = rainfall_features_for_station(
            group["_timestamp"],
            group["_rain_increment"],
            interval=interval,
            min_coverage=min_coverage,
        )
        features["station_id"] = str(station_id)
        outputs.append(features.reset_index())

    result = (
        pd.concat(outputs, ignore_index=True)
        if outputs
        else pd.DataFrame()
    )

    start = frame["_timestamp"].min()
    end = frame["_timestamp"].max()
    report = QualityReport(
        source_file=str(path),
        timestamp_column=timestamp_col,
        rain_column=rain_col,
        station_column=station_col,
        rain_mode=rain_mode,
        interval=interval,
        min_window_coverage=float(min_coverage),
        input_rows=before,
        valid_rows=len(frame),
        dropped_invalid_rows=before - len(frame),
        negative_increment_rows=negative_rows,
        stations=int(frame["_station"].nunique()),
        start_timestamp=start.isoformat() if pd.notna(start) else None,
        end_timestamp=end.isoformat() if pd.notna(end) else None,
    )
    return result, report


def _nullable_number(value):
    return None if pd.isna(value) else round(float(value), 3)


def make_replay(features: pd.DataFrame) -> dict:
    if features.empty:
        return {
            "status": "raw rainfall features; no valid rows available",
            "aggregation": "median across available nearby stations",
            "timeline": [],
        }

    aggregation = {
        "rain_increment_mm": "median",
        **{name: "median" for name in WINDOWS},
        **{f"{name}_coverage": "median" for name in WINDOWS},
        "station_id": "nunique",
    }
    by_time = (
        features.groupby("timestamp")
        .agg(aggregation)
        .reset_index()
        .rename(columns={"station_id": "station_count"})
    )

    timeline = []
    for _, row in by_time.iterrows():
        item = {
            "timestamp": row["timestamp"].isoformat(),
            "rain_increment_mm": _nullable_number(row["rain_increment_mm"]),
            "station_count": int(row["station_count"]),
        }
        for name in WINDOWS:
            item[name] = _nullable_number(row[name])
            item[f"{name}_coverage"] = _nullable_number(
                row[f"{name}_coverage"]
            )
        timeline.append(item)

    return {
        "status": (
            "raw rainfall features only; dynamic climate-stress calibration "
            "and historical validation are still required"
        ),
        "aggregation": (
            "median across available nearby stations; missing intervals are "
            "preserved and rolling features require coverage threshold"
        ),
        "timeline": timeline,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("csv", type=Path)
    parser.add_argument("--timestamp")
    parser.add_argument("--rain")
    parser.add_argument("--station")
    parser.add_argument(
        "--mode",
        choices=["increment", "cumulative"],
        default="increment",
    )
    parser.add_argument("--interval", default=DEFAULT_INTERVAL)
    parser.add_argument(
        "--min-coverage",
        type=float,
        default=DEFAULT_MIN_COVERAGE,
    )
    args = parser.parse_args()

    if not args.csv.exists():
        raise FileNotFoundError(args.csv)

    DERIVED.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)

    features, quality = ingest(
        args.csv,
        timestamp_col=args.timestamp,
        rain_col=args.rain,
        station_col=args.station,
        rain_mode=args.mode,
        interval=args.interval,
        min_coverage=args.min_coverage,
    )

    features.to_csv(DERIVED / "siata_features.csv", index=False)
    (DERIVED / "siata_quality_report.json").write_text(
        json.dumps(asdict(quality), indent=2) + "\n",
        encoding="utf-8",
    )
    replay = make_replay(features)
    (PUBLIC / "replay_timeline.json").write_text(
        json.dumps(replay, indent=2) + "\n",
        encoding="utf-8",
    )

    print(json.dumps(asdict(quality), indent=2))
    print(
        "Wrote data/derived/siata_features.csv, "
        "data/derived/siata_quality_report.json, and "
        "frontend/public/data/replay_timeline.json"
    )


if __name__ == "__main__":
    main()
