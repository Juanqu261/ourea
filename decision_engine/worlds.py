"""Step 3: sample the world matrix (W × P) with a seeded Latin hypercube."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, replace

import numpy as np

from .dataset import MUNICIPALITY_IDS, Dataset
from .fingerprint import canonical_json, decision_fingerprint
from .uncertainty import MULTIDIMENSIONAL_PENALTY, N_WORLDS, SEED, parameters, ranges_payload
from .world0 import World, ssp_cell, world0, with_ssp

ENGINE_VERSION = "1"


@dataclass(frozen=True)
class WorldMatrix:
    columns: list[str]
    values: np.ndarray       # (W, P) float64
    seed: int
    fingerprint: str

    @property
    def size(self) -> int:
        return self.values.shape[0]

    def column(self, name: str) -> np.ndarray:
        return self.values[:, self.columns.index(name)]

    def prefixed(self, prefix: str) -> np.ndarray:
        indices = [index for index, name in enumerate(self.columns) if name.startswith(prefix)]
        return self.values[:, indices]


def latin_hypercube(rng: np.random.Generator, n: int, dims: int) -> np.ndarray:
    """One point per stratum in each dimension, strata shuffled independently."""
    offsets = rng.random((n, dims))
    strata = np.stack([rng.permutation(n) for _ in range(dims)], axis=1)
    return (strata + offsets) / n


def inputs_digest(dataset: Dataset) -> str:
    payload = {
        "interventions": dataset.interventions,
        "metrics": dataset.metrics,
        "history": {key: dataset.history[key] for key in ("coverage", "matches", "max_adequate_match_count")},
        "parameters": dataset.parameters,
        "gaps": dataset.gaps,
        "lever_readings": dataset.lever_readings,
    }
    return hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()


def run_fingerprint(dataset: Dataset, seed: int, n_worlds: int) -> str:
    return decision_fingerprint({
        "engine": ENGINE_VERSION,
        "inputs_sha256": inputs_digest(dataset),
        "ranges": ranges_payload(dataset)["parameters"],
        "seed": seed,
        "n_worlds": n_worlds,
        "numpy": np.__version__,
    })


def _dirichlet_with_emphasis(uniforms: np.ndarray, emphasis: np.ndarray, dimension_ids: list[str]) -> np.ndarray:
    """7 × Dirichlet(1,…,1). With emphasis, biodiversity and water take the two largest weights."""
    draws = -np.log1p(-uniforms)                     # Exp(1)
    weights = len(dimension_ids) * draws / draws.sum(axis=1, keepdims=True)
    bio, water = dimension_ids.index("biodiversity"), dimension_ids.index("water")
    others = [index for index in range(len(dimension_ids)) if index not in (bio, water)]
    for row in np.flatnonzero(emphasis):
        values = weights[row]
        order = np.argsort(-values, kind="stable")
        top, rest = order[:2], order[2:]
        high, low = values[top[0]], values[top[1]]
        reordered = np.empty_like(values)
        bio_first = draws[row, bio] >= draws[row, water]
        reordered[bio] = high if bio_first else low
        reordered[water] = low if bio_first else high
        reordered[others] = values[np.sort(rest)]   # the others keep their original order
        weights[row] = reordered
    return weights


def sample_worlds(dataset: Dataset, n_worlds: int = N_WORLDS, seed: int = SEED) -> WorldMatrix:
    if n_worlds % 2:
        raise ValueError("n_worlds must be even (half per scenario)")
    specs = parameters(dataset)
    columns = [spec.name for spec in specs]
    rng = np.random.Generator(np.random.PCG64(seed))
    dimension_ids = dataset.dimension_ids
    blocks = []
    for scenario in (0, 1):
        n = n_worlds // 2
        shift_names = [spec.name for spec in specs if spec.sampling == "shift"]
        scalar_names = [spec.name for spec in specs if spec.sampling in ("uniform", "log_uniform")]
        layout = scalar_names + ["dim_emphasis"] + [f"dir[{d}]" for d in dimension_ids] + shift_names
        cube = latin_hypercube(rng, n, len(layout))
        u = {name: cube[:, index] for index, name in enumerate(layout)}
        block = np.zeros((n, len(columns)))

        def set_column(name, values, block=block):
            block[:, columns.index(name)] = values

        set_column("scenario", scenario)
        for spec in specs:
            if spec.sampling == "uniform":
                set_column(spec.name, spec.low + (spec.high - spec.low) * u[spec.name])
            elif spec.sampling == "log_uniform":
                set_column(spec.name, np.exp(np.log(spec.low) + (np.log(spec.high) - np.log(spec.low)) * u[spec.name]))
        if scenario == 0:
            set_column("p_shift", 0.0)
        emphasis = (u["dim_emphasis"] < 0.5).astype(float)
        set_column("dim_emphasis", emphasis)
        weights = _dirichlet_with_emphasis(np.stack([u[f"dir[{d}]"] for d in dimension_ids], axis=1), emphasis, dimension_ids)
        for index, dimension_id in enumerate(dimension_ids):
            set_column(f"dim_w[{dimension_id}]", weights[:, index])
        if scenario == 1:
            p_shift = block[:, columns.index("p_shift")]
            for name in shift_names:
                set_column(name, (u[name] < p_shift).astype(float))
            municipality_id, dimension_id = ssp_cell(dataset)
            set_column(f"ssp_shift[{municipality_id},{dimension_id}]", 1.0)
        blocks.append(block)
    values = np.round(np.concatenate(blocks), 6)
    return WorldMatrix(columns, values, seed, run_fingerprint(dataset, seed, n_worlds))


def world_row(dataset: Dataset, world: World) -> np.ndarray:
    """A World as a row of the world matrix."""
    columns = [spec.name for spec in parameters(dataset)]
    row = np.zeros(len(columns))
    row[columns.index("scenario")] = 0 if world.scenario == "reference" else 1
    for name in ("w_vuln", "w_rec", "gamma", "dim_penalty", "cobenefit_w", "lever_mismatch", "p_shift"):
        row[columns.index(name)] = getattr(world, name)
    for index, dimension_id in enumerate(dataset.dimension_ids):
        row[columns.index(f"dim_w[{dimension_id}]")] = world.dim_w[index]
    for index, measure_id in enumerate(dataset.measure_ids):
        row[columns.index(f"eff[{measure_id}]")] = world.eff[index]
    for municipality_id, dimension_id in world.ssp_shift:
        row[columns.index(f"ssp_shift[{municipality_id},{dimension_id}]")] = 1.0
    return row


def row_world(dataset: Dataset, columns: list[str], row: np.ndarray) -> World:
    """A row of the world matrix as a World, for the scalar engine."""
    value = lambda name: float(row[columns.index(name)])  # noqa: E731
    shifted = frozenset(
        (municipality_id, dimension_id)
        for municipality_id in MUNICIPALITY_IDS
        for dimension_id in dataset.dimension_ids
        if value(f"ssp_shift[{municipality_id},{dimension_id}]") > 0.5
    )
    return World(
        scenario="reference" if value("scenario") < 0.5 else dataset.parameters["ssp"]["scenario"],
        w_vuln=value("w_vuln"),
        w_rec=value("w_rec"),
        dim_w=tuple(value(f"dim_w[{d}]") for d in dataset.dimension_ids),
        gamma=value("gamma"),
        dim_penalty=value("dim_penalty"),
        cobenefit_w=value("cobenefit_w"),
        lever_mismatch=value("lever_mismatch"),
        eff=tuple(value(f"eff[{k}]") for k in dataset.measure_ids),
        ssp_shift=shifted,
        p_shift=value("p_shift"),
    )


def named_points(dataset: Dataset) -> dict[str, np.ndarray]:
    """Named lenses that are points in world space, plus World 0 under SSP."""
    base = world0(dataset)
    return {
        "institucional": world_row(dataset, base),
        "multidimensional": world_row(dataset, replace(base, dim_penalty=MULTIDIMENSIONAL_PENALTY)),
        "institucional_ssp": world_row(dataset, with_ssp(base, dataset)),
    }
