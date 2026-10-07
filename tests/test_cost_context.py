"""Reproducible USD cost-context builder."""
from __future__ import annotations

import sys
import unittest
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from build_cost_context import (  # noqa: E402
    OUTPUT,
    build,
    dump,
    factors_after,
    inflate,
    median,
)


class CostContextTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.context = build()
        cls.rwh = cls.context["interventions"]["rwh"]
        cls.drainage = cls.context["interventions"]["drainage"]
        cls.restoration = cls.context["interventions"]["restoration"]

    def test_fx_and_price_date_are_versioned(self):
        self.assertEqual(self.context["fx"]["date"], "2026-08-28")
        self.assertEqual(self.context["fx"]["cop_per_usd"], 3144.28)
        self.assertEqual(self.context["price_date"], "2026-08-28")
        self.assertIn("banrep.gov.co", self.context["fx"]["url"])

    def test_rwh_inflation_and_fx(self):
        ceiling = Decimal("2119450")
        factors = [Decimal("1.052"), Decimal("1.051"), Decimal("1.0494")]
        cop_2026 = inflate(ceiling, factors)
        usd = cop_2026 / Decimal("3144.28")
        self.assertAlmostEqual(float(cop_2026), 2459137, delta=1)
        self.assertAlmostEqual(self.rwh["normalized_cop_2026"], float(cop_2026), places=2)
        self.assertAlmostEqual(self.rwh["anchor_usd"], float(usd), places=2)
        self.assertAlmostEqual(self.rwh["anchor_usd"], 782, delta=1)
        self.assertEqual(self.rwh["usd_per_system"]["low"], 550)
        self.assertEqual(self.rwh["usd_per_system"]["base"], 780)
        self.assertEqual(self.rwh["usd_per_system"]["high"], 1200)

    def test_low_base_high_ordering(self):
        for family in (
            self.rwh["usd_per_system"],
            self.drainage["usd_per_package"],
            self.restoration["usd_per_package"],
        ):
            self.assertLess(family["low"], family["base"])
            self.assertLess(family["base"], family["high"])

    def test_drainage_uses_rom_packages_not_unit_rates(self):
        records = self.drainage["records"]
        self.assertEqual(len(records), 6)
        self.assertEqual(self.drainage["method"], "rom_package")
        rom = [item for item in records if item["rom_corridor_package"]]
        self.assertEqual(len(rom), 3)
        packages = [item["usd_package_total"] for item in rom]
        self.assertEqual(self.drainage["usd_per_package"]["low"], min(packages))
        self.assertEqual(self.drainage["usd_per_package"]["high"], max(packages))
        self.assertAlmostEqual(self.drainage["usd_per_package"]["low"], 408679, delta=5)
        self.assertAlmostEqual(self.drainage["usd_per_package"]["base"], 852659, delta=5)
        self.assertAlmostEqual(self.drainage["usd_per_package"]["high"], 1577786, delta=5)
        self.assertEqual(self.drainage["length_m"]["low"], 40)
        self.assertIn("not multiplied", self.drainage["comparator_usd_per_reported_m"]["model_use"])
        for record in records:
            blob = f"{record['comparability_warning']} {record.get('model_use', '')}".lower()
            self.assertTrue("unit" in blob or "scopes differ" in blob or "rom" in blob)
            self.assertEqual(record["original_currency"], "COP")
            self.assertTrue(record["url"])
            self.assertTrue(record["reader_label"])

    def test_restoration_uses_icociv_anchor(self):
        self.assertAlmostEqual(self.restoration["anchor_usd"], 177000, delta=1500)
        self.assertEqual(self.restoration["usd_per_package"]["low"], 120000)
        self.assertEqual(self.restoration["usd_per_package"]["base"], 177000)
        self.assertEqual(self.restoration["usd_per_package"]["high"], 270000)
        self.assertEqual(self.restoration["evidence_tier"], "low")
        self.assertIn("ICOCIV", self.restoration["evidence_label"])

    def test_sources_carry_required_fields(self):
        required = {
            "id",
            "source_date",
            "location",
            "quantity_basis",
            "inflation_method",
            "fx_method",
            "inclusions",
            "exclusions",
            "evidence_tier",
            "comparability_warning",
            "url",
            "access_date",
            "reader_label",
        }
        self.assertGreaterEqual(len(self.context["sources"]), 8)
        for source in self.context["sources"]:
            missing = required - set(source)
            self.assertFalse(missing, f"{source.get('id')} missing {missing}")
            self.assertTrue(str(source["url"]).startswith("http"))
            self.assertNotIn(source["reader_label"], (source["id"], None, ""))

    def test_median_helper(self):
        self.assertEqual(median([Decimal(1), Decimal(3), Decimal(2)]), Decimal(2))
        self.assertEqual(
            median([Decimal(1), Decimal(2), Decimal(3), Decimal(4)]),
            Decimal("2.5"),
        )

    def test_cpi_factor_selection(self):
        factors = self.context["cpi"]["factors"]
        after_2023 = factors_after(factors, 2023)
        self.assertEqual([float(item) for item in after_2023], [1.052, 1.051, 1.0494])
        after_2019 = factors_after(factors, 2019)
        self.assertEqual(len(after_2019), 7)

    def test_icociv_chain_for_civil_works(self):
        factors = self.context["icociv"]["factors"]
        after_2020 = factors_after(factors, 2020)
        self.assertEqual(
            [float(item) for item in after_2020],
            [1.0556, 1.0973, 1.092, 1.0378, 1.0431],
        )
        self.assertIsNone(self.context["icociv"]["ytd_2026"])

    def test_committed_json_is_reproducible(self):
        committed = OUTPUT.read_text(encoding="utf-8").replace("\r\n", "\n")
        self.assertEqual(committed, dump(self.context))
