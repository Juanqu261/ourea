"""Tool functions for the AI layer (AI_AGENTS_PLAN.md §3.1). Pure: no file writes.

Each returns {"result", "evidence_labels", "fingerprint"}. The service adds
`warnings` and `sources`. Derived numbers (score_loss_pct, ratios, shares) are
computed here so the LLM never computes them.
"""

from __future__ import annotations

import json
from dataclasses import replace
from functools import lru_cache

from .breaking_points import breaking_points as compute_breaking_points
from .build import _clean, compute_cached
from .dataset import DATA, MUNICIPALITY_IDS, load_dataset
from .fingerprint import decision_fingerprint
from .levers import cell_profiles
from .robustness import near_key, set_metrics
from .simulation import simulate
from .uncertainty import EVIDENCE_LABELS, N_WORLDS, NEAR_THRESHOLDS, PRIMARY_NEAR, SEED
from .world0 import Context, place_measure, search, with_ssp, world0
from .worlds import run_fingerprint

WORLD_FIELDS = {"w_vuln", "w_rec", "gamma", "dim_penalty", "cobenefit_w", "lever_mismatch"}


def _labels(fields: dict[str, str]) -> dict[str, str]:
    """{"acceptability.near": "team_inference"} → {"acceptability.near": "Inferencia del equipo"}."""
    return {field: EVIDENCE_LABELS[kind] for field, kind in fields.items()}


def _published(name: str, n_worlds: int = N_WORLDS, seed: int = SEED) -> dict:
    """The committed JSON when its fingerprint matches this run; otherwise a fresh computation."""
    path = DATA / name
    if path.exists():
        payload = json.loads(path.read_text(encoding="utf-8"))
        if payload.get("fingerprint") == run_fingerprint(load_dataset(), seed, n_worlds):
            return payload
    return compute_cached(n_worlds, seed)[name]


def _envelope(result, labels: dict[str, str], fingerprint: str | None) -> dict:
    return {"result": result, "evidence_labels": labels, "fingerprint": fingerprint}


@lru_cache(maxsize=1)
def _context() -> Context:
    return Context(load_dataset())


@lru_cache(maxsize=2)
def _simulation(n_worlds: int = N_WORLDS, seed: int = SEED):
    return simulate(load_dataset(), n_worlds, seed)


def _world(overrides: dict | None):
    """World 0 with optional overrides: any World field, plus scenario='ssp3_7_0', dim_w={id: w}, eff={id: e}."""
    dataset = load_dataset()
    world = world0(dataset)
    overrides = dict(overrides or {})
    if overrides.pop("scenario", "reference") != "reference":
        world = with_ssp(world, dataset)
    dim_w = overrides.pop("dim_w", None)
    if dim_w:
        world = replace(world, dim_w=tuple(float(dim_w.get(d, 1.0)) for d in dataset.dimension_ids))
    eff = overrides.pop("eff", None)
    if eff:
        world = replace(world, eff=tuple(float(eff.get(k, 1.0)) for k in dataset.measure_ids))
    unknown = set(overrides) - WORLD_FIELDS
    if unknown:
        raise ValueError(f"Unknown world parameters: {sorted(unknown)}")
    return replace(world, **{key: float(value) for key, value in overrides.items()})


def _portfolio_fingerprint(ids, cost, world_overrides=None, force=(), exclude=(), budget=None) -> str:
    dataset = load_dataset()
    parameters = dataset.parameters
    payload = {
        "ids": list(ids),
        "cost": cost,
        "budget": parameters["budget_million_cop"] if budget is None else budget,
        "weights": parameters["weights"],
        "diminishing": parameters["diminishing_second_measure"]["institucional"],
    }
    if world_overrides or force or exclude:   # World 0 keeps the same fingerprint as the browser
        payload.update({"world": world_overrides or {}, "force": sorted(force), "exclude": sorted(exclude)})
    return decision_fingerprint(payload)


