"""Tests for Nanjing case artifacts and build invariants."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NJ = ROOT / "frontend" / "public" / "data" / "nanjing"


class NanjingCaseTests(unittest.TestCase):
    def test_required_artifacts_exist(self):
        for name in (
            "planning_cells.geojson",
            "buildings.geojson",
            "climate_context.json",
            "data_manifest.json",
            "retrospective_validation.json",
            "summary.json",
            "evidence_status.json",
        ):
            self.assertTrue((NJ / name).exists(), name)

    def test_retrospective_not_optimizer_input(self):
        payload = json.loads((NJ / "retrospective_validation.json").read_text(encoding="utf-8"))
        self.assertFalse(payload["optimizer_input"])
        for project in payload["projects"]:
            self.assertFalse(project["optimizer_input"])

    def test_population_estimate_language(self):
        summary = json.loads((NJ / "summary.json").read_text(encoding="utf-8"))
        self.assertIn("estimate", summary["population_label"].lower())
        self.assertIsNone(summary.get("equity_layer"))

    def test_no_medellin_bbox_leak(self):
        cells = json.loads((NJ / "planning_cells.geojson").read_text(encoding="utf-8"))
        blob = json.dumps(cells)
        self.assertNotIn("Llanaditas", blob)
        self.assertNotIn("-75.5", blob)

    def test_climate_source_identified(self):
        climate = json.loads((NJ / "climate_context.json").read_text(encoding="utf-8"))
        self.assertTrue(climate["source_name"])
        self.assertIn("POWER", climate["source_name"].upper())
        self.assertEqual(
            climate["input_provenance"].get("imerg_status"),
            "not_used_in_this_build",
        )

    def test_build_script_check_mode(self):
        import subprocess
        import sys

        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "build_nanjing_case.py"), "--check"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_overview_covers_aoi(self):
        coverage = json.loads(
            (ROOT / "data" / "derived" / "nanjing" / "overview_coverage.json").read_text(encoding="utf-8")
        )
        self.assertGreaterEqual(coverage["coverage_pct"], 99.0)
        self.assertGreaterEqual(coverage["osm_named_count"], 5)
        self.assertGreaterEqual(coverage["derived_sector_count"], 1)

    def test_building_massing_visualization_only(self):
        massing = json.loads((NJ / "building_massing.geojson").read_text(encoding="utf-8"))
        meta = json.loads((NJ / "building_massing_meta.json").read_text(encoding="utf-8"))
        exposure = json.loads((NJ / "buildings.geojson").read_text(encoding="utf-8"))
        self.assertEqual(len(exposure["features"]), 80)
        self.assertGreaterEqual(len(massing["features"]), 1000)
        self.assertFalse(meta["optimizer_input"])
        sample = massing["features"][0]["properties"]
        self.assertTrue(sample["visualization_only"])
        self.assertFalse(sample["optimizer_input"])
        self.assertIn(sample["height_source"], {
            "osm_reported_height",
            "level_derived_visualization",
            "fallback_visualization_proxy",
        })
        self.assertIn(sample["priority_class"], {"lower", "medium", "higher"})
        self.assertTrue(0.0 <= float(sample["visual_priority_score"]) <= 1.0)
        classes = {f["properties"]["priority_class"] for f in massing["features"]}
        self.assertGreaterEqual(len(classes), 2)
        self.assertFalse(meta["color_logic"]["optimizer_input"])


if __name__ == "__main__":
    unittest.main()
