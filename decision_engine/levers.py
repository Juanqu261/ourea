"""Step 1: diagnose the lever (lower sensitivity S or raise adaptive capacity CA).

A mismatch needs both S and CA known in a cell. Partial and unknown profiles
always give lever_fit = 1, so missing data never penalizes a measure.
"""

from __future__ import annotations

from .dataset import MUNICIPALITY_IDS, Dataset
from .uncertainty import DIMENSION_NAMES, MUNICIPALITY_NAMES

PROFILE_LABELS = {
    "reduce_s": "Expuesto pero organizado: reducir sensibilidad",
    "raise_ca": "Poco expuesto y poco preparado: fortalecer capacidad adaptativa",
    "both": "Expuesto y poco preparado: ambas palancas",
    "no_lever": "Sin palanca dominante",
    "partial": "Parcial: solo se publicó S o CA",
    "unknown": "Sin desagregar (información faltante)",
}

# Which single lever a full profile asks for. "both" accepts any measure.
NEEDED_LEVER = {"reduce_s": "S", "raise_ca": "CA", "both": None, "no_lever": None}


def full_profile(sensitivity_level: str, capacity_level: str) -> str:
    high_s = sensitivity_level in {"alta", "muy_alta"}
    adequate_ca = capacity_level in {"adecuada", "alta"}
    if high_s and adequate_ca:
        return "reduce_s"
    if high_s:
        return "both"
    if not adequate_ca:
        return "raise_ca"
    return "no_lever"


def cell_profiles(dataset: Dataset) -> dict[tuple[str, str], dict]:
    """The 21 municipality × dimension cells with their S/CA readings and profile."""
    readings = {(row["municipality_id"], row["dimension_id"]): row for row in dataset.lever_readings}
    cells = {}
    for municipality_id in MUNICIPALITY_IDS:
        for dimension_id in dataset.dimension_ids:
            row = readings.get((municipality_id, dimension_id))
            sensitivity = row["sensitivity"] if row else None
            capacity = row["adaptive_capacity"] if row else None
            s_level = sensitivity["level"] if sensitivity else None
            ca_level = capacity["level"] if capacity else None
            if s_level and ca_level:
                profile = full_profile(s_level, ca_level)
                provenance = "team_inference"
            elif sensitivity or capacity:
                profile = "partial"
                provenance = "missing"
            else:
                profile = "unknown"
                provenance = "missing"
            cells[(municipality_id, dimension_id)] = {
                "municipality_id": municipality_id,
                "dimension_id": dimension_id,
                "sensitivity": sensitivity,
                "adaptive_capacity": capacity,
                "profile": profile,
                "profile_label": PROFILE_LABELS[profile],
                "needed_lever": NEEDED_LEVER.get(profile),
                "provenance": provenance,
            }
    return cells


def mismatches(lever: str, cell: dict) -> bool:
    needed = cell["needed_lever"]
    return needed is not None and lever != "S+CA" and lever != needed


def lever_mismatch(measure: dict, candidate_ids, cells: dict) -> bool:
    """True only if every candidate municipality has a full profile and all of them mismatch.

    Partial and unknown profiles have no needed lever, so they never mismatch.
    """
    return all(
        mismatches(measure["lever"], cells[(municipality_id, measure["dimension_id"])])
        for municipality_id in candidate_ids
    )


def lever_payload(dataset: Dataset, lever_fit=None) -> dict:
    """lever_profiles.json: the 21-cell grid, measure tags and where lever_fit can bite.

    `lever_fit` is the (W, K) matrix from the simulation, used to report how often it is below 1.
    """
    cells = cell_profiles(dataset)
    full = [cell for cell in cells.values() if cell["profile"] not in {"partial", "unknown"}]
    measures = []
    for k, measure in enumerate(dataset.interventions):
        row = {
            "id": measure["id"],
            "dimension_id": measure["dimension_id"],
            "lever": measure["lever"],
            "provenance": measure.get("lever_provenance", "team_inference"),
            "mismatch_cells": [
                f"{cell['municipality_id']}|{cell['dimension_id']}" for cell in full
                if cell["dimension_id"] == measure["dimension_id"] and mismatches(measure["lever"], cell)
            ],
        }
        if lever_fit is not None:
            row["worlds_penalized_share"] = round(float((lever_fit[:, k] < 1.0).mean()), 4)
        measures.append(row)
    readings = [{**cell, "key": f"{cell['municipality_id']}|{cell['dimension_id']}"} for cell in cells.values()]
    return {
        "schema": "ourea.cornare.lever_profiles",
        "profile_labels": PROFILE_LABELS,
        "cells": readings,
        "measures": measures,
        "counts": {
            "cells": len(readings),
            "full": len(full),
            "partial": sum(cell["profile"] == "partial" for cell in readings),
            "unknown": sum(cell["profile"] == "unknown" for cell in readings),
        },
        "rule": "Un desajuste exige conocer S y CA en la celda. Con perfil parcial o sin desagregar, lever_fit = 1: el dato faltante no penaliza.",
        "finding": (
            f"Con este paquete solo {len(full)} de {len(readings)} celdas municipio × dimensión "
            f"{'tiene' if len(full) == 1 else 'tienen'} S y CA publicados. "
            "La pregunta del reto (¿reducir sensibilidad o fortalecer capacidad adaptativa?) se puede responder para "
            + ", ".join(
                f"{DIMENSION_NAMES[cell['dimension_id']]} en {MUNICIPALITY_NAMES[cell['municipality_id']]} ({cell['profile_label'].lower()})"
                for cell in full
            )
            + ". El resto queda sin desagregar (gap-ssp-cube)."
        ),
    }