def get_context() -> dict:
    dataset = load_dataset()
    ctx = _context()
    cells = cell_profiles(dataset)
    result = {
        "municipalities": dataset.profiles,
        "dimensions": dataset.dimensions,
        "classes": [
            {"municipality_id": m, "dimension_id": d, "class_index": ctx.base_class[(m, d)],
             "adaptive_capacity": ctx.capacity[(m, d)], "lever_profile": cells[(m, d)]["profile"]}
            for m in MUNICIPALITY_IDS for d in dataset.dimension_ids
        ],
        "measures": [
            {key: measure.get(key) for key in ("id", "name", "dimension_id", "cost_million_cop", "scope", "nbs_class", "lever")}
            for measure in dataset.interventions
        ],
        "gaps": [
            {key: gap.get(key) for key in ("id", "kind", "missing_information", "affected_intervention_ids", "responsible_actor_if_known", "priority")}
            for gap in dataset.gaps
        ],
        "budget_million_cop": dataset.parameters["budget_million_cop"],
        "evidence_labels": EVIDENCE_LABELS,
    }
    return _envelope(result, _labels({"classes": "team_inference", "measures.cost_million_cop": "assumption", "measures.lever": "team_inference", "gaps.affected_intervention_ids": "team_inference"}), None)


def search_portfolios(world: dict | None = None, force=(), exclude=(), budget: int | None = None) -> dict:
    best = search(_context(), _world(world), force, exclude, budget)
    if best is None:
        return _envelope(None, {}, None) | {"warnings": ["no_feasible_portfolio"]}
    result = {
        "ids": list(best.ids),
        "cost": best.cost,
        "remaining": best.remaining,
        "score": best.objective,
        "parts": best.parts,
        "world": world or {},
    }
    return _envelope(result, _labels({"score": "team_inference", "cost": "assumption"}),
                     _portfolio_fingerprint(best.ids, best.cost, world, force, exclude, budget))


def run_robustness(n_worlds: int | None = None, seed: int | None = None) -> dict:
    payload = _published("robustness.json", n_worlds or N_WORLDS, seed or SEED)
    return _envelope(payload, _labels({"acceptability.near": "team_inference", "acceptability.rank1": "team_inference",
                                       "pathways.signal": "exploratory"}), payload["fingerprint"])


def breaking_points(portfolio=None, regret_threshold: float = 0.10) -> dict:
    labels = _labels({"decision_residual_risk.boxes": "exploratory", "residual_vulnerability": "institutional"})
    if portfolio is None and abs(regret_threshold - 0.10) < 1e-12:
        payload = _published("breaking_points.json")
        return _envelope(payload, labels, payload["fingerprint"])
    sim = _simulation()
    ids = portfolio or _published("robustness.json")["s_star"]["ids"]
    payload = _clean(compute_breaking_points(sim, sim.space.index_of(ids), regret_threshold))
    return _envelope(payload, labels, sim.fingerprint)


def value_of_information() -> dict:
    payload = _published("value_of_information.json")
    return _envelope({key: payload[key] for key in ("evppi", "evppi_method", "gaps", "world0_rejected_gaps")},
                     _labels({"evppi": "exploratory", "gaps.affected_intervention_ids": "team_inference"}), payload["fingerprint"])


def switching_value(intervention_id: str) -> dict:
    payload = _published("value_of_information.json")
    if intervention_id not in payload["switching"]:
        raise KeyError(intervention_id)
    return _envelope({"id": intervention_id, **payload["switching"][intervention_id]},
                     _labels({"distance": "team_inference", "world0_delta": "team_inference"}), payload["fingerprint"])


def _acceptability(index: int) -> dict:
    metrics = _metrics()
    return {scenario: {name: round(float(series[index]), 4) for name, series in rows.items()} for scenario, rows in metrics.items()}


@lru_cache(maxsize=1)
def _metrics():
    return set_metrics(_simulation())


