"""Schema tests for the shipped climate_context.json."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from validate_climate_context import (  # noqa: E402
    load_climate_context,
    validate_climate_context,
)

CLIMATE_PATH = ROOT / "frontend" / "public" / "data" / "climate_context.json"


class ClimateContextSchemaTests(unittest.TestCase):
    def test_shipped_json_matches_schema(self):
        self.assertTrue(CLIMATE_PATH.exists(), "climate_context.json must be shipped for offline use")
        document = load_climate_context(CLIMATE_PATH)
        errors = validate_climate_context(document)
        self.assertEqual(errors, [])
        self.assertIn("coordinates", document)
        self.assertEqual(document["scenario_presets"][0]["percentile"], 75)
        self.assertLess(
            document["scenario_presets"][0]["precipitation_mm"],
            document["scenario_presets"][2]["precipitation_mm"],
        )
