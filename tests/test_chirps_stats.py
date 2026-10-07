"""Unit tests for CHIRPS statistics: nodata, percentiles, rolling windows, leap years."""
from __future__ import annotations

import sys
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from chirps_stats import (  # noqa: E402
    build_scenario_presets,
    daterange,
    empirical_percentile,
    expand_pentads_to_daily,
    is_leap_year,
    is_valid_precip,
    iter_year_month_pentads,
    observed_maximum,
    pentad_days,
    percentile_table,
    rolling_sums,
    summarize_series,
)


class NodataTests(unittest.TestCase):
    def test_rejects_chirps_nodata_and_nan(self):
        self.assertFalse(is_valid_precip(-9999))
        self.assertFalse(is_valid_precip(-9999.0))
        self.assertFalse(is_valid_precip(float("nan")))
        self.assertFalse(is_valid_precip(None))
        self.assertFalse(is_valid_precip(-0.2))
        self.assertTrue(is_valid_precip(0.0))
        self.assertTrue(is_valid_precip(12.4))


class PercentileTests(unittest.TestCase):
    def test_linear_percentile_on_simple_series(self):
        values = [0, 10, 20, 30, 40]
        self.assertEqual(empirical_percentile(values, 0), 0)
        self.assertEqual(empirical_percentile(values, 100), 40)
        self.assertEqual(empirical_percentile(values, 50), 20)
        self.assertAlmostEqual(empirical_percentile(values, 75), 30)
        self.assertIsNone(empirical_percentile([], 50))

    def test_percentiles_ignore_nodata(self):
        table = percentile_table([-9999, 1, 2, 3, 4, float("nan")])
        self.assertAlmostEqual(table["p50"], 2.5)
        self.assertAlmostEqual(table["p99"], 3.97)


class RollingTests(unittest.TestCase):
    def test_trailing_window_requires_complete_valid_days(self):
        series = [
            (date(2020, 1, 1), 1.0),
            (date(2020, 1, 2), 2.0),
            (date(2020, 1, 3), 3.0),
            (date(2020, 1, 4), None),
            (date(2020, 1, 5), 5.0),
        ]
        windowed = rolling_sums(series, 3)
        self.assertIsNone(windowed[0][1])
        self.assertIsNone(windowed[1][1])
        self.assertEqual(windowed[2][1], 6.0)
        self.assertIsNone(windowed[3][1])
        self.assertIsNone(windowed[4][1])

    def test_three_day_sum_on_wet_spell(self):
        series = [
            (date(2020, 6, day), float(day))
            for day in range(1, 6)
        ]
        windowed = dict(rolling_sums(series, 3))
        self.assertEqual(windowed[date(2020, 6, 3)], 6.0)
        self.assertEqual(windowed[date(2020, 6, 5)], 12.0)


class PentadTests(unittest.TestCase):
    def test_standard_and_month_end_pentads(self):
        self.assertEqual(
            pentad_days(2001, 6, 1),
            [date(2001, 6, day) for day in range(1, 6)],
        )
        self.assertEqual(pentad_days(2001, 6, 6)[-1], date(2001, 6, 30))
        self.assertEqual(len(pentad_days(2001, 2, 6)), 3)
        self.assertEqual(pentad_days(2000, 2, 6)[-1], date(2000, 2, 29))
        self.assertEqual(len(pentad_days(2000, 2, 6)), 4)

    def test_uniform_allocation_preserves_pentad_mass(self):
        totals = {(2001, 1, 1): 10.0, (2001, 1, 2): None}
        daily = dict(expand_pentads_to_daily(totals, date(2001, 1, 1), date(2001, 1, 10)))
        self.assertEqual(daily[date(2001, 1, 1)], 2.0)
        self.assertEqual(daily[date(2001, 1, 5)], 2.0)
        self.assertIsNone(daily[date(2001, 1, 6)])
        windowed = dict(rolling_sums(expand_pentads_to_daily(totals, date(2001, 1, 1), date(2001, 1, 10)), 5))
        self.assertEqual(windowed[date(2001, 1, 5)], 10.0)

    def test_pentad_count_for_available_record(self):
        keys = iter_year_month_pentads(date(1981, 1, 1), date(2024, 12, 31))
        self.assertEqual(len(keys), 44 * 12 * 6)


class LeapYearTests(unittest.TestCase):
    def test_leap_day_is_included_only_in_leap_years(self):
        self.assertTrue(is_leap_year(1992))
        self.assertFalse(is_leap_year(1991))
        self.assertTrue(is_leap_year(2000))
        self.assertFalse(is_leap_year(1900))
        days = daterange(date(1992, 2, 28), date(1992, 3, 1))
        self.assertEqual(
            days,
            [date(1992, 2, 28), date(1992, 2, 29), date(1992, 3, 1)],
        )
        non_leap = daterange(date(1991, 2, 28), date(1991, 3, 1))
        self.assertEqual(non_leap, [date(1991, 2, 28), date(1991, 3, 1)])

    def test_climatology_length_includes_leap_days(self):
        days = daterange(date(1991, 1, 1), date(2020, 12, 31))
        self.assertEqual(len(days), 10958)
        self.assertEqual(sum(1 for day in days if day.month == 2 and day.day == 29), 8)


class PresetTests(unittest.TestCase):
    def test_presets_use_15_day_percentiles(self):
        series = [(date(2000, 1, 1) + __import__("datetime").timedelta(days=i), float(i % 20)) for i in range(400)]
        summary = summarize_series(series)
        summary["period"] = "1991-2020"
        presets = build_scenario_presets(summary)
        self.assertEqual([item["id"] for item in presets], [
            "typical_wet",
            "high_rainfall",
            "extreme_observed",
        ])
        by_id = {item["id"]: item for item in presets}
        self.assertEqual(by_id["typical_wet"]["percentile"], 75)
        self.assertEqual(by_id["high_rainfall"]["percentile"], 90)
        self.assertEqual(by_id["extreme_observed"]["percentile"], 99)
        self.assertLess(
            by_id["typical_wet"]["precipitation_mm"],
            by_id["high_rainfall"]["precipitation_mm"],
        )
        self.assertLess(
            by_id["high_rainfall"]["precipitation_mm"],
            by_id["extreme_observed"]["precipitation_mm"],
        )
        self.assertNotIn("soil", str(presets).lower())
        self.assertNotIn("wetness", str(presets).lower())

    def test_observed_maximum_returns_date(self):
        series = [
            (date(2001, 1, 1), 1.0),
            (date(2001, 1, 2), 9.5),
            (date(2001, 1, 3), -9999),
        ]
        maximum = observed_maximum(series)
        self.assertEqual(maximum["value_mm"], 9.5)
        self.assertEqual(maximum["date"], "2001-01-02")


if __name__ == "__main__":
    unittest.main()
