"""Rebuild climate_context.json from the versioned pentad CSV and compare."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from validate_climate_context import (  # noqa: E402
    compare_shipped_with_rebuild,
    load_climate_context,
    rebuild_from_versioned_csv,
    validate_climate_context,
)
from build_climate_context import VERSIONED_CSV, VERSIONED_META, sha256_file  # noqa: E402

CLIMATE_PATH = ROOT / "frontend" / "public" / "data" / "climate_context.json"


class ClimateRebuildTests(unittest.TestCase):
    def test_versioned_artifacts_exist(self):
        self.assertTrue(VERSIONED_CSV.exists())
        self.assertTrue(VERSIONED_META.exists())
        self.assertEqual(len(sha256_file(VERSIONED_CSV)), 64)

    def test_rebuild_matches_shipped_json(self):
        shipped = load_climate_context(CLIMATE_PATH)
        rebuilt = rebuild_from_versioned_csv()
        self.assertEqual(validate_climate_context(shipped), [])
        self.assertEqual(compare_shipped_with_rebuild(shipped, rebuilt), [])
        self.assertIsNotNone(shipped["input_provenance"]["sample"]["row"])
        self.assertEqual(
            shipped["input_provenance"]["csv_sha256"],
            sha256_file(VERSIONED_CSV),
        )
