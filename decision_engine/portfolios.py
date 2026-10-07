"""Step 2: the portfolio space. Every non-empty set of measures that fits the fund."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import numpy as np


@dataclass(frozen=True)
class PortfolioSpace:
    measure_ids: tuple[str, ...]
    costs: np.ndarray        # (15,) int
    budget: int
    members: np.ndarray      # (S, 15) bool, rows in ascending bitmask order
    cost: np.ndarray         # (S,) int
    tie_rank: np.ndarray     # (S,) int: 0 wins a score tie (more budget left, then ids)

    @property
    def size(self) -> int:
        return len(self.cost)

    def ids_of(self, index: int) -> list[str]:
        return sorted(self.measure_ids[k] for k in np.flatnonzero(self.members[index]))

    def index_of(self, ids) -> int:
        target = np.zeros(len(self.measure_ids), dtype=bool)
        for measure_id in ids:
            target[self.measure_ids.index(measure_id)] = True
        hits = np.flatnonzero((self.members == target).all(axis=1))
        if not len(hits):
            raise KeyError(f"Not a feasible portfolio: {sorted(ids)}")
        return int(hits[0])

    def key(self, index: int) -> str:
        return "|".join(self.ids_of(index))

    def maximal(self) -> np.ndarray:
        """Sets that cannot take any further measure within the budget."""
        left = self.budget - self.cost
        outside = np.where(self.members, np.iinfo(np.int64).max, self.costs[None, :])
        return outside.min(axis=1) > left

    def location_variant_count(self, corridor_mask: np.ndarray) -> int:
        """Σ over sets of 3^(non-corridor measures in the set)."""
        free = (self.members & ~corridor_mask[None, :]).sum(axis=1)
        return int((3 ** free).sum())


def build_space(measure_ids, costs, budget: int) -> PortfolioSpace:
    return _build_space(tuple(measure_ids), tuple(int(cost) for cost in costs), int(budget))


@lru_cache(maxsize=8)
def _build_space(measure_ids: tuple[str, ...], costs: tuple[int, ...], budget: int) -> PortfolioSpace:
    count = len(measure_ids)
    masks = np.arange(1, 2 ** count, dtype=np.int64)
    members = ((masks[:, None] >> np.arange(count)) & 1).astype(bool)
    cost_vector = np.array(costs, dtype=np.int64)
    total = members.astype(np.int64) @ cost_vector
    keep = total <= budget
    members, total = members[keep], total[keep]
    keys = ["|".join(sorted(measure_ids[k] for k in np.flatnonzero(row))) for row in members]
    order = sorted(range(len(keys)), key=lambda index: (int(total[index]), keys[index]))
    tie_rank = np.empty(len(keys), dtype=np.int64)
    tie_rank[order] = np.arange(len(keys))
    return PortfolioSpace(measure_ids, cost_vector, budget, members, total, tie_rank)


def space_for(dataset, budget: int | None = None) -> PortfolioSpace:
    return build_space(
        dataset.measure_ids,
        [measure["cost_million_cop"] for measure in dataset.interventions],
        dataset.parameters["budget_million_cop"] if budget is None else budget,
    )
