"""C. Adaptive pathway: commit now, commit on a signal, decide the site later, reserve check."""

from __future__ import annotations

from itertools import product

import numpy as np

from .breaking_points import best_box, describe_box, prim_inputs
from .dataset import MUNICIPALITY_IDS
from .simulation import Simulation
from .uncertainty import DELAY_COST_SHARE, EVIDENCE_LABELS, MUNICIPALITY_NAMES, SITE_CHANGE_SHARE
from .wording import check, es_pct
from .world_score import TermMatrices, members_of, score_table, term_matrices


def _box_signal(sim: Simulation, box, specs, evppi_by_parameter: dict) -> dict:
    first = box.order[0]
    spec = specs[first]
    low, high = box.limits[first]
    described = describe_box(box, specs, "La medida", "entra al mejor portafolio con más frecuencia")
    gaps = {gap["id"]: gap for gap in sim.dataset.gaps}
    owner = next((gaps[g]["responsible_actor_if_known"] for g in spec.gaps if gaps.get(g, {}).get("responsible_actor_if_known")), None)
    evppi = evppi_by_parameter.get(spec.name)
    return {
        "parameter": spec.name,
        "low": None if low is None else round(low, 4),
        "high": None if high is None else round(high, 4),
        "condition": described["conditions"][0]["text"],
        "evidence": spec.evidence,
        "evidence_label": EVIDENCE_LABELS[spec.evidence],
        "gaps": spec.gaps,
        "owner": owner,
        "watch": spec.watch,
        "value_of_information_pct": evppi["corrected_pct"] if evppi else None,
        "box": described,
    }


def _signal(sim: Simulation, k: int, measure: dict, x, binary, specs, evppi_by_parameter: dict) -> dict:
    """What drives k into the best set: the strongest driver, and the first observable signpost (a parameter with a gap)."""
    y = sim.space.members[sim.best, k].astype(float)
    row = {"id": measure["id"], "name": measure["name"], "share_in_best": round(float(y.mean()), 4)}
    box = best_box(x, y, binary)
    row["driver"] = _box_signal(sim, box, specs, evppi_by_parameter) if box else None
    observable = [j for j, spec in enumerate(specs) if spec.gaps]
    box = best_box(x[:, observable], y, [binary[j] for j in observable])
    row["signal"] = _box_signal(sim, box, [specs[j] for j in observable], evppi_by_parameter) if box else None
    if row["driver"] and not row["driver"]["gaps"]:
        row["driver_note"] = "El motor principal es una prioridad de CORNARE, no un dato faltante: se declara, no se espera."
    value_of_waiting = row["signal"]["value_of_information_pct"] if row["signal"] else None
    above = value_of_waiting is not None and value_of_waiting > DELAY_COST_SHARE
    exploratory = bool(row["signal"] and row["signal"]["evidence"] == "exploratory")
    row["value_of_waiting_pct"] = value_of_waiting
    # An exploratory signal is something to watch, never the basis of a reserve.
    row["keep_reserve"] = bool(above and not exploratory)
    row["watch_only"] = bool(above and exploratory)
    return row


def _site_gap(sim: Simulation, measure: dict, candidates: list[str], withheld: bool) -> str:
    affected = {gap["id"]: gap["affected_intervention_ids"] for gap in sim.dataset.gaps}
    if "marinilla" in candidates and withheld:
        return "gap-marinilla-coverage"
    if measure["id"] in affected.get("gap-ecosystem-service-sites", []):
        return "gap-ecosystem-service-sites"
    return "gap-sites"


def _replace_columns(base: TermMatrices, columns: dict[int, TermMatrices]) -> TermMatrices:
    fields = {}
    for name in TermMatrices.__dataclass_fields__:
        array = getattr(base, name).copy()
        for k, source in columns.items():
            array[:, k] = getattr(source, name)[:, k]
        fields[name] = array
    return TermMatrices(**fields)


