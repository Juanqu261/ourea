"""A. Acceptability: which portfolios stay near the best across the tested worlds.

Wording rule: "casi óptimo en X% de los N mundos probados". Never "probabilidad".
"""

from __future__ import annotations

import numpy as np

from .simulation import Simulation
from .uncertainty import CORE_SHARE, NEAR_THRESHOLDS, PRIMARY_NEAR, RARE_SHARE
from .wording import check, near_best_sentence

SCENARIOS = {"all": None, "reference": False, "ssp3_7_0": True}
TOP_SETS = 20
CENTRAL_SETS = 5


def near_key(threshold: float) -> str:
    return f"near_{round(threshold * 100)}"


def scenario_mask(sim: Simulation, scenario: str) -> np.ndarray:
    flag = SCENARIOS[scenario]
    return np.ones(sim.n_worlds, dtype=bool) if flag is None else sim.scenario == flag


def set_metrics(sim: Simulation) -> dict[str, dict[str, np.ndarray]]:
    """Per scenario: rank1 and near_x for every set, as (S,) shares of worlds."""
    metrics = {}
    for scenario in SCENARIOS:
        mask = scenario_mask(sim, scenario)
        rows = {"rank1": np.bincount(sim.best[mask], minlength=sim.space.size) / mask.sum()}
        for threshold in NEAR_THRESHOLDS:
            rows[near_key(threshold)] = (sim.regret[mask] <= threshold + 1e-12).mean(axis=0)
        metrics[scenario] = rows
    return metrics


def choose_s_star(sim: Simulation, metrics: dict, threshold: float = PRIMARY_NEAR) -> int:
    """Highest near-best share, then highest rank1, then the World-0 score, then the JS tie-break."""
    overall = metrics["all"]
    world0_score = sim.points["institucional"]["table"]
    order = np.lexsort((
        sim.space.tie_rank,
        -world0_score,
        -overall["rank1"],
        -overall[near_key(threshold)],
    ))
    return int(order[0])


def ranking(sim: Simulation, metrics: dict) -> np.ndarray:
    overall = metrics["all"]
    return np.lexsort((
        sim.space.tie_rank,
        -sim.points["institucional"]["table"],
        -overall["rank1"],
        -overall[near_key(PRIMARY_NEAR)],
    ))


def inclusion(sim: Simulation, threshold: float = PRIMARY_NEAR) -> dict[str, dict]:
    """incl_best(k): share of worlds whose best set contains k. incl_near(k): mean share of near-best sets with k."""
    members = sim.space.members
    near = sim.regret <= threshold + 1e-12                                # (W, S)
    near_count = near.sum(axis=1)
    near_with = (near.astype(np.float64) @ members.astype(np.float64)) / near_count[:, None]   # (W, K)
    best_with = members[sim.best]                                          # (W, K)
    result = {}
    for k, measure_id in enumerate(sim.ctx.measure_ids):
        row = {}
        for scenario in SCENARIOS:
            mask = scenario_mask(sim, scenario)
            row[scenario] = {
                "incl_best": float(best_with[mask, k].mean()),
                "incl_near": float(near_with[mask, k].mean()),
            }
        share = row["all"]["incl_best"]
        row["class"] = "core" if share >= CORE_SHARE else ("contingent" if share >= RARE_SHARE else "rarely")
        result[measure_id] = row
    return result


def central_parameters(sim: Simulation, set_indices) -> list[dict]:
    """Mean world parameters where each set wins: "si cree X, elija B"."""
    columns = sim.worlds.columns
    values = sim.worlds.values
    overall_mean = values.mean(axis=0)
    overall_std = values.std(axis=0)
    rows = []
    for index in set_indices:
        wins = sim.best == index
        if not wins.any():
            continue
        mean = values[wins].mean(axis=0)
        z = np.divide(mean - overall_mean, overall_std, out=np.zeros_like(mean), where=overall_std > 0)
        order = np.argsort(-np.abs(z), kind="stable")[:5]
        rows.append({
            "ids": sim.space.ids_of(index),
            "wins": int(wins.sum()),
            "most_distinct": [
                {"parameter": columns[j], "mean_where_wins": round(float(mean[j]), 4),
                 "mean_all": round(float(overall_mean[j]), 4), "z": round(float(z[j]), 3)}
                for j in order
            ],
        })
    return rows


def dimensions_of(sim: Simulation, index: int) -> list[str]:
    measures = {measure["id"]: measure for measure in sim.ctx.measures}
    return sorted({measures[k]["dimension_id"] for k in sim.space.ids_of(index)})


def set_summary(sim: Simulation, metrics: dict, index: int) -> dict:
    world0 = sim.points["institucional"]
    world0_best = world0["table"][world0["best"]]
    row = {
        "ids": sim.space.ids_of(index),
        "cost": int(sim.space.cost[index]),
        "dimensions": dimensions_of(sim, index),
        "world0_score": world0["table"][index] / 1e6,
        "world0_regret": round(float((world0_best - world0["table"][index]) / world0_best), 6),
    }
    for scenario, values in metrics.items():
        row[scenario] = {name: round(float(series[index]), 4) for name, series in values.items()}
    return row


def robustness(sim: Simulation) -> dict:
    metrics = set_metrics(sim)
    s_star = choose_s_star(sim, metrics)
    by_threshold = {near_key(t): choose_s_star(sim, metrics, t) for t in NEAR_THRESHOLDS}
    order = ranking(sim, metrics)
    incl = inclusion(sim)
    n = sim.n_worlds
    near_share = metrics["all"][near_key(PRIMARY_NEAR)][s_star]
    points = {}
    for name, point in sim.points.items():
        best = point["best"]
        points[name] = {
            "best_ids": sim.space.ids_of(best),
            "best_score": point["table"][best] / 1e6,
            "s_star_score": point["table"][s_star] / 1e6,
            "s_star_regret": round(float((point["table"][best] - point["table"][s_star]) / point["table"][best]), 6),
        }
    world0 = sim.points["institucional"]["table"]
    within = {near_key(t): int((world0 >= world0.max() * (1 - t) - 1e-9).sum()) for t in (0.01, 0.02, 0.05, 0.10)}
    return {
        "s_star": set_summary(sim, metrics, s_star),
        "s_star_index": s_star,
        "s_star_by_threshold": {key: sim.space.ids_of(index) for key, index in by_threshold.items()},
        "s_star_stable_across_thresholds": len({index for index in by_threshold.values()}) == 1,
        "s_star_sentence": check(
            f"El portafolio {', '.join(sim.space.ids_of(s_star))} es {near_best_sentence(near_share, n, PRIMARY_NEAR)}."
        ),
        "top_sets": [set_summary(sim, metrics, int(index)) for index in order[:TOP_SETS]],
        "inclusion": incl,
        "core": [k for k, row in incl.items() if row["class"] == "core"],
        "contingent": [k for k, row in incl.items() if row["class"] == "contingent"],
        "rarely": [k for k, row in incl.items() if row["class"] == "rarely"],
        "central_parameters": central_parameters(sim, [int(i) for i in np.argsort(-metrics["all"]["rank1"], kind="stable")[:CENTRAL_SETS]]),
        "points": points,
        "world0_sets_within": within,
        "distinct_winners": int(len(np.unique(sim.best))),
    }
