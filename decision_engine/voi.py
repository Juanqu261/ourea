"""D. Value of information: switching values, gap ranking and EVPPI with a bias correction.

Switching values come straight from the score table: the search is a full
enumeration, so they are exact. EVPPI with 1.566 sets is biased upward (a max
over noisy bin means), so the same statistic on a shuffled copy of the
parameter is subtracted.
"""

from __future__ import annotations

import numpy as np

from .simulation import Simulation
from .uncertainty import EVIDENCE_LABELS, EVPPI_BINS, EVPPI_SHUFFLES, SEED, parameters
from .wording import check, es_num, es_pct
from .world_score import best_sets, contributions


def _pct(values: np.ndarray, q: float) -> float | None:
    values = values[~np.isnan(values)]
    return round(float(np.percentile(values, q)), 4) if len(values) else None


def switching_values(sim: Simulation, s_star: int) -> dict[str, dict]:
    """How far each measure is from switching, per world, as a ratio of its own contribution.

    Primary reading, against the best set of each world (exact, never negative,
    and equal to the JS rejected gaps at World 0):
      k outside best(w): δ = score(best) − best score of a set with k → needs (1 + δ/c)× its score to enter;
      k inside best(w):  δ = score(best) − best score of a set without k → leaves below (1 − δ/c)×.
    c is k's contribution in the set it belongs to (the best with k, or best(w)).
    The same δ against s* (the plan's first definition) is reported as `vs_s_star`;
    it is negative wherever s* is not the best set.
    """
    rows_index = np.arange(sim.n_worlds)
    members = sim.space.members
    best = sim.best
    best_score = sim.best_score
    star_score = sim.table[:, s_star]
    best_contrib = sim.contributions(best)
    star_contrib = sim.contributions(np.full(sim.n_worlds, s_star))
    rows = {}
    for k, measure_id in enumerate(sim.ctx.measure_ids):
        with_k = best_sets(sim.space, sim.table, members[:, k])
        without_k = best_sets(sim.space, sim.table, ~members[:, k])
        inside = members[best, k]
        alternative = np.where(inside, without_k, with_k)
        delta = (best_score - sim.table[rows_index, alternative]) / 1e6
        own = np.where(inside, best_contrib[:, k], sim.contributions(with_k)[:, k])
        distance = np.divide(delta, own, out=np.full_like(delta, np.nan), where=own > 0)
        in_star = bool(members[s_star, k])
        star_alternative = without_k if in_star else with_k
        star_delta = (star_score - sim.table[rows_index, star_alternative]) / 1e6
        star_own = star_contrib[:, k] if in_star else sim.contributions(with_k)[:, k]
        star_distance = np.divide(star_delta, star_own, out=np.full_like(star_delta, np.nan), where=star_own > 0)
        out_median = _pct(distance[~inside], 50)
        in_median = _pct(distance[inside], 50)
        parts = [f"Está en el mejor portafolio en {es_pct(inside.mean())} de los mundos probados."]
        if out_median is not None and (~inside).any():
            parts.append(f"Cuando queda fuera, necesitaría valer {es_num(1 + out_median)} veces su puntaje para entrar (mediana).")
        if in_median is not None and inside.any():
            parts.append(f"Cuando está dentro, saldría si valiera menos de {es_num(max(0.0, 1 - in_median))} veces su puntaje (mediana).")
        rows[measure_id] = {
            "in_s_star": in_star,
            "share_in_best": round(float(inside.mean()), 4),
            "distance_median": _pct(distance, 50),
            "distance_p5": _pct(distance, 5),
            "distance_p95": _pct(distance, 95),
            "out_distance_median": out_median,
            "out_distance_p5": _pct(distance[~inside], 5),
            "out_distance_p95": _pct(distance[~inside], 95),
            "in_distance_median": in_median,
            "in_distance_p5": _pct(distance[inside], 5),
            "in_distance_p95": _pct(distance[inside], 95),
            "delta_median": round(float(np.median(delta)), 6),
            "vs_s_star": {
                "delta_median": round(float(np.median(star_delta)), 6),
                "delta_p5": round(float(np.percentile(star_delta, 5)), 6),
                "delta_p95": round(float(np.percentile(star_delta, 95)), 6),
                "distance_median": _pct(star_distance, 50),
                "s_star_not_best_share": round(float((best != s_star).mean()), 4),
            },
            "sentence": check(" ".join(parts)),
        }
    world0 = world0_switching(sim)
    for measure_id, row in world0.items():
        rows[measure_id].update(row)
    return rows


