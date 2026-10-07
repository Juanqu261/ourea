"""Portfolio space, scalar = vectorized, missing data and determinism."""

import hashlib
import sys
import unittest
from dataclasses import replace
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from decision_engine.dataset import load_dataset  # noqa: E402
from decision_engine.levers import cell_profiles, lever_mismatch  # noqa: E402
from decision_engine.portfolios import space_for  # noqa: E402
from decision_engine.world0 import Context, enumerate_candidates, measure_terms, round6, with_ssp, world0  # noqa: E402
from decision_engine.world_score import best_sets, score_table, static_tables, term_matrices  # noqa: E402
from decision_engine.worlds import named_points, row_world, sample_worlds, world_row  # noqa: E402


class SpaceTests(unittest.TestCase):
    def test_counts(self):
        dataset = load_dataset()
        space = space_for(dataset)
        self.assertEqual(space.size, 1566)
        self.assertEqual(np.bincount(space.members.sum(axis=1))[1:].tolist(), [15, 105, 419, 717, 303, 7])
        self.assertEqual(int(space.maximal().sum()), 698)
        corridor = np.array([measure["scope"] == "corridor" for measure in dataset.interventions])
        self.assertEqual(space.location_variant_count(corridor), 50596)
        self.assertLessEqual(int(space.cost.max()), 5000)

    def test_no_id_is_a_prefix_of_another(self):
        # The JS tie-break compares ids joined by "|"; with no prefix ids, Python string order agrees with localeCompare.
        ids = load_dataset().measure_ids
        self.assertFalse(any(a != b and b.startswith(a) for a in ids for b in ids))


class ScalarEqualsVectorizedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dataset = load_dataset()
        cls.ctx = Context(cls.dataset)
        cls.space = space_for(cls.dataset)
        cls.tables = static_tables(cls.ctx)
        cls.worlds = sample_worlds(cls.dataset, 400, seed=7)

    def scalar_row(self, world) -> np.ndarray:
        scores = {}
        for candidate, _ in enumerate_candidates(self.ctx, world):
            scores[candidate.key] = round(candidate.objective * 1e6)
        return np.array([scores[self.space.key(index)] for index in range(self.space.size)])

    def vector_rows(self, values: np.ndarray) -> np.ndarray:
        terms = term_matrices(self.ctx, self.tables, self.worlds.columns, values)
        return score_table(self.ctx, self.space, terms, values[:, self.worlds.columns.index("dim_penalty")])

    def assert_equal_world(self, world, vector_row):
        scalar = self.scalar_row(world)
        self.assertLessEqual(int(np.abs(scalar - vector_row).max()), 1)    # ≤ 1e-6 (summation order)
        self.assertEqual(int(best_sets(self.space, scalar[None, :])[0]), int(best_sets(self.space, vector_row[None, :])[0]))

    def test_world0_and_ssp(self):
        for name, row in named_points(self.dataset).items():
            with self.subTest(name):
                world = row_world(self.dataset, self.worlds.columns, row)
                self.assert_equal_world(world, self.vector_rows(row[None, :])[0])
        rows = self.vector_rows(np.stack(list(named_points(self.dataset).values())))
        self.assertEqual(rows[0].max(), 2_812_500)
        self.assertEqual(rows[2].max(), 2_952_500)

    def test_25_random_worlds(self):
        picks = np.random.default_rng(3).choice(self.worlds.size, 25, replace=False)
        table = self.vector_rows(self.worlds.values[picks])
        for row, index in zip(table, picks):
            with self.subTest(world=int(index)):
                self.assert_equal_world(row_world(self.dataset, self.worlds.columns, self.worlds.values[index]), row)

    def test_world_row_round_trip(self):
        world = with_ssp(world0(self.dataset), self.dataset)
        self.assertEqual(row_world(self.dataset, self.worlds.columns, world_row(self.dataset, world)), world)


class MissingDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dataset = load_dataset()
        cls.ctx = Context(cls.dataset)
        cls.base = world0(cls.dataset)

    def terms(self, measure_id, world=None):
        return measure_terms(self.ctx, self.dataset.measure(measure_id), world or self.base)

    def test_null_capacity_never_breaks_a_tie(self):
        terms = self.terms("hab_green")   # Guarne has no CA number, so Guarne|Marinilla stays tied
        self.assertEqual(terms.placement.candidates, ("guarne", "marinilla"))
        self.assertIn("la capacidad adaptativa faltante no se usa para desempatar", terms.placement.tie_steps)

    def test_withheld_recurrence_scores_zero(self):
        terms = self.terms("water_eff")   # Marinilla has 1 record
        self.assertIsNone(terms.rec)
        self.assertEqual(terms.total, terms.vuln + terms.cob)

    def test_partial_or_unknown_profile_never_penalizes(self):
        cells = cell_profiles(self.dataset)
        self.assertEqual(cells[("rionegro", "disaster")]["profile"], "reduce_s")
        self.assertEqual(cells[("marinilla", "disaster")]["profile"], "partial")
        self.assertEqual(cells[("guarne", "disaster")]["profile"], "unknown")
        self.assertEqual(sum(cell["profile"] not in {"partial", "unknown"} for cell in cells.values()), 1)
        world = replace(self.base, lever_mismatch=0.5)
        self.assertEqual(self.terms("risk_knowledge", world).lever_fit, 1.0)   # Rionegro|Guarne, Guarne unknown
        ssp = with_ssp(world, self.dataset)
        self.assertEqual(self.terms("risk_knowledge", ssp).placement.candidates, ("rionegro",))
        self.assertEqual(self.terms("risk_knowledge", ssp).lever_fit, 0.5)     # CA-only measure where S should go down
        self.assertEqual(self.terms("bio_pa", ssp).lever_fit, 1.0)             # S+CA never mismatches
        self.assertFalse(lever_mismatch(self.dataset.measure("risk_sat"), ["marinilla"], cells))

    def test_null_stays_null_in_published_cells(self):
        cells = cell_profiles(self.dataset)
        self.assertIsNone(cells[("guarne", "water")]["sensitivity"])
        self.assertIsNone(cells[("guarne", "water")]["adaptive_capacity"])
        self.assertIsNone(self.ctx.capacity[("guarne", "disaster")])

    def test_round6_rounds_half_up_like_js(self):
        self.assertEqual(round6(0.0000025), 0.000003)
        self.assertEqual(round6(2.8699999999999997), 2.87)


class DeterminismTests(unittest.TestCase):
    def test_same_seed_same_table(self):
        dataset = load_dataset()
        ctx = Context(dataset)
        space = space_for(dataset)
        tables = static_tables(ctx)

        def run(seed):
            worlds = sample_worlds(dataset, 200, seed)
            terms = term_matrices(ctx, tables, worlds.columns, worlds.values)
            table = score_table(ctx, space, terms, worlds.column("dim_penalty"))
            return hashlib.sha256(table.tobytes()).hexdigest(), worlds.fingerprint

        first, second, other = run(11), run(11), run(12)
        self.assertEqual(first, second)
        self.assertNotEqual(first[1], other[1])
        self.assertNotEqual(first[0], other[0])


if __name__ == "__main__":
    unittest.main()