def location_variants(sim: Simulation, s_star: int) -> dict:
    """Score s* with each non-corridor measure fixed to each municipality (≤ 3^5 variants)."""
    measures = sim.ctx.measures
    free = [k for k in np.flatnonzero(sim.space.members[s_star]) if measures[k]["scope"] != "corridor"]
    fixed = {
        (k, m): term_matrices(sim.ctx, sim.tables, sim.worlds.columns, sim.worlds.values, fixed_candidates={int(k): 1 << m})
        for k in free for m in range(len(MUNICIPALITY_IDS))
    }
    dim_penalty = sim.worlds.column("dim_penalty")
    combos = list(product(range(len(MUNICIPALITY_IDS)), repeat=len(free)))
    scores = np.zeros((sim.n_worlds, len(combos)), dtype=np.int64)
    for c, combo in enumerate(combos):
        terms = _replace_columns(sim.terms, {int(k): fixed[(k, m)] for k, m in zip(free, combo)})
        scores[:, c] = score_table(sim.ctx, sim.space, terms, dim_penalty, set_indices=np.array([s_star]))[:, 0]
    shares = {}
    for position, k in enumerate(free):
        # Best score reachable with k at each municipality, the other sites free.
        given = np.stack([
            scores[:, [c for c, combo in enumerate(combos) if combo[position] == m]].max(axis=1)
            for m in range(len(MUNICIPALITY_IDS))
        ], axis=1)
        top = given.max(axis=1, keepdims=True)
        winners = given == top
        unique = winners.sum(axis=1) == 1
        row = {MUNICIPALITY_IDS[m]: round(float((unique & winners[:, m]).mean()), 4) for m in range(len(MUNICIPALITY_IDS))}
        row["tie"] = round(float((~unique).mean()), 4)
        shares[measures[k]["id"]] = row
    return {"free_measures": [measures[k]["id"] for k in free], "variant_count": len(combos), "best_site_share": shares}


def pathways(sim: Simulation, s_star: int, robust: dict, voi: dict) -> dict:
    x, _, binary, specs = prim_inputs(sim)
    evppi_by_parameter = {row["parameter"]: row for row in voi["evppi"]}
    measures = sim.ctx.measures
    inclusion = robust["inclusion"]
    commit_now = [
        {"id": m["id"], "name": m["name"], "share_in_best": round(inclusion[m["id"]]["all"]["incl_best"], 4)}
        for m in measures if inclusion[m["id"]]["class"] == "core"
    ]
    on_signal = [
        _signal(sim, k, m, x, binary, specs, evppi_by_parameter)
        for k, m in enumerate(measures) if inclusion[m["id"]]["class"] == "contingent"
    ]
    world0_terms = sim.points["institucional"]["terms"]
    variants = location_variants(sim, s_star)
    site_later = []
    for k in np.flatnonzero(sim.space.members[s_star]):
        measure = measures[k]
        if measure["scope"] == "corridor":
            continue
        w0_pattern = int(world0_terms.candidates[0, k])
        w0_candidates = members_of(w0_pattern)
        changed = float((sim.terms.candidates[:, k] != w0_pattern).mean())
        site_share = variants["best_site_share"][measure["id"]]
        elsewhere = sum(share for m, share in site_share.items() if m != "tie" and m not in w0_candidates)
        tied = len(w0_candidates) > 1
        if not tied and changed < SITE_CHANGE_SHARE and elsewhere < SITE_CHANGE_SHARE:
            continue
        gap_id = _site_gap(sim, measure, w0_candidates, bool(world0_terms.withheld[0, k]))
        names = " o ".join(MUNICIPALITY_NAMES[m] for m in w0_candidates)
        site_later.append({
            "id": measure["id"],
            "name": measure["name"],
            "world0_candidates": w0_candidates,
            "tied_in_world0": tied,
            "placement_changes_share": round(changed, 4),
            "best_site_elsewhere_share": round(elsewhere, 4),
            "best_site_share": site_share,
            "resolving_gap": gap_id,
            "sentence": check(
                f"«{measure['name']}»: comprometer el monto ahora y confirmar el sitio cuando se cierre {gap_id}. "
                f"Hoy la regla la ubica en {names}; la regla cambia de municipio en {es_pct(changed)} de los mundos probados "
                f"y otro municipio puntúa más en {es_pct(elsewhere)}."
            ),
        })
    reserve = [row["id"] for row in on_signal if row.get("keep_reserve")]
    watch = [row["id"] for row in on_signal if row.get("watch_only")]
    return {
        "s_star": sim.space.ids_of(s_star),
        "commit_now": commit_now,
        "commit_on_signal": on_signal,
        "decide_site_later": site_later,
        "location_variants": variants,
        "reserve": {
            "delay_cost_share": DELAY_COST_SHARE,
            "delay_cost_evidence": "assumption",
            "keep_reserve_for": reserve,
            "decision": "reservar" if reserve else "gastar ahora",
            "watch_only": watch,
            "watch_note": "Señales exploratorias cuyo valor de información supera el costo de esperar. Se vigilan; no justifican reservar fondo.",
            "rule": "Se reserva fondo solo si el valor de esperar la información (EVPPI corregido del parámetro señal) "
                    f"supera el costo de esperar, un supuesto de {es_pct(DELAY_COST_SHARE)} del mejor puntaje medio.",
        },
        "note": "Ninguna medida queda en «comprometer ahora» si ninguna entra al mejor portafolio en 80% o más de los mundos probados."
        if not commit_now else None,
    }