def world0_switching(sim: Simulation) -> dict[str, dict]:
    """At World 0, against the World-0 best. For measures outside it, δ equals the JS rejected gap."""
    point = sim.points["institucional"]
    best = point["best"]
    members = sim.space.members
    dim_penalty = point["row"][None, sim.worlds.columns.index("dim_penalty")]
    rows = {}
    for k, measure_id in enumerate(sim.ctx.measure_ids):
        inside = bool(members[best, k])
        allowed = ~members[:, k] if inside else members[:, k]
        alternative = int(best_sets(sim.space, point["table"][None, :], allowed)[0])
        delta = round(float(point["table"][best] - point["table"][alternative]) / 1e6, 6)
        own_set = np.array([best if inside else alternative])
        own = float(contributions(sim.ctx, sim.space, point["terms"], dim_penalty, own_set)[0, k])
        rows[measure_id] = {
            "world0_in_best": inside,
            "world0_delta": delta,
            "world0_own_contribution": round(own, 6),
            "world0_distance": round(delta / own, 4) if own > 0 else None,
        }
    return rows


def world0_gaps(sim: Simulation) -> dict[str, float]:
    """World-0 best − best set containing k, for k outside it. Equals the JS `rejected` gaps."""
    return {k: row["world0_delta"] for k, row in world0_switching(sim).items() if not row["world0_in_best"]}


def _bins(values: np.ndarray, binary: bool, bins: int = EVPPI_BINS) -> tuple[np.ndarray, int]:
    if binary:
        return (values > 0.5).astype(np.int64), 2
    order = np.argsort(values, kind="stable")
    labels = np.empty(len(values), dtype=np.int64)
    labels[order] = np.arange(len(values)) * bins // len(values)
    return labels, bins


def _evppi_statistic(table: np.ndarray, labels: np.ndarray, n_bins: int) -> float:
    """mean over bins of (max_s bin-mean score) − max_s overall mean score, in micro-units."""
    onehot = np.zeros((n_bins, len(labels)))
    onehot[labels, np.arange(len(labels))] = 1.0
    sizes = onehot.sum(axis=1)
    present = sizes > 0
    sums = onehot[present] @ table                  # exact: integer values, sums < 2^53
    bin_best = (sums / sizes[present, None]).max(axis=1)
    informed = float((bin_best * sizes[present]).sum() / len(labels))
    return informed - float(table.mean(axis=0).max())


def evppi(sim: Simulation) -> list[dict]:
    table = sim.table.astype(np.float64)
    baseline_value = float(table.mean(axis=0).max())
    rng = np.random.Generator(np.random.PCG64(SEED + 1))
    rows = []
    for j, spec in enumerate(parameters(sim.dataset)):
        if spec.sampling == "fixed_ssp":
            continue
        values = sim.worlds.values[:, j]
        labels, n_bins = _bins(values, spec.binary)
        if len(np.unique(labels)) < 2:
            continue
        raw = _evppi_statistic(table, labels, n_bins)
        shuffled = [_evppi_statistic(table, labels[rng.permutation(len(labels))], n_bins) for _ in range(EVPPI_SHUFFLES)]
        bias = float(np.mean(shuffled))
        corrected = raw - bias
        rows.append({
            "parameter": spec.name,
            "evidence": spec.evidence,
            "evidence_label": EVIDENCE_LABELS[spec.evidence],
            "gaps": spec.gaps,
            "raw": round(raw / 1e6, 6),
            "bias": round(bias / 1e6, 6),
            "corrected": round(corrected / 1e6, 6),
            "corrected_pct": round(corrected / baseline_value, 6),
            "raw_pct": round(raw / baseline_value, 6),
        })
    rows.sort(key=lambda row: (-row["corrected"], row["parameter"]))
    return rows


