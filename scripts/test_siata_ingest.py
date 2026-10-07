from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

import numpy as np
import pandas as pd

from siata_ingest import (
    cumulative_to_increment,
    ingest,
    make_replay,
    rainfall_features_for_station,
)


class SiataIngestTests(unittest.TestCase):
    def test_missing_bins_are_not_filled_with_zero(self):
        timestamps = pd.Series(
            pd.to_datetime([
                "2022-06-18 00:00",
                "2022-06-18 00:10",
                "2022-06-18 00:30",
            ])
        )
        rain = pd.Series([1.0, 2.0, 4.0])
        features = rainfall_features_for_station(
            timestamps,
            rain,
            interval="10min",
            min_coverage=0.8,
        )
        self.assertTrue(np.isnan(features.loc[pd.Timestamp("2022-06-18 00:20"), "rain_increment_mm"]))
        self.assertLess(
            features.loc[pd.Timestamp("2022-06-18 00:30"), "r1h_mm_coverage"],
            0.8,
        )
        self.assertTrue(np.isnan(features.loc[pd.Timestamp("2022-06-18 00:30"), "r1h_mm"]))

    def test_complete_window_produces_accumulation(self):
        timestamps = pd.Series(
            pd.date_range("2022-06-18 00:00", periods=7, freq="10min")
        )
        rain = pd.Series([1.0] * 7)
        features = rainfall_features_for_station(
            timestamps,
            rain,
            interval="10min",
            min_coverage=1.0,
        )
        value = features.loc[pd.Timestamp("2022-06-18 01:00"), "r1h_mm"]
        self.assertAlmostEqual(value, 6.0)

    def test_cumulative_reset_conversion(self):
        cumulative = pd.Series([0.0, 1.0, 3.0, 0.5, 1.5])
        increments = cumulative_to_increment(cumulative)
        self.assertEqual(increments.tolist(), [0.0, 1.0, 2.0, 0.5, 1.0])

    def test_auto_detection_and_quality_report(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "rain.csv"
            pd.DataFrame(
                {
                    "fecha_hora": [
                        "2022-06-18 00:00",
                        "2022-06-18 00:10",
                    ],
                    "precipitacion_mm": [1.0, 2.0],
                    "estacion": [499, 499],
                }
            ).to_csv(path, index=False)

            features, report = ingest(path)
            self.assertEqual(report.timestamp_column, "fecha_hora")
            self.assertEqual(report.rain_column, "precipitacion_mm")
            self.assertEqual(report.station_column, "estacion")
            self.assertEqual(report.stations, 1)
            self.assertEqual(len(features), 2)

    def test_replay_serializes_missing_accumulations_as_null(self):
        timestamps = pd.Series(
            pd.to_datetime([
                "2022-06-18 00:00",
                "2022-06-18 00:20",
            ])
        )
        rain = pd.Series([1.0, 1.0])
        features = rainfall_features_for_station(
            timestamps,
            rain,
            interval="10min",
            min_coverage=1.0,
        ).reset_index()
        features["station_id"] = "499"
        replay = make_replay(features)
        self.assertIsNone(replay["timeline"][-1]["r1h_mm"])


if __name__ == "__main__":
    unittest.main()
