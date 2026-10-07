"""Analyses A–D, the published JSON, isolation from the AI stack and speed."""

import ast
import json
import sys
import time
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from decision_engine.breaking_points import best_box, find_boxes  # noqa: E402
from decision_engine.build import OUTPUTS, compute, write  # noqa: E402
from decision_engine.dataset import DATA, load_dataset  # noqa: E402
from decision_engine.robustness import choose_s_star, near_key, set_metrics  # noqa: E402
from decision_engine.simulation import simulate  # noqa: E402
from decision_engine.uncertainty import NEAR_THRESHOLDS  # noqa: E402
from decision_engine.voi import _bins, _evppi_statistic, world0_gaps  # noqa: E402
from decision_engine.wording import FORBIDDEN  # noqa: E402

JS_REJECTED = {
    "bio_psa": 0.0275, "infra_services": 0.03, "risk_sat": 0.114, "food_soil": 0.15, "bio_restore": 0.205,
    "water_head": 0.2225, "water_riparian": 0.235, "hab_suds": 0.31, "infra_resilient": 0.49,
}


class FullRunTests(unittest.TestCase):
    """One full 4.000-world run, shared by the tests below."""

    @classmethod
    def setUpClass(cls):
        started = time.perf_counter()
        cls.sim = simulate(load_dataset(), use_cache=False)
        cls.payloads = compute(cls.sim)
        cls.seconds = time.perf_counter() - started

    def test_speed(self):
        self.assertLess(self.seconds, 30)

    def test_rank1_sums_to_one_and_near_is_monotone(self):
        metrics = set_metrics(self.sim)
        for scenario, rows in metrics.items():
            self.assertAlmostEqual(float(rows["rank1"].sum()), 1.0, places=9, msg=scenario)
            keys = [near_key(t) for t in NEAR_THRESHOLDS]
            for low, high in zip(keys, keys[1:]):
                self.assertTrue(np.all(rows[low] <= rows[high] + 1e-12), (scenario, low, high))
            self.assertTrue(np.all(rows["rank1"] <= rows[keys[0]] + 1e-12))

    def test_s_star_rule(self):
        metrics = set_metrics(self.sim)
        s_star = choose_s_star(self.sim, metrics)
        near = metrics["all"][near_key(0.05)]
        self.assertEqual(near[s_star], near.max())
        tied = np.flatnonzero(near == near.max())
        self.assertEqual(metrics["all"]["rank1"][s_star], metrics["all"]["rank1"][tied].max())

    def test_world0_switching_equals_js_rejected_gaps(self):
        self.assertEqual(world0_gaps(self.sim), JS_REJECTED)

    def test_world0_point(self):
        points = self.payloads["robustness.json"]["points"]
        self.assertEqual(points["institucional"]["best_score"], 2.87)
        self.assertEqual(points["institucional_ssp"]["best_score"], 3.01)
        self.assertEqual(self.payloads["robustness.json"]["world0_sets_within"], {"near_1": 2, "near_2": 3, "near_5": 4, "near_10": 27})

    def test_inclusion_classes(self):
        inclusion = self.payloads["robustness.json"]["inclusion"]
        self.assertEqual(len(inclusion), 15)
        for row in inclusion.values():
            share = row["all"]["incl_best"]
            expected = "core" if share >= 0.8 else ("contingent" if share >= 0.2 else "rarely")
            self.assertEqual(row["class"], expected)

    def test_breaking_points_link_gaps(self):
        primary = self.payloads["breaking_points.json"]["decision_residual_risk"]["regret_10"]
        self.assertLessEqual(len(primary["boxes"]), 3)
        known = {gap["id"] for gap in load_dataset().gaps}
        for box in primary["boxes"]:
            self.assertLessEqual(len(box["conditions"]), 3)
            self.assertTrue(set(box["gaps"]) <= known)

    def test_wording_rules(self):
        from decision_engine.build import WORDING

        for name, payload in self.payloads.items():
            text = json.dumps(payload, ensure_ascii=False, default=str).lower()
            for rule in WORDING:
                text = text.replace(rule.lower(), "")
            for word in FORBIDDEN:
                self.assertNotIn(word, text, name)
        sentence = self.payloads["robustness.json"]["s_star_sentence"]
        self.assertIn("de los 4.000 mundos probados", sentence)

    def test_exploratory_parameters_are_labeled(self):
        ranges = {row["name"]: row for row in self.payloads["uncertainty_ranges.json"]["parameters"]}
        self.assertEqual(ranges["eff[water_eff]"]["evidence_label"], "Exploratorio")
        self.assertEqual(ranges["p_shift"]["evidence_label"], "Exploratorio")
        for box in self.payloads["breaking_points.json"]["decision_residual_risk"]["regret_10"]["boxes"]:
            uses = any(ranges[c["parameter"]]["evidence"] == "exploratory" for c in box["conditions"])
            self.assertEqual(box["exploratory"], uses)

    def test_outputs_are_small_and_fingerprinted(self):
        import tempfile

        with tempfile.TemporaryDirectory() as temp:
            write(self.payloads, Path(temp))
            sizes = [(Path(temp) / name).stat().st_size for name in OUTPUTS]
        self.assertLess(sum(sizes), 200 * 1024)
        fingerprints = {payload["fingerprint"] for payload in self.payloads.values()}
        self.assertEqual(fingerprints, {self.sim.fingerprint})

    def test_committed_outputs_exist(self):
        for name in OUTPUTS:
            payload = json.loads((DATA / name).read_text(encoding="utf-8"))
            self.assertEqual(payload["n_worlds"], 4000)
            self.assertIn("seed", payload)