def gap_parameters(sim: Simulation) -> dict[str, list[str]]:
    """Model gaps → the world parameters they would pin down."""
    links: dict[str, list[str]] = {}
    for spec in parameters(sim.dataset):
        if spec.sampling == "fixed_ssp":
            continue
        for gap_id in spec.gaps:
            links.setdefault(gap_id, []).append(spec.name)
    for gap in sim.dataset.gaps:
        if gap["kind"] == "model" and gap["id"] not in links:
            # Hydrology and maintenance act through how well a measure works.
            links[gap["id"]] = [f"eff[{k}]" for k in gap["affected_intervention_ids"]]
    return links


def gap_ranking(sim: Simulation, switching: dict, evppi_rows: list[dict]) -> dict:
    by_parameter = {row["parameter"]: row for row in evppi_rows}
    links = gap_parameters(sim)
    dependency, site, model = [], [], []
    for gap in sim.dataset.gaps:
        distances = [
            (switching[k]["distance_median"], k) for k in gap["affected_intervention_ids"]
            if switching[k]["distance_median"] == switching[k]["distance_median"]
        ]
        closest = min(distances) if distances else (None, None)
        row = {
            "id": gap["id"],
            "kind": gap["kind"],
            "missing_information": gap["missing_information"],
            "responsible_actor_if_known": gap.get("responsible_actor_if_known"),
            "affected_intervention_ids": gap["affected_intervention_ids"],
            "closest_measure": closest[1],
            "closest_distance_median": closest[0],
        }
        if gap["kind"] == "model":
            linked = [by_parameter[name] for name in links.get(gap["id"], []) if name in by_parameter]
            top = max(linked, key=lambda item: item["corrected"]) if linked else None
            row["evppi_max_corrected_pct"] = top["corrected_pct"] if top else None
            row["evppi_parameter"] = top["parameter"] if top else None
            row["evppi_parameters"] = [item["parameter"] for item in linked]
            row["exploratory"] = bool(top and top["evidence"] == "exploratory")
            model.append(row)
        elif gap["kind"] == "site":
            site.append(row)
        else:
            dependency.append(row)
    by_distance = lambda row: (row["closest_distance_median"] is None, row["closest_distance_median"] or 0, row["id"])  # noqa: E731
    dependency.sort(key=by_distance)
    site.sort(key=by_distance)
    model.sort(key=lambda row: (-(row["evppi_max_corrected_pct"] or 0), row["id"]))
    preferences = [
        {"parameter": row["parameter"], "corrected_pct": row["corrected_pct"], "evidence": row["evidence"]}
        for row in evppi_rows if not row["gaps"]
    ]
    return {
        "dependency": dependency,
        "site": site,
        "model": model,
        "preferences": preferences,
        "preferences_note": "Estos parámetros no son datos faltantes: son prioridades que CORNARE decide (peso entre dimensiones, "
                            "valor de una segunda medida, lectura de la escala de clases). Su EVPPI dice cuánto cambia la "
                            "decisión si CORNARE las declara.",
        "note": "Las brechas de dependencia van en el orden de la entrevista: primero la que está más cerca de cambiar s*. "
                "Las brechas de modelo se ordenan por EVPPI corregido. El EVPPI no se suma entre parámetros.",
    }


def value_of_information(sim: Simulation, s_star: int) -> dict:
    switching = switching_values(sim, s_star)
    rows = evppi(sim)
    return {
        "s_star": sim.space.ids_of(s_star),
        "switching": switching,
        "world0_rejected_gaps": world0_gaps(sim),
        "evppi": rows,
        "evppi_method": {
            "bins": EVPPI_BINS,
            "binary_bins": 2,
            "shuffles": EVPPI_SHUFFLES,
            "statistic": "media por bin del mejor puntaje medio − mejor puntaje medio global; se resta la misma cifra con el parámetro barajado",
            "unit": "puntos de prioridad; *_pct es la fracción del mejor puntaje medio",
        },
        "gaps": gap_ranking(sim, switching, rows),
    }
