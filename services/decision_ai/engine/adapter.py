"""Tool name → engine function. The only module that imports `decision_engine.api`.

Every call returns the plan's envelope (§3.4):
{ result, evidence_labels, sources, warnings, fingerprint }.
A tool whose engine function is missing returns `engine_pending`, never a placeholder number.
"""

from __future__ import annotations

from typing import Any, Callable

from decision_engine.fingerprint import decision_fingerprint

from . import dataset

try:  # the engine landed on main; keep the pending path for partial checkouts
    from decision_engine import api as engine
except ImportError:  # pragma: no cover
    engine = None

# Mirror of MEASURE_LAYERS in frontend/src/cornare/map/focus.js. A test parses
# focus.js and fails if the two drift (until the mapping moves into catalog.json).
MEASURE_LAYERS: dict[str, list[str]] = {
    "bio_pa": ["protected_areas"],
    "bio_restore": ["protected_areas", "wetlands"],
    "bio_psa": ["protected_areas", "wetlands"],
    "water_eff": ["hydrography"],
    "water_riparian": ["rio_negro_riparian", "la_marinilla_zoning", "la_marinilla_ecosystem", "hydrography"],
    "water_head": ["hydrography", "protected_areas"],
    "food_agro": [],
    "food_soil": [],
    "hab_green": ["wetlands"],
    "hab_suds": ["hydrography"],
    "infra_resilient": ["mass_movement"],
    "infra_services": ["mass_movement"],
    "risk_sat": ["mass_movement", "hydrography", "flood"],
    "risk_knowledge": [],
    "health": [],
}

EXACT_LOCATION = "Por definir"

# Which registry entries back each tool's numbers.
ENGINE_SOURCES = ["reto-brief-2026", "hackathon-deck-2026"]
TOOL_SOURCES: dict[str, list[str]] = {
    "get_context": ENGINE_SOURCES,
    "search_portfolios": ENGINE_SOURCES,
    "explain": ENGINE_SOURCES,
    "compare_portfolios": ENGINE_SOURCES + ["lit-decision-robustness-2025"],
    "price_of_constraint": ENGINE_SOURCES + ["lit-decision-robustness-2025"],
    "run_robustness": ENGINE_SOURCES + ["lit-decision-robustness-2025"],
    "breaking_points": ENGINE_SOURCES + ["lit-decision-robustness-2025"],
    "value_of_information": ENGINE_SOURCES + ["lit-decision-robustness-2025"],
    "switching_value": ENGINE_SOURCES + ["lit-decision-robustness-2025"],
    "get_spatial_context": ["dane-mgn-2025"],
}


def envelope(result, evidence_labels=None, sources=None, warnings=None, fingerprint=None) -> dict:
    return {
        "result": result,
        "evidence_labels": evidence_labels or {},
        "sources": sources or [],
        "warnings": warnings or [],
        "fingerprint": fingerprint,
    }


def pending(name: str) -> dict:
    return envelope(None, warnings=[f"engine_pending:{name}"])


def get_spatial_context(intervention_id: str) -> dict:
    measures = dataset.interventions()
    if intervention_id not in measures:
        raise KeyError(intervention_id)
    catalog = dataset.map_catalog()
    provenance = dataset.map_provenance()
    known = {layer["id"]: layer for layer in catalog["layers"] + catalog.get("runtime", [])}
    layers = []
    for layer_id in MEASURE_LAYERS.get(intervention_id, []):
        layer = known[layer_id]
        source = provenance.get(layer["sourceId"], {})
        layers.append({
            "id": layer_id,
            "label": layer["label"],
            "source_id": layer["sourceId"],
            "limitation": layer.get("limitation") or source.get("limitation", ""),
        })
    gap_ids = ["gap-sites"] + [
        gap_id for gap_id, gap in dataset.gaps().items()
        if gap_id != "gap-sites" and gap.get("kind") == "site" and intervention_id in (gap.get("affected_intervention_ids") or [])
    ]
    measure = measures[intervention_id]
    result = {
        "intervention_id": intervention_id,
        "name": measure["name"],
        "scope": measure.get("scope"),
        "exact_location": EXACT_LOCATION,
        "layers": layers,
        "gaps": gap_ids,
        "note": "Las capas son contexto. Una geometría no es el sitio de intervención.",
    }
    labels = {"layers": "Dato institucional", "exact_location": "Información faltante"}
    sources = TOOL_SOURCES["get_spatial_context"] + [layer["source_id"] for layer in layers]
    return envelope(result, labels, sources, [], decision_fingerprint(result))


def _engine_call(name: str) -> Callable[..., dict] | None:
    return getattr(engine, name, None) if engine is not None else None


TOOL_NAMES = (
    "get_context", "search_portfolios", "explain", "compare_portfolios", "price_of_constraint",
    "run_robustness", "breaking_points", "value_of_information", "switching_value", "get_spatial_context",
)


def call(name: str, **kwargs: Any) -> dict:
    """Run one tool. Raises KeyError for an unknown tool or id; ValueError for bad parameters."""
    if name not in TOOL_NAMES:
        raise KeyError(name)
    known = dataset.interventions()
    for key, value in kwargs.items():
        ids = [value] if key == "intervention_id" else list(value or []) if key in ("force", "exclude", "a", "b", "portfolio") else []
        unknown = [item for item in ids if item not in known]
        if unknown:
            raise KeyError(f"unknown intervention ids: {unknown}")
    if name == "get_spatial_context":
        return get_spatial_context(**kwargs)
    function = _engine_call(name)
    if function is None:
        return pending(name)
    try:
        raw = function(**{key: value for key, value in kwargs.items() if value is not None})
    except (ImportError, FileNotFoundError):
        return pending(name)
    result = raw.get("result")
    fingerprint = raw.get("fingerprint")
    if result is not None and fingerprint is None:
        fingerprint = decision_fingerprint(result)
    return envelope(result, raw.get("evidence_labels"), TOOL_SOURCES[name], raw.get("warnings"), fingerprint)
