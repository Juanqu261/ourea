"""Pure, deterministic CHIRPS precipitation statistics for Ourea.

These functions never download data. They operate on already-extracted series
and document how Ourea converts gridded rainfall into planning-scenario presets.
They do not estimate landslide probability or station-intensity rainfall.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable, Mapping, Sequence

NODATA_SENTINELS = (-9999.0, -9999, None)
PERCENTILES = (50, 75, 90, 95, 99)
ROLLING_WINDOWS_DAYS = (3, 7, 15, 30)

# Llanaditas / upper Comuna 8 proving-ground centroid (EPSG:4326).
LLANADITAS_LON = -75.53887
LLANADITAS_LAT = 6.25265
LLANADITAS_BBOX = (-75.541116, 6.250378, -75.53662, 6.25492)

CLIMATOLOGY_START = date(1991, 1, 1)
CLIMATOLOGY_END = date(2020, 12, 31)
AVAILABLE_START = date(1981, 1, 1)
AVAILABLE_END = date(2024, 12, 31)


def is_valid_precip(value: object, nodata: float = -9999.0) -> bool:
    if value is None:
        return False
    try:
        number = float(value)
    except (TypeError, ValueError):
        return False
    if number != number:  # NaN
        return False
    if number == float(nodata) or number in NODATA_SENTINELS:
        return False
    if number < 0:
        return False
    return True


def daterange(start: date, end: date) -> list[date]:
    """Inclusive calendar dates, including 29 February in leap years."""
    if end < start:
        raise ValueError("end precedes start")
    days = []
    current = start
    one = timedelta(days=1)
    while current <= end:
        days.append(current)
        current += one
    return days


def last_day_of_month(year: int, month: int) -> date:
    if month == 12:
        return date(year, 12, 31)
    return date(year, month + 1, 1) - timedelta(days=1)


def pentad_days(year: int, month: int, pentad: int) -> list[date]:
    """CHIRPS pentad calendar: 1–5, 6–10, 11–15, 16–20, 21–25, 26–end of month."""
    if not 1 <= month <= 12:
        raise ValueError("month must be in 1..12")
    if not 1 <= pentad <= 6:
        raise ValueError("pentad must be in 1..6")
    if pentad < 6:
        start_day = 1 + (pentad - 1) * 5
        return [date(year, month, start_day + offset) for offset in range(5)]
    return daterange(date(year, month, 26), last_day_of_month(year, month))


def iter_year_month_pentads(start: date, end: date) -> list[tuple[int, int, int]]:
    keys: list[tuple[int, int, int]] = []
    year, month = start.year, start.month
    while date(year, month, 1) <= end:
        for pentad in range(1, 7):
            days = pentad_days(year, month, pentad)
            if days[-1] < start or days[0] > end:
                continue
            keys.append((year, month, pentad))
        if month == 12:
            year += 1
            month = 1
        else:
            month += 1
    return keys


def expand_pentads_to_daily(
    pentad_totals: Mapping[tuple[int, int, int], float | None],
    start: date,
    end: date,
) -> list[tuple[date, float | None]]:
    """Allocate each pentad total uniformly across its calendar days.

    This preserves pentad mass, so 15- and 30-day trailing sums match the
    native CHIRPS pentad product. Intra-pentad timing is not observed.
    """
    daily: dict[date, float | None] = {day: None for day in daterange(start, end)}
    for (year, month, pentad), total in pentad_totals.items():
        days = pentad_days(year, month, pentad)
        if not is_valid_precip(total):
            continue
        share = float(total) / len(days)
        for day in days:
            if day in daily:
                daily[day] = share
    return [(day, daily[day]) for day in daterange(start, end)]


def is_leap_year(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def empirical_percentile(values: Sequence[float], percentile: float) -> float | None:
    """Hyndman-Fan type 7 (linear) empirical percentile.

    Empty input returns None. Percentile is in [0, 100].
    """
    if percentile < 0 or percentile > 100:
        raise ValueError("percentile must be in [0, 100]")
    sample = sorted(float(value) for value in values if is_valid_precip(value))
    n = len(sample)
    if n == 0:
        return None
    if n == 1:
        return sample[0]
    rank = (percentile / 100.0) * (n - 1)
    lower = int(rank)
    upper = min(lower + 1, n - 1)
    weight = rank - lower
    return sample[lower] * (1.0 - weight) + sample[upper] * weight


def percentile_table(values: Sequence[float], percentiles: Sequence[float] = PERCENTILES) -> dict[str, float | None]:
    return {f"p{int(p)}": _round_mm(empirical_percentile(values, p)) for p in percentiles}


def rolling_sums(
    dated_values: Sequence[tuple[date, float | None]],
    window: int,
    *,
    min_valid: int | None = None,
) -> list[tuple[date, float | None]]:
    """Trailing inclusive rolling sums. Incomplete windows are None."""
    if window < 1:
        raise ValueError("window must be >= 1")
    needed = min_valid if min_valid is not None else window
    series = list(dated_values)
    out: list[tuple[date, float | None]] = []
    running: list[float | None] = []
    for day, value in series:
        running.append(value if is_valid_precip(value) else None)
        if len(running) > window:
            running.pop(0)
        if len(running) < window:
            out.append((day, None))
            continue
        valid = [item for item in running if item is not None]
        if len(valid) < needed:
            out.append((day, None))
            continue
        out.append((day, sum(valid)))
    return out


def valid_values(dated_values: Iterable[tuple[date, float | None]]) -> list[float]:
    return [float(value) for _, value in dated_values if is_valid_precip(value)]


def coverage(dated_values: Sequence[tuple[date, float | None]]) -> dict[str, object]:
    dates = [day for day, _ in dated_values]
    valid_dates = [day for day, value in dated_values if is_valid_precip(value)]
    return {
        "start": dates[0].isoformat() if dates else None,
        "end": dates[-1].isoformat() if dates else None,
        "calendar_days": len(dates),
        "valid_days": len(valid_dates),
        "missing_or_nodata_days": len(dates) - len(valid_dates),
        "first_valid": valid_dates[0].isoformat() if valid_dates else None,
        "last_valid": valid_dates[-1].isoformat() if valid_dates else None,
        "leap_days_in_calendar": sum(
            1 for day in dates if day.month == 2 and day.day == 29
        ),
        "leap_days_valid": sum(
            1 for day in valid_dates if day.month == 2 and day.day == 29
        ),
    }


def observed_maximum(dated_values: Sequence[tuple[date, float | None]]) -> dict[str, object]:
    valid = [(day, float(value)) for day, value in dated_values if is_valid_precip(value)]
    if not valid:
        return {"value_mm": None, "date": None}
    day, value = max(valid, key=lambda item: item[1])
    return {"value_mm": _round_mm(value), "date": day.isoformat()}


def _round_mm(value: float | None, digits: int = 3) -> float | None:
    if value is None:
        return None
    return round(float(value), digits)


def filter_period(
    dated_values: Sequence[tuple[date, float | None]],
    start: date,
    end: date,
) -> list[tuple[date, float | None]]:
    return [(day, value) for day, value in dated_values if start <= day <= end]


def summarize_series(
    dated_values: Sequence[tuple[date, float | None]],
    *,
    windows: Sequence[int] = ROLLING_WINDOWS_DAYS,
    percentiles: Sequence[float] = PERCENTILES,
) -> dict[str, object]:
    daily = valid_values(dated_values)
    rolling: dict[str, object] = {}
    maxima: dict[str, object] = {"daily": observed_maximum(dated_values)}
    for window in windows:
        windowed = rolling_sums(dated_values, window)
        values = valid_values(windowed)
        rolling[str(window)] = {
            "window_days": window,
            "percentiles": percentile_table(values, percentiles),
            "valid_windows": len(values),
            "observed_maxima": observed_maximum(windowed),
        }
        maxima[f"rolling_{window}d"] = observed_maximum(windowed)
    return {
        "daily_percentiles": percentile_table(daily, percentiles),
        "daily_valid_days": len(daily),
        "coverage": coverage(dated_values),
        "rolling_accumulation_percentiles": rolling,
        "observed_maxima": maxima,
    }


def build_scenario_presets(climatology: Mapping[str, object]) -> list[dict[str, object]]:
    """Map observational percentiles onto named planning scenarios.

    Rain depth is the 15-day trailing accumulation at the named percentile.
    Antecedent rainfall context is the matching historical percentile (0-1),
    not measured soil moisture.
    """
    rolling = climatology["rolling_accumulation_percentiles"]
    window = rolling["15"]
    percentiles = window["percentiles"]
    period = climatology.get("period") or "1991-2020"
    specs = (
        ("typical_wet", "Typical wet conditions", 75, 0.50),
        ("high_rainfall", "High rainfall context", 90, 0.75),
        ("extreme_observed", "Extreme observed context", 99, 0.90),
    )
    presets = []
    for preset_id, label, percentile, antecedent in specs:
        precip = percentiles[f"p{percentile}"]
        presets.append(
            {
                "id": preset_id,
                "label": label,
                "accumulation_window_days": 15,
                "precipitation_mm": precip,
                "percentile": percentile,
                "antecedent_window_days": 30,
                "antecedent_rainfall_percentile": antecedent,
                "climatology_period": period,
                "source_name": "CHIRPS v3.0 Final",
                "source_product": "pentads/latam (Final)",
            }
        )
    return presets