def price_of_constraint(force=(), exclude=()) -> dict:
    ctx = _context()
    base = search(ctx, world0(ctx.dataset))
    constrained = search(ctx, world0(ctx.dataset), force, exclude)
    if constrained is None:
        return _envelope(None, {}, None) | {"warnings": ["no_feasible_portfolio"]}
    sim = _simulation()
    s_star = _published("robustness.json")["s_star"]
    primary = near_key(PRIMARY_NEAR)
    constrained_acceptability = _acceptability(sim.space.index_of(constrained.ids))
    loss = base.objective - constrained.objective
    result = {
        "unconstrained": {"ids": list(base.ids), "score": base.objective, "cost": base.cost},
        "constrained": {"ids": list(constrained.ids), "score": constrained.objective, "cost": constrained.cost},
        "score_loss": round(loss, 6),
        "score_loss_pct": round(loss / base.objective, 6),
        "leave": sorted(set(base.ids) - set(constrained.ids)),
        "enter": sorted(set(constrained.ids) - set(base.ids)),
        "acceptability": {
            "constrained": constrained_acceptability["all"],
            "s_star": s_star["all"],
            "near_loss_vs_s_star": round(s_star["all"][primary] - constrained_acceptability["all"][primary], 4),
        },
    }
    return _envelope(result, _labels({"score_loss_pct": "team_inference", "acceptability": "team_inference"}),
                     _portfolio_fingerprint(constrained.ids, constrained.cost, None, force, exclude))


def compare_portfolios(a, b) -> dict:
    sim = _simulation()
    point = sim.points["institucional"]
    best = point["table"][point["best"]]
    rows = []
    for ids in (a, b):
        index = sim.space.index_of(ids)
        acceptability = _acceptability(index)
        rows.append({
            "ids": sim.space.ids_of(index),
            "cost": int(sim.space.cost[index]),
            "world0_score": point["table"][index] / 1e6,
            "world0_regret": round(float((best - point["table"][index]) / best), 6),
            "dimensions": sorted({sim.ctx.measures[k]["dimension_id"] for k in range(len(sim.ctx.measures)) if sim.space.members[index, k]}),
            **{f"near_{round(t * 100)}": acceptability["all"][near_key(t)] for t in NEAR_THRESHOLDS},
            "rank1": acceptability["all"]["rank1"],
            "by_scenario": acceptability,
        })
    return _envelope({"a": rows[0], "b": rows[1]}, _labels({"world0_score": "team_inference", "near": "team_inference"}), sim.fingerprint)


def explain(intervention_id: str) -> dict:
    """Structured facts. The Spanish sentences stay in the browser's explanations.js."""
    sim = _simulation()
    k = sim.ctx.measure_ids.index(intervention_id)
    point = sim.points["institucional"]
    terms = point["terms"]
    measure = sim.ctx.measures[k]
    placement = place_measure(sim.ctx, measure, world0(sim.dataset))
    best = point["best"]
    switching = _published("value_of_information.json")["switching"][intervention_id]
    inclusion = _published("robustness.json")["inclusion"][intervention_id]
    result = {
        "id": intervention_id,
        "name": measure["name"],
        "dimension_id": measure["dimension_id"],
        "lever": measure["lever"],
        "cost": measure["cost_million_cop"],
        "placement": {"candidates": list(placement.candidates), "tie_steps": list(placement.tie_steps),
                      "class_index": placement.highest_class, "scope": measure["scope"]},
        "world0_terms": {
            "vulnerability": float(terms.vuln[0, k]),
            "recurrence": None if terms.withheld[0, k] else float(terms.rec[0, k]),
            "recurrence_withheld": bool(terms.withheld[0, k]),
            "cobenefit": float(terms.cob[0, k]),
            "lever_fit": float(terms.lever_fit[0, k]),
        },
        "in_world0_best": bool(sim.space.members[best, k]),
        "switching": switching,
        "inclusion": inclusion,
    }
    return _envelope(result, _labels({"placement": "team_inference", "world0_terms": "team_inference", "switching": "team_inference"}),
                     sim.fingerprint)