class PrimTests(unittest.TestCase):
    def test_recovers_a_planted_box(self):
        rng = np.random.default_rng(5)
        x = rng.random((3000, 4))
        inside = (x[:, 0] > 0.7) & (x[:, 1] < 0.3)
        y = np.where(inside, rng.random(3000) < 0.9, rng.random(3000) < 0.05).astype(float)
        box = best_box(x, y, [False] * 4)
        self.assertEqual(sorted(box.order), [0, 1])
        low0, _ = box.limits[0]
        _, high1 = box.limits[1]
        self.assertAlmostEqual(low0, 0.7, delta=0.05)
        self.assertAlmostEqual(high1, 0.3, delta=0.05)
        self.assertGreater(box.density, 0.8)

    def test_binary_column_and_covering(self):
        rng = np.random.default_rng(6)
        x = np.column_stack([rng.random(2000), (rng.random(2000) < 0.5).astype(float)])
        y = ((x[:, 1] == 1) & (x[:, 0] > 0.5)).astype(float)
        boxes = find_boxes(x, y, [False, True])
        self.assertTrue(boxes)
        self.assertEqual(boxes[0].limits[1], (1.0, 1.0))


class EvppiTests(unittest.TestCase):
    def test_bias_correction(self):
        rng = np.random.default_rng(8)
        worlds, sets = 4000, 300
        noise_param = rng.random(worlds)
        signal_param = rng.random(worlds)
        table = rng.normal(1_000_000, 50_000, (worlds, sets)).round()
        table[:, 0] += np.where(signal_param > 0.5, 400_000, -400_000)

        def corrected(values):
            labels, n_bins = _bins(values, False)
            raw = _evppi_statistic(table, labels, n_bins)
            shuffles = [_evppi_statistic(table, labels[rng.permutation(worlds)], n_bins) for _ in range(5)]
            return raw, raw - np.mean(shuffles)

        raw_noise, corrected_noise = corrected(noise_param)
        _, corrected_signal = corrected(signal_param)
        self.assertGreater(raw_noise, 0)                       # the uncorrected statistic is biased up
        self.assertLess(abs(corrected_noise), raw_noise * 0.5)  # the correction removes most of it
        self.assertGreater(corrected_signal, 100_000)


class IsolationTests(unittest.TestCase):
    def test_no_ai_stack_imports(self):
        for path in (ROOT / "decision_engine").glob("*.py"):
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                names = []
                if isinstance(node, ast.Import):
                    names = [alias.name for alias in node.names]
                elif isinstance(node, ast.ImportFrom) and node.module:
                    names = [node.module]
                for name in names:
                    self.assertFalse(name.startswith(("langchain", "langgraph")), f"{path.name} imports {name}")


if __name__ == "__main__":
    unittest.main()
