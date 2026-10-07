"""One simulation run: worlds, per-world terms and the score table, cached by fingerprint."""

from __future__ import annotations

from dataclasses import dataclass
from functools import cached_property
from pathlib import Path

import numpy as np

from .dataset import ROOT, Dataset, load_dataset
from .portfolios import PortfolioSpace, space_for
from .uncertainty import N_WORLDS, SEED
from .world0 import Context
from .world_score import (
    StaticTables,
    TermMatrices,
    best_sets,
    contributions,
    first_in_dimension,
    score_table,
    set_patterns,
    static_tables,
    term_matrices,
)
from .worlds import WorldMatrix, named_points, sample_worlds

CACHE = ROOT / ".cache" / "engine"


@dataclass
class Simulation:
    dataset: Dataset
    ctx: Context
    space: PortfolioSpace
    tables: StaticTables
    worlds: WorldMatrix
    terms: TermMatrices
    table: np.ndarray            # (W, S) int64 micro-units

    @property
    def fingerprint(self) -> str:
        return self.worlds.fingerprint

    @property
    def n_worlds(self) -> int:
        return self.worlds.size

    @cached_property
    def best(self) -> np.ndarray:
        return best_sets(self.space, self.table)

    @cached_property
    def best_score(self) -> np.ndarray:
        return self.table[np.arange(self.n_worlds), self.best]

    @cached_property
    def regret(self) -> np.ndarray:
        """(W, S) (best − score) / best."""
        return (self.best_score[:, None] - self.table) / self.best_score[:, None]

    @cached_property
    def first_index(self) -> list[np.ndarray]:
        return first_in_dimension(self.ctx, self.terms)[0]

    @cached_property
    def set_patterns(self) -> np.ndarray:
        return set_patterns(self.ctx, self.space)

    def contributions(self, set_index: np.ndarray) -> np.ndarray:
        """(W, K) each measure's contribution inside the given set per world."""
        return contributions(self.ctx, self.space, self.terms, self.worlds.column("dim_penalty"), set_index,
                             self.first_index, self.set_patterns)

    @cached_property
    def scenario(self) -> np.ndarray:
        return self.worlds.column("scenario") > 0.5

    @cached_property
    def points(self) -> dict[str, dict]:
        """Named world points (World 0, multidimensional lens, World 0 + SSP) scored over every set."""
        rows = named_points(self.dataset)
        values = np.stack(list(rows.values()))
        terms = term_matrices(self.ctx, self.tables, self.worlds.columns, values)
        table = score_table(self.ctx, self.space, terms, values[:, self.worlds.columns.index("dim_penalty")])
        best = best_sets(self.space, table)
        return {
            name: {"row": values[i], "terms": _row_terms(terms, i), "table": table[i], "best": int(best[i])}
            for i, name in enumerate(rows)
        }

    def score_variants(self, set_index: int, overrides: dict[int, int], worlds: np.ndarray | None = None) -> np.ndarray:
        """Scores of one set with some measures fixed to a municipality pattern (location variants)."""
        values = self.worlds.values if worlds is None else worlds
        terms = term_matrices(self.ctx, self.tables, self.worlds.columns, values, fixed_candidates=overrides)
        return score_table(self.ctx, self.space, terms, values[:, self.worlds.columns.index("dim_penalty")],
                           set_indices=np.array([set_index]))[:, 0]


def _row_terms(terms: TermMatrices, index: int) -> TermMatrices:
    return TermMatrices(*(getattr(terms, name)[index:index + 1] for name in TermMatrices.__dataclass_fields__))


def simulate(dataset: Dataset | None = None, n_worlds: int = N_WORLDS, seed: int = SEED, use_cache: bool = True) -> Simulation:
    dataset = dataset or load_dataset()
    ctx = Context(dataset)
    space = space_for(dataset)
    tables = static_tables(ctx)
    worlds = sample_worlds(dataset, n_worlds, seed)
    terms = term_matrices(ctx, tables, worlds.columns, worlds.values)
    path = CACHE / f"{worlds.fingerprint}.npz"
    table = None
    if use_cache and path.exists():
        cached = np.load(path)
        if np.array_equal(cached["worlds"], worlds.values):
            table = cached["table"].astype(np.int64)
    if table is None:
        table = score_table(ctx, space, terms, worlds.column("dim_penalty"))
        if use_cache:
            _save(path, worlds.values, table)
    return Simulation(dataset, ctx, space, tables, worlds, terms, table)


def _save(path: Path, worlds: np.ndarray, table: np.ndarray) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        np.savez(path, worlds=worlds, table=table.astype(np.int32))
    except OSError:
        pass  # the cache is an optimization, never a requirement
