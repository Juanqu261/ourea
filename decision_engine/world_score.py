"""Step 4: per-world measure terms (W × 15) and the score table (W × S), vectorized.

Must equal world0.py in every world. Placement depends only on which
municipalities tie on class, and CA and recurrence are static, so the tie
steps are resolved once per (measure, tie pattern) and looked up per world.
Scores are kept as int64 micro-units (round to 1e-6, half up like JS) so every
later sum is exact and platform-independent.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .dataset import CLASS_ORDER, MUNICIPALITY_IDS
from .levers import lever_mismatch
from .portfolios import PortfolioSpace
from .world0 import Context, break_tie

N_MUNI = len(MUNICIPALITY_IDS)
ALL_PATTERNS = range(1, 2 ** N_MUNI)


def pattern_of(municipality_ids) -> int:
    return sum(1 << MUNICIPALITY_IDS.index(m) for m in municipality_ids)


def members_of(pattern: int) -> list[str]:
    return [m for index, m in enumerate(MUNICIPALITY_IDS) if pattern >> index & 1]


@dataclass(frozen=True)
class StaticTables:
    """Per (measure, municipality pattern) facts that do not depend on the world."""

    candidate_pattern: np.ndarray   # (K, 8): tied-on-class pattern → candidates after CA/recurrence steps
    mismatch: np.ndarray            # (K, 8) bool, indexed by candidate pattern
    withheld: np.ndarray            # (K, 8) bool
    rec_norm: np.ndarray            # (K, 8) count/denominator, 0 when withheld
    dimension_index: np.ndarray     # (K,)
    base_class: np.ndarray          # (3, D) class index 1…5
    cobenefits: list[list[int]]     # per measure, dimension indices


def static_tables(ctx: Context) -> StaticTables:
    count = len(ctx.measures)
    candidate_pattern = np.zeros((count, 8), dtype=np.int64)
    mismatch = np.zeros((count, 8), dtype=bool)
    withheld = np.zeros((count, 8), dtype=bool)
    rec_norm = np.zeros((count, 8))
    for k, measure in enumerate(ctx.measures):
        for pattern in ALL_PATTERNS:
            tied, _ = break_tie(ctx, measure, members_of(pattern))
            candidate_pattern[k, pattern] = pattern_of(tied)
            members = members_of(pattern)
            mismatch[k, pattern] = lever_mismatch(measure, members, ctx.cells)
            if any(ctx.records[m] < ctx.min_records for m in members):
                withheld[k, pattern] = True
            else:
                best = max(ctx.count(measure["id"], m) for m in members)
                rec_norm[k, pattern] = best / ctx.denominator if ctx.denominator > 0 else 0.0
    base_class = np.array([[ctx.base_class[(m, d)] for d in ctx.dimension_ids] for m in MUNICIPALITY_IDS])
    return StaticTables(
        candidate_pattern,
        mismatch,
        withheld,
        rec_norm,
        np.array([ctx.dimension_ids.index(measure["dimension_id"]) for measure in ctx.measures]),
        base_class,
        [[ctx.dimension_ids.index(d) for d in measure.get("cobenefit_dimension_ids") or []] for measure in ctx.measures],
    )


@dataclass(frozen=True)
class TermMatrices:
    vuln: np.ndarray          # (W, K)
    rec: np.ndarray           # (W, K), 0 where withheld
    withheld: np.ndarray      # (W, K) bool
    cob: np.ndarray           # (W, K)
    candidates: np.ndarray    # (W, K) municipality bit pattern
    highest: np.ndarray       # (W, K) class index
    lever_fit: np.ndarray     # (W, K)

    @property
    def total(self) -> np.ndarray:
        return self.vuln + self.rec + self.cob


def world_classes(tables: StaticTables, columns: list[str], values: np.ndarray, dimension_ids: list[str]) -> np.ndarray:
    """(W, 3, D) class index after the SSP shifts, capped at 5."""
    shifts = np.stack([
        np.stack([values[:, columns.index(f"ssp_shift[{m},{d}]")] for d in dimension_ids], axis=1)
        for m in MUNICIPALITY_IDS
    ], axis=1)
    return np.minimum(5, tables.base_class[None, :, :] + (shifts > 0.5).astype(np.int64))


def class_scores(ctx: Context, classes: np.ndarray, gamma: np.ndarray) -> np.ndarray:
    base = np.array([ctx.class_scores[name] for name in CLASS_ORDER])
    return base[classes - 1] ** gamma.reshape((-1,) + (1,) * (classes.ndim - 1))


def term_matrices(ctx: Context, tables: StaticTables, columns: list[str], values: np.ndarray,
                  fixed_candidates: dict[int, int] | None = None) -> TermMatrices:
    """Per-world terms. `fixed_candidates` {measure index: municipality pattern} overrides placement (location variants)."""
    col = lambda name: values[:, columns.index(name)]  # noqa: E731
    worlds = values.shape[0]
    count = len(ctx.measures)
    gamma = col("gamma")
    classes = world_classes(tables, columns, values, ctx.dimension_ids)
    scores = class_scores(ctx, classes, gamma)                       # (W, 3, D)
    dim_w = np.stack([col(f"dim_w[{d}]") for d in ctx.dimension_ids], axis=1)
    eff = np.stack([col(f"eff[{k}]") for k in ctx.measure_ids], axis=1)
    weights = 1 << np.arange(N_MUNI)
    vuln = np.zeros((worlds, count))
    rec = np.zeros((worlds, count))
    withheld = np.zeros((worlds, count), dtype=bool)
    cob = np.zeros((worlds, count))
    candidates = np.zeros((worlds, count), dtype=np.int64)
    highest = np.zeros((worlds, count), dtype=np.int64)
    lever_fit = np.ones((worlds, count))
    for k in range(count):
        d = tables.dimension_index[k]
        cls = classes[:, :, d]                                       # (W, 3)
        if fixed_candidates and k in fixed_candidates:
            pattern = np.full(worlds, fixed_candidates[k])
            in_pattern = (pattern[:, None] >> np.arange(N_MUNI)) & 1
            top = np.where(in_pattern == 1, cls, 0).max(axis=1)
        else:
            top = cls.max(axis=1)
            tied = ((cls == top[:, None]) * weights).sum(axis=1)
            pattern = tables.candidate_pattern[k, tied]
        member = ((pattern[:, None] >> np.arange(N_MUNI)) & 1).astype(bool)   # (W, 3)
        class_score = class_scores(ctx, top, gamma)
        fit = np.where(tables.mismatch[k, pattern], col("lever_mismatch"), 1.0)
        vuln[:, k] = col("w_vuln") * dim_w[:, d] * class_score * eff[:, k] * fit
        withheld[:, k] = tables.withheld[k, pattern]
        rec[:, k] = np.where(withheld[:, k], 0.0, col("w_rec") * tables.rec_norm[k, pattern])
        total_cob = np.zeros(worlds)
        for d2 in tables.cobenefits[k]:
            total_cob = total_cob + col("cobenefit_w") * np.where(member, scores[:, :, d2], np.inf).min(axis=1)
        cob[:, k] = total_cob
        candidates[:, k] = pattern
        highest[:, k] = top
        lever_fit[:, k] = fit
    return TermMatrices(vuln, rec, withheld, cob, candidates, highest, lever_fit)


def dimension_groups(ctx: Context) -> list[list[int]]:
    return [[k for k, measure in enumerate(ctx.measures) if measure["dimension_id"] == d] for d in ctx.dimension_ids]


def first_in_dimension(ctx: Context, terms: TermMatrices) -> tuple[list[np.ndarray], list[np.ndarray]]:
    """Per dimension: (W, 2^n) index of the measure that keeps its full vulnerability term, for every subset pattern."""
    total = terms.total
    ids = ctx.measure_ids
    first_index, first_vuln = [], []
    for group in dimension_groups(ctx):
        n = len(group)
        index = np.full((total.shape[0], 2 ** n), -1, dtype=np.int64)
        vuln = np.zeros((total.shape[0], 2 ** n))
        by_id = sorted(range(n), key=lambda j: ids[group[j]])   # ties go to the smaller id
        for pattern in range(1, 2 ** n):
            best = None
            for j in by_id:
                if not pattern >> j & 1:
                    continue
                if best is None:
                    best = np.full(total.shape[0], group[j])
                else:
                    better = total[:, group[j]] > total[np.arange(total.shape[0]), best]
                    best = np.where(better, group[j], best)
            index[:, pattern] = best
            vuln[:, pattern] = terms.vuln[np.arange(total.shape[0]), best]
        first_index.append(index)
        first_vuln.append(vuln)
    return first_index, first_vuln


def set_patterns(ctx: Context, space: PortfolioSpace) -> np.ndarray:
    """(S, D) subset pattern of each set within each dimension."""
    groups = dimension_groups(ctx)
    patterns = np.zeros((space.size, len(groups)), dtype=np.int64)
    for d, group in enumerate(groups):
        for j, k in enumerate(group):
            patterns[:, d] |= space.members[:, k].astype(np.int64) << j
    return patterns


def to_micro(values: np.ndarray) -> np.ndarray:
    """Math.round(x * 1e6) as int64."""
    return np.floor(values * 1e6 + 0.5).astype(np.int64)


def score_table(ctx: Context, space: PortfolioSpace, terms: TermMatrices, dim_penalty: np.ndarray,
                set_indices: np.ndarray | None = None) -> np.ndarray:
    """(W, S) int64 micro-units: Σ(rec + cob) + p·Σ vuln + (1 − p)·Σ_d vuln of the first measure in d."""
    members = space.members if set_indices is None else space.members[set_indices]
    x = members.astype(np.float64)
    patterns = set_patterns(ctx, space)
    if set_indices is not None:
        patterns = patterns[set_indices]
    _, first_vuln = first_in_dimension(ctx, terms)
    flat = (terms.rec + terms.cob) @ x.T
    spread = terms.vuln @ x.T
    first = np.zeros_like(flat)
    for d, vuln in enumerate(first_vuln):
        first += vuln[:, patterns[:, d]]
    p = dim_penalty[:, None]
    return to_micro(flat + p * spread + (1.0 - p) * first)


def best_sets(space: PortfolioSpace, table: np.ndarray, allowed: np.ndarray | None = None) -> np.ndarray:
    """Per world, the winning set: highest score, then more budget left, then ids (same as JS)."""
    key = table * space.size + (space.size - 1 - space.tie_rank)[None, :]
    if allowed is not None:
        key = np.where(allowed[None, :], key, np.iinfo(np.int64).min)
    return key.argmax(axis=1)


def contributions(ctx: Context, space: PortfolioSpace, terms: TermMatrices, dim_penalty: np.ndarray,
                  set_index: np.ndarray, first_index: list[np.ndarray] | None = None,
                  patterns: np.ndarray | None = None) -> np.ndarray:
    """(W, K) each measure's contribution inside the set chosen per world (0 when absent)."""
    worlds = terms.vuln.shape[0]
    members = space.members[set_index]                               # (W, K)
    if first_index is None:
        first_index, _ = first_in_dimension(ctx, terms)
    patterns = (set_patterns(ctx, space) if patterns is None else patterns)[set_index]   # (W, D)
    factor = np.where(members, dim_penalty[:, None], 0.0)
    rows = np.arange(worlds)
    for d in range(len(first_index)):
        first = first_index[d][rows, patterns[:, d]]
        has = patterns[:, d] > 0
        factor[rows[has], first[has]] = 1.0
    return np.where(members, factor * terms.vuln + terms.rec + terms.cob, 0.0)

