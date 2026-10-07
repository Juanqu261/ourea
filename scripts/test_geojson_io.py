from __future__ import annotations

from pathlib import Path
import json
import tempfile
import unittest

from geojson_io import DEFAULT_CRS, GeoJsonLoadError, read_local_geojson


def write_geojson(payload: dict) -> Path:
    handle = tempfile.NamedTemporaryFile(
        "w",
        encoding="utf-8",
        suffix=".geojson",
        delete=False,
    )
    Path(handle.name).write_text(json.dumps(payload), encoding="utf-8")
    handle.close()
    return Path(handle.name)


class GeojsonIoTests(unittest.TestCase):
    def test_valid_feature_collection_preserves_properties_and_crs(self):
        path = write_geojson(
            {
                "type": "FeatureCollection",
                "crs": {
                    "type": "name",
                    "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"},
                },
                "features": [
                    {
                        "type": "Feature",
                        "properties": {"cell_id": 1, "label": "alpha"},
                        "geometry": {
                            "type": "Point",
                            "coordinates": [-75.54, 6.25],
                        },
                    }
                ],
            }
        )
        frame = read_local_geojson(path)
        self.assertEqual(len(frame), 1)
        self.assertEqual(int(frame.iloc[0]["cell_id"]), 1)
        self.assertEqual(str(frame.crs), DEFAULT_CRS)

    def test_empty_feature_collection_keeps_crs(self):
        path = write_geojson({"type": "FeatureCollection", "features": []})
        frame = read_local_geojson(path)
        self.assertEqual(len(frame), 0)
        self.assertEqual(str(frame.crs), DEFAULT_CRS)

    def test_missing_properties_are_allowed(self):
        path = write_geojson(
            {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": [-75.54, 6.25],
                        },
                    }
                ],
            }
        )
        frame = read_local_geojson(path)
        self.assertEqual(len(frame), 1)
        self.assertTrue(frame.geometry.notna().all())

    def test_malformed_json_fails_visibly(self):
        handle = tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            suffix=".geojson",
            delete=False,
        )
        Path(handle.name).write_text("{not json", encoding="utf-8")
        handle.close()
        with self.assertRaises(GeoJsonLoadError):
            read_local_geojson(handle.name)

    def test_non_feature_collection_fails_visibly(self):
        path = write_geojson(
            {
                "type": "Feature",
                "properties": {},
                "geometry": None,
            }
        )
        with self.assertRaises(GeoJsonLoadError):
            read_local_geojson(path)


if __name__ == "__main__":
    unittest.main()
