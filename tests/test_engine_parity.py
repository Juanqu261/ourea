"""World 0 parity: JS engine ↔ Python scalar ↔ Python vectorized, and the fingerprint port."""

import json
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from decision_engine.dataset import load_dataset  # noqa: E402
from decision_engine.fingerprint import canonical_json, decision_fingerprint, js_number  # noqa: E402
from decision_engine.world0 import analyze_world0  # noqa: E402

NODE = shutil.which("node")
WORLD0_IDS = ["bio_pa", "food_agro", "hab_green", "health", "risk_knowledge", "water_eff"]
JS_REJECTED = {
    "bio_psa": 0.0275, "infra_services": 0.03, "risk_sat": 0.114, "food_soil": 0.15, "bio_restore": 0.205,
    "water_head": 0.2225, "water_riparian": 0.235, "hab_suds": 0.31, "infra_resilient": 0.49,
}


def node_json(script: str, stdin: str | None = None):
    completed = subprocess.run(
        [NODE, str(ROOT / "tests" / "js" / script)],
        input=stdin, capture_output=True, text=True, encoding="utf-8", check=True,
    )
    return json.loads(completed.stdout)


class World0ScalarTests(unittest.TestCase):
    """The plan's §0 targets, checked against the Python port alone."""

    @classmethod
    def setUpClass(cls):
        cls.result = analyze_world0(load_dataset())

    def test_institutional_portfolio(self):
        best = self.result["institucional"]
        self.assertEqual(list(best.ids), WORLD0_IDS)
        self.assertEqual(best.cost, 4800)
        self.assertEqual(best.objective, 2.87)
        self.assertEqual(self.result["fingerprint"], "ourea-f92bd48d")

    def test_grey_and_ssp(self):
        self.assertEqual(list(self.result["grey"].ids), ["bio_pa", "infra_resilient", "risk_knowledge", "water_eff"])
        self.assertEqual(self.result["grey"].objective, 2.38)
        self.assertEqual(list(self.result["stress"].ids), WORLD0_IDS)
        self.assertEqual(self.result["stress"].objective, 3.01)

    def test_rejected_gaps(self):
        self.assertEqual({row["id"]: row["gap"] for row in self.result["rejected"]}, JS_REJECTED)


@unittest.skipUnless(NODE, "node is not installed")
class JsParityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.js = node_json("world0_reference.mjs")
        cls.py = analyze_world0(load_dataset())

    def summary(self, candidate):
        return {"ids": list(candidate.ids), "cost": candidate.cost, "objective": candidate.objective}

    def test_portfolios_match(self):
        self.assertEqual(self.summary(self.py["institucional"]), self.js["institucional"])
        self.assertEqual(self.summary(self.py["grey"]), self.js["grey"])
        self.assertEqual(self.summary(self.py["max_count"]), self.js["max_count"])
        for lens in ("institucional", "naturaleza", "multidimensional", "bajo_arrepentimiento"):
            self.assertEqual(list(self.py[lens].ids), self.js["lenses"][lens], lens)

    def test_ssp_methods_agree(self):
        # JS adds an urgency term; Python raises Rionegro × disaster one class and places again.
        stress = self.js["stress"]
        self.assertEqual(self.summary(self.py["stress"]), {key: stress[key] for key in ("ids", "cost", "objective")})
        self.assertEqual(stress["status"], "MAYORMENTE_ROBUSTA")

    def test_fingerprint_and_gaps(self):
        self.assertEqual(self.py["fingerprint"], self.js["fingerprint"])
        js_gaps = {row["id"]: round(row["gap"], 6) for row in self.js["rejected"]}
        self.assertEqual({row["id"]: row["gap"] for row in self.py["rejected"]}, js_gaps)

    def test_measure_terms(self):
        js = {row["id"]: row for row in self.js["measures"]}
        for terms in self.py["prepared"]:
            row = js[terms.id]
            self.assertEqual(list(terms.placement.candidates), row["candidates"], terms.id)
            self.assertEqual(list(terms.placement.tie_steps), row["tie_steps"], terms.id)
            self.assertAlmostEqual(terms.vuln, row["vuln"], places=12)
            self.assertEqual(terms.rec is None, row["rec"] is None, terms.id)
            if terms.rec is not None:
                self.assertAlmostEqual(terms.rec, row["rec"], places=12)
            self.assertAlmostEqual(terms.cob, row["cob"], places=12)


class FingerprintPortTests(unittest.TestCase):
    FIXTURES = [
        {"ids": WORLD0_IDS, "cost": 4800, "budget": 5000,
         "weights": {"vulnerability": 0.7, "recurrence": 0.15, "workshops": 0.15}, "diminishing": 0.35},
        {"a": 1.0, "b": 100.0, "c": -0.0},
        {"small": 5e-05, "tiny": 1e-07, "edge": 1e-06, "below": 1.5e-07},
        {"big": 1e21, "under": 1.2345678901234568e20, "huge": 1.7976931348623157e308},
        {"sum": 0.1 + 0.2, "third": 1 / 3, "neg": -2.5e-8},
        {"texto": "Rionegro–Guarne–Marinilla", "ñ": "año", "emoji": "clave 𝄞"},
        {"z": [1, [2, [3, {"y": None, "x": True, "w": False}]]], "a": []},
        {"control": "línea\nnueva\t\"comillas\" \\ \u0001"},
        {"𝄞": 1, "￿": 2, "é": 3, "E": 4},
        [0.35, 2.87, 3.01, 2.38, 4800, 0.0275],
    ]

    def test_world0_fingerprint(self):
        self.assertEqual(decision_fingerprint(self.FIXTURES[0]), "ourea-f92bd48d")

    def test_number_format(self):
        self.assertEqual(js_number(1.0), "1")
        self.assertEqual(js_number(5e-05), "0.00005")
        self.assertEqual(js_number(1e-07), "1e-7")
        self.assertEqual(js_number(1e21), "1e+21")
        self.assertEqual(js_number(-0.0), "0")
        self.assertEqual(canonical_json({"b": 1.0, "a": [None, True]}), '{"a":[null,true],"b":1}')

    @unittest.skipUnless(NODE, "node is not installed")
    def test_matches_node(self):
        expected = node_json("fingerprint_fixtures.mjs", json.dumps(self.FIXTURES, ensure_ascii=False))
        self.assertEqual([decision_fingerprint(payload) for payload in self.FIXTURES], expected)


if __name__ == "__main__":
    unittest.main()
