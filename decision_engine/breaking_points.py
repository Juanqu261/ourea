"""B. Breaking points: where s* stops being near-best, found with PRIM (numpy, deterministic).

Two kinds of residual are kept apart: the decision's residual risk (worlds where
s* fails) and the residual vulnerability that already exists (Alta / Muy alta
cells in dimensions s* does not touch).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .dataset import CLASS_ORDER, MUNICIPALITY_IDS
from .simulation import Simulation
from .uncertainty import (
    EVIDENCE_LABELS,
    FAILURE_REGRET,
    FAILURE_REGRET_ALT,
    MUNICIPALITY_NAMES,
    PRIM_ALPHA,
    PRIM_MAX_BOXES,
    PRIM_MAX_RESTRICTED,
    PRIM_MIN_SUPPORT,
    DIMENSION_NAMES,
    parameters,
)
from .wording import check, es_num, es_pct

PRUNE_TOLERANCE = 0.01   # drop a restriction if removing it lowers density by less than 1 point

@dataclass
class Box:
    # column → (low, high). Continuous: low < x < high, None = unbounded. Binary: low == high == kept value.
    limits: dict[int, tuple[float | None, float | None]]
    order: list[int]                          # columns in the order they were first restricted
    support: float
    coverage: float
    density: float
    mask: np.ndarray


def _peel_candidates(x: np.ndarray, mask: np.ndarray, binary: list[bool], alpha: float, min_count: int):
    """Yield (column, side, threshold, kept mask) for each allowed peel."""
    for j in range(x.shape[1]):
        column = x[mask, j]
        if binary[j]:
            values = np.unique(column)
            if len(values) < 2:
                continue
            for value in values:
                yield j, "drop", float(value), mask & (x[:, j] != value)
            continue
        low_q = float(np.quantile(column, alpha, method="lower"))
        high_q = float(np.quantile(column, 1 - alpha, method="higher"))
        for side, threshold, keep in (("low", low_q, mask & (x[:, j] > low_q)), ("high", high_q, mask & (x[:, j] < high_q))):
            if min_count <= keep.sum() < mask.sum():
                yield j, side, threshold, keep


def prim(x: np.ndarray, y: np.ndarray, binary: list[bool], alpha: float = PRIM_ALPHA,
         min_support: float = PRIM_MIN_SUPPORT, total_positive: float | None = None, n_total: int | None = None) -> list[Box]:
    """Peeling trajectory (Friedman & Fisher's original objective).

    Each step takes the peel with the largest gain in box mean per removed world,
    so a binary split that drops most worlds at once does not win by default.
    Ties go to the peel that keeps more worlds, then to the earlier column.
    """
    n = len(y) if n_total is None else n_total
    positives = y.sum() if total_positive is None else total_positive
    min_count = int(np.ceil(min_support * n))
    mask = np.ones(len(y), dtype=bool)
    limits: dict[int, tuple[float | None, float | None]] = {}
    order: list[int] = []
    trajectory = [_box(y, mask, limits, order, n, positives)]
    while True:
        current = y[mask].mean()
        size = int(mask.sum())
        best = None
        for j, side, threshold, keep in _peel_candidates(x, mask, binary, alpha, min_count):
            kept = int(keep.sum())
            gain = (y[keep].mean() - current) / (size - kept)
            score = (gain, kept)
            if best is None or score > best[0]:
                best = (score, j, side, threshold, keep)
        if best is None or best[0][0] <= 0:
            break
        _, j, side, threshold, mask = best
        low, high = limits.get(j, (None, None))
        if side == "low":
            low = threshold
        elif side == "high":
            high = threshold
        else:
            kept = float(np.unique(x[mask, j])[0])
            low = high = kept
        limits = {**limits, j: (low, high)}
        if j not in order:
            order = [*order, j]
        trajectory.append(_box(y, mask, limits, order, n, positives))
    return trajectory


def _box(y, mask, limits, order, n, positives) -> Box:
    return Box(
        limits=dict(limits),
        order=list(order),
        support=float(mask.sum() / n),
        coverage=float(y[mask].sum() / positives) if positives else 0.0,
        density=float(y[mask].mean()) if mask.any() else 0.0,
        mask=mask.copy(),
    )


def pick_box(trajectory: list[Box], max_restricted: int = PRIM_MAX_RESTRICTED) -> Box | None:
    eligible = [box for box in trajectory[1:] if 0 < len(box.order) <= max_restricted]
    if not eligible:
        return None
    return max(eligible, key=lambda box: (box.density, box.coverage))


def mask_from(x: np.ndarray, limits: dict) -> np.ndarray:
    mask = np.ones(x.shape[0], dtype=bool)
    for j, (low, high) in limits.items():
        if low is not None and low == high:
            mask &= x[:, j] == low
            continue
        if low is not None:
            mask &= x[:, j] > low
        if high is not None:
            mask &= x[:, j] < high
    return mask


def prune(box: Box, x: np.ndarray, y: np.ndarray, n: int, positives: float, tolerance: float = PRUNE_TOLERANCE) -> Box:
    """Drop restrictions that barely matter: removing one keeps density within `tolerance`. Last-added first."""
    limits = dict(box.limits)
    order = list(box.order)
    for j in reversed(box.order):
        if len(order) == 1:
            break
        trial = {key: value for key, value in limits.items() if key != j}
        mask = mask_from(x, trial)
        if y[mask].mean() >= box.density - tolerance:
            limits = trial
            order.remove(j)
    return _box(y, mask_from(x, limits), limits, order, n, positives)


def best_box(x: np.ndarray, y: np.ndarray, binary: list[bool], n_total: int | None = None,
             total_positive: float | None = None) -> Box | None:
    n = len(y) if n_total is None else n_total
    positives = y.sum() if total_positive is None else total_positive
    box = pick_box(prim(x, y, binary, total_positive=positives, n_total=n))
    return None if box is None else prune(box, x, y, n, positives)


def find_boxes(x: np.ndarray, y: np.ndarray, binary: list[bool], max_boxes: int = PRIM_MAX_BOXES) -> list[Box]:
    """PRIM with covering: after each box, drop its worlds and search again."""
    boxes = []
    remaining = np.ones(len(y), dtype=bool)
    positives = y.sum()
    for _ in range(max_boxes):
        if y[remaining].sum() < max(1, 0.05 * positives):
            break
        index = np.flatnonzero(remaining)
        box = best_box(x[index], y[index], binary, n_total=len(y), total_positive=positives)
        if box is None or box.density <= y[remaining].mean():
            break
        full_mask = np.zeros(len(y), dtype=bool)
        full_mask[index[box.mask]] = True
        box.mask = full_mask
        boxes.append(box)
        remaining &= ~full_mask
    return boxes


def prim_inputs(sim: Simulation) -> tuple[np.ndarray, list[str], list[bool], list]:
    """The world matrix without the fixed SSP cell, which duplicates `scenario`."""
    specs = parameters(sim.dataset)
    keep = [j for j, spec in enumerate(specs) if spec.sampling != "fixed_ssp"]
    return sim.worlds.values[:, keep], [specs[j].name for j in keep], [specs[j].binary for j in keep], [specs[j] for j in keep]


def condition(spec, low: float | None, high: float | None) -> str:
    if spec.binary:
        value = round(high)
        if spec.name == "scenario":
            return "bajo SSP3-7.0" if value == 1 else "en el escenario de referencia"
        if spec.name == "dim_emphasis":
            return "con énfasis regional en biodiversidad y agua" if value == 1 else "sin énfasis regional en biodiversidad y agua"
        return spec.phrase if value == 1 else spec.phrase.replace(" sube una clase", " no sube de clase")
    if low is not None and high is not None:
        return f"{spec.phrase} está entre {es_num(low)} y {es_num(high)}"
    if high is not None:
        return f"{spec.phrase} es menor que {es_num(high)}"
    return f"{spec.phrase} es mayor que {es_num(low)}"


def describe_box(box: Box, specs, subject: str, verb: str) -> dict:
    conditions = []
    gaps: list[str] = []
    exploratory = False
    for j in box.order:
        spec = specs[j]
        low, high = box.limits[j]
        conditions.append({
            "parameter": spec.name,
            "low": None if low is None else round(low, 4),
            "high": None if high is None else round(high, 4),
            "text": condition(spec, low, high),
            "evidence": spec.evidence,
            "evidence_label": EVIDENCE_LABELS[spec.evidence],
            "gaps": spec.gaps,
            "watch": spec.watch,
        })
        gaps.extend(g for g in spec.gaps if g not in gaps)
        exploratory |= spec.evidence == "exploratory"
    joined = " y ".join(item["text"] for item in conditions)
    sentence = f"{subject} {verb} cuando {joined}"
    if gaps:
        sentence += f" ({', '.join(gaps)})"
    sentence += f". Cubre {es_pct(box.coverage)} de esos mundos; dentro de la caja ocurre en {es_pct(box.density)}."
    if exploratory:
        sentence += " Incluye parámetros exploratorios: es una señal a vigilar, no un hallazgo."
    return {
        "conditions": conditions,
        "coverage": round(box.coverage, 4),
        "density": round(box.density, 4),
        "support": round(box.support, 4),
        "gaps": gaps,
        "exploratory": exploratory,
        "sentence": check(sentence),
    }


def residual_vulnerability(sim: Simulation, s_star: int) -> list[dict]:
    """Alta / Muy alta cells in dimensions with no measure of s*. Already there; not a decision risk."""
    measures = {measure["id"]: measure for measure in sim.ctx.measures}
    covered = {measures[k]["dimension_id"] for k in sim.space.ids_of(s_star)}
    rows = []
    for dimension_id in sim.ctx.dimension_ids:
        if dimension_id in covered:
            continue
        for municipality_id in MUNICIPALITY_IDS:
            index = sim.ctx.base_class[(municipality_id, dimension_id)]
            if index >= 4:
                rows.append({
                    "municipality_id": municipality_id,
                    "dimension_id": dimension_id,
                    "classification": CLASS_ORDER[index - 1],
                    "text": f"{DIMENSION_NAMES[dimension_id].capitalize()} en {MUNICIPALITY_NAMES[municipality_id]} "
                            f"(clase {CLASS_ORDER[index - 1].replace('_', ' ')}) queda sin medida en s*.",
                })
    return rows


def breaking_points(sim: Simulation, s_star: int, regret_threshold: float = FAILURE_REGRET) -> dict:
    x, names, binary, specs = prim_inputs(sim)
    regret = sim.regret[:, s_star]
    results = {}
    for threshold in sorted({regret_threshold, FAILURE_REGRET_ALT}, reverse=True):
        y = (regret > threshold + 1e-12).astype(float)
        boxes = find_boxes(x, y, binary)
        results[f"regret_{round(threshold * 100)}"] = {
            "threshold": threshold,
            "failure_share": round(float(y.mean()), 4),
            "failure_share_by_scenario": {
                "reference": round(float(y[~sim.scenario].mean()), 4),
                "ssp3_7_0": round(float(y[sim.scenario].mean()), 4),
            },
            "boxes": [
                describe_box(box, specs, "s* deja de ser casi óptima",
                             f"(arrepentimiento > {es_pct(threshold)})")
                for box in boxes
            ],
        }
    return {
        "s_star": sim.space.ids_of(s_star),
        "primary": f"regret_{round(regret_threshold * 100)}",
        "decision_residual_risk": results,
        "residual_vulnerability": residual_vulnerability(sim, s_star),
        "method": {
            "algorithm": "PRIM (peeling)",
            "alpha": PRIM_ALPHA,
            "min_support": PRIM_MIN_SUPPORT,
            "max_restricted": PRIM_MAX_RESTRICTED,
            "max_boxes": PRIM_MAX_BOXES,
            "box_rule": "En la trayectoria, la caja de mayor densidad que restringe como máximo 3 parámetros.",
        },
    }
