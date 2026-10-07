"""python -m decision_engine.build [--check] [--out DIR]

Runs the simulation and writes the precomputed JSON the UI reads from
frontend/public/data/cornare/. With --check it builds into a temp folder and
fails if the committed files differ (same pattern as the manifest check).
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
import time
from functools import lru_cache
from pathlib import Path

import numpy as np

from .breaking_points import breaking_points
from .dataset import DATA, load_dataset
from .levers import lever_payload
from .pathways import pathways
from .robustness import robustness
from .simulation import Simulation, simulate
from .uncertainty import EVIDENCE_LABELS, N_WORLDS, SEED, ranges_payload
from .voi import value_of_information

OUTPUTS = (
    "uncertainty_ranges.json",
    "lever_profiles.json",
    "robustness.json",
    "breaking_points.json",
    "value_of_information.json",
)

WORDING = [
    "Se dice «casi óptimo en X% de los N mundos probados». Nunca «probabilidad».",
    "Los parámetros exploratorios no se reportan como hallazgos: solo aparecen en puntos de quiebre y señales, rotulados.",
    "El puntaje es un puntaje de prioridad. No hay «% de vulnerabilidad reducida» ni pérdidas evitadas.",
    "«Sin desagregar» es información faltante, nunca «baja».",
]

FIELD_EVIDENCE = {
    "robustness.json": {
        "worlds": "assumption",
        "worlds.eff": "exploratory",
        "worlds.ssp_shift": "exploratory",
        "acceptability.near": "team_inference",
        "acceptability.rank1": "team_inference",
        "inclusion": "team_inference",
        "pathways.signal": "exploratory",
        "pathways.reserve.delay_cost_share": "assumption",
    },
    "breaking_points.json": {
        "decision_residual_risk": "team_inference",
        "decision_residual_risk.boxes": "exploratory",
        "residual_vulnerability": "institutional",
    },
    "value_of_information.json": {
        "switching": "team_inference",
        "world0_rejected_gaps": "team_inference",
        "evppi": "exploratory",
        "gaps.affected_intervention_ids": "team_inference",
    },
    "lever_profiles.json": {
        "cells.sensitivity": "institutional",
        "cells.adaptive_capacity": "institutional",
        "cells.profile": "team_inference",
        "measures.lever": "team_inference",
    },
    "uncertainty_ranges.json": {"parameters": "assumption"},
}


def _clean(value):
    """JSON-safe, floats rounded to 6 decimals so outputs are stable across platforms."""
    if isinstance(value, dict):
        return {str(key): _clean(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_clean(item) for item in value]
    if isinstance(value, (np.bool_, bool)):
        return bool(value)
    if isinstance(value, (np.integer, int)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        number = float(value)
        if number != number or number in (float("inf"), float("-inf")):
            return None
        rounded = round(number, 6)
        return 0.0 if rounded == 0 else rounded
    if isinstance(value, np.ndarray):
        return _clean(value.tolist())
    return value


def envelope(sim: Simulation, schema: str, name: str, body: dict) -> dict:
    return {
        "schema": schema,
        "seed": sim.worlds.seed,
        "n_worlds": sim.n_worlds,
        "fingerprint": sim.fingerprint,
        "numpy": np.__version__,
        "evidence_labels": EVIDENCE_LABELS,
        "field_evidence": FIELD_EVIDENCE[name],
        "wording_rules": WORDING,
        **body,
    }


def compute(sim: Simulation) -> dict[str, dict]:
    robust = robustness(sim)
    s_star = robust["s_star_index"]
    breaks = breaking_points(sim, s_star)
    voi = value_of_information(sim, s_star)
    path = pathways(sim, s_star, robust, voi)
    robust_body = {key: value for key, value in robust.items() if key != "s_star_index"}
    return {
        "uncertainty_ranges.json": {**ranges_payload(sim.dataset), "fingerprint": sim.fingerprint, "numpy": np.__version__},
        "lever_profiles.json": envelope(sim, "ourea.cornare.lever_profiles", "lever_profiles.json",
                                        {k: v for k, v in lever_payload(sim.dataset, sim.terms.lever_fit).items() if k != "schema"}),
        "robustness.json": envelope(sim, "ourea.cornare.robustness", "robustness.json", {**robust_body, "pathways": path}),
        "breaking_points.json": envelope(sim, "ourea.cornare.breaking_points", "breaking_points.json", breaks),
        "value_of_information.json": envelope(sim, "ourea.cornare.value_of_information", "value_of_information.json", voi),
    }


@lru_cache(maxsize=2)
def compute_cached(n_worlds: int = N_WORLDS, seed: int = SEED) -> dict[str, dict]:
    return {name: _clean(payload) for name, payload in compute(simulate(load_dataset(), n_worlds, seed)).items()}


def write(payloads: dict[str, dict], directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for name, payload in payloads.items():
        text = json.dumps(_clean(payload), ensure_ascii=False, indent=2) + "\n"
        (directory / name).write_text(text, encoding="utf-8", newline="\n")


def _normalized(path: Path) -> bytes | None:
    return path.read_bytes().replace(b"\r\n", b"\n") if path.exists() else None


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="fail if the committed JSON differs from a fresh build")
    parser.add_argument("--out", type=Path, default=DATA)
    parser.add_argument("--n-worlds", type=int, default=N_WORLDS)
    parser.add_argument("--seed", type=int, default=SEED)
    args = parser.parse_args(argv)
    started = time.perf_counter()
    payloads = compute(simulate(load_dataset(), args.n_worlds, args.seed))
    if args.check:
        with tempfile.TemporaryDirectory() as temp:
            write(payloads, Path(temp))
            stale = [name for name in OUTPUTS if _normalized(Path(temp) / name) != _normalized(args.out / name)]
        if stale:
            print("Engine outputs are stale: " + ", ".join(stale), file=sys.stderr)
            print("Run: python -m decision_engine.build", file=sys.stderr)
            return 1
        print(f"Engine outputs match a fresh build ({time.perf_counter() - started:.1f} s)")
        return 0
    write(payloads, args.out)
    sizes = {name: (args.out / name).stat().st_size for name in OUTPUTS}
    print(f"Wrote {len(OUTPUTS)} files, {sum(sizes.values()) / 1024:.0f} KB, in {time.perf_counter() - started:.1f} s")
    for name, size in sizes.items():
        print(f"  {name}: {size / 1024:.1f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
