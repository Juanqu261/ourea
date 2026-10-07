from __future__ import annotations

import unittest
import pandas as pd

from siata_event_diagnostics import summarize_event


class SiataEventDiagnosticsTests(unittest.TestCase):
    def fixture(self):
        times = pd.date_range("2022-06-20 11:00", periods=7, freq="10min")
        return pd.DataFrame(
            {
                "timestamp": list(times) * 2,
                "station_id": ["A"] * 7 + ["B"] * 7,
                "rain_increment_mm": [0, 1, 1, 2, 0, 0, 0] * 2,
                "r1h_mm": [0, 1, 2, 4, 4, 4, 4] * 2,
                "r24h_mm": [20, 21, 22, 24, 24, 24, 24] * 2,
                "r15d_mm": [100, 101, 102, 104, 104, 104, 104] * 2,
                "r1h_mm_coverage": [1.0] * 14,
                "r24h_mm_coverage": [0.9] * 14,
                "r15d_mm_coverage": [0.85] * 14,
            }
        )

    def test_event_summary_uses_nearest_observation_and_preserves_peaks(self):
        report = summarize_event(
            self.fixture(),
            pd.Timestamp("2022-06-20 11:31"),
            before_hours=1,
            after_hours=1,
            nearest_tolerance_minutes=10,
        )
        self.assertEqual(report["stations_in_window"], 2)
        self.assertEqual(report["stations_with_event_nearest_within_tolerance"], 2)
        station = report["stations"][0]
        self.assertEqual(station["nearest_timestamp"], "2022-06-20T11:30:00")
        self.assertEqual(station["event_state"]["r1h_mm"], 4.0)
        self.assertEqual(station["pre_event_peaks"]["r24h_mm"], 24.0)
        self.assertEqual(station["coverage_at_event"]["r15d_mm_coverage"], 0.85)

    def test_event_summary_does_not_invent_missing_accumulations(self):
        frame = self.fixture()
        frame.loc[3, "r24h_mm"] = float("nan")
        report = summarize_event(
            frame,
            pd.Timestamp("2022-06-20 11:30"),
            nearest_tolerance_minutes=1,
        )
        station_a = next(item for item in report["stations"] if item["station_id"] == "A")
        self.assertIsNone(station_a["event_state"]["r24h_mm"])
        self.assertEqual(station_a["pre_event_peaks"]["r24h_mm"], 22.0)

    def test_missing_required_columns_fail_visibly(self):
        with self.assertRaisesRegex(ValueError, "Missing required SIATA feature columns"):
            summarize_event(
                pd.DataFrame({"timestamp": ["2022-06-20"]}),
                pd.Timestamp("2022-06-20"),
            )


if __name__ == "__main__":
    unittest.main()
