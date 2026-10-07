"""Build the derived CORNARE datasets consumed by the frontend."""

from __future__ import annotations

import json
import urllib.request
from pathlib import Path

from shapely.geometry import mapping, shape

from audit_sources import write_audit
from build_adaptation_history import build_history
from build_evidence_registry import write_evidence
from build_intervention_catalog import catalogue_payload
from institutional import (
    CLASS_LABELS,
    DECISION_PARAMETERS,
    DIMENSIONS,
    MUNICIPALITIES,
    NUMERIC_FINDINGS,
    VULNERABILITY_CLASS,
)

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "public" / "data" / "cornare"
DANE_QUERY = (
    "https://geoportal.dane.gov.co/mparcgis/rest/services/Divipola/"
    "Serv_DIVIPOLA_MGN_2025/FeatureServer/317/query"
    "?where=MPIO_CDPMP+IN+('05318','05440','05615')"
    "&outFields=DPTO_CCDGO,MPIO_CCDGO,MPIO_CDPMP,MPIO_CNMBRE,DPTO_CNMBRE,MPIO_NANO"
    "&returnGeometry=true&outSR=4326&f=geojson"
)
SIMPLIFY_DEGREES = 0.0015
DIVIPOLA_TO_ID = {item["divipola"]: item["id"] for item in MUNICIPALITIES}


def dimension_metrics() -> dict:
    metrics = []
    for municipality_id, classes in VULNERABILITY_CLASS.items():
        for dimension_id, classification in classes.items():
            metrics.append(
                {
                    "id": f"class-{municipality_id}-{dimension_id}",
                    "municipality_id": municipality_id,
                    "dimension_id": dimension_id,
                    "metric": "vulnerability",
                    "scenario": "reference",
                    "year": None,
                    "value": None,
                    "value_min": None,
                    "value_max": None,
                    "classification": classification,
                    "classification_label": CLASS_LABELS[classification],
                    "provenance": "team_inference",
                    "source_id": "hackathon-deck-2026",
                    "note": "Clase leída en la diapositiva 12. Se interpreta como vulnerabilidad de la dimensión porque coincide con las clases del reto en biodiversidad y no coincide con el riesgo Bajo/Medio de Rionegro.",
                }
            )
    for finding in NUMERIC_FINDINGS:
        metrics.append(
            {
                **finding,
                "classification_label": finding.get("classification_label") or (
                    CLASS_LABELS.get(finding["classification"]) if finding["classification"] else None
                ),
                "geography": finding.get("geography", "municipality" if finding["municipality_id"] else "regional"),
            }
        )
    return {
        "schema": "ourea.cornare.dimension_metrics",
        "scale_note": "Los valores numéricos están en la escala del estudio de CORNARE, aproximadamente 0 a 1. La ausencia de valor no es cero.",
        "class_labels": CLASS_LABELS,
        "dimensions": DIMENSIONS,
        "metrics": metrics,
    }


def municipality_profiles() -> dict:
    return {
        "schema": "ourea.cornare.municipality_profiles",
        "region": "Valles de San Nicolás",
        "authority": "CORNARE",
        "department": "Antioquia",
        "country": "Colombia",
        "municipalities": MUNICIPALITIES,
    }


def boundaries() -> dict:
    request = urllib.request.Request(DANE_QUERY, headers={"User-Agent": "ourea-cornare-prototype"})
    with urllib.request.urlopen(request, timeout=90) as response:
        payload = json.loads(response.read().decode("utf-8"))
    features = []
    for feature in payload.get("features", []):
        geometry = feature.get("geometry")
        properties = feature.get("properties") or {}
        divipola = str(properties.get("MPIO_CDPMP") or "")
        municipality_id = DIVIPOLA_TO_ID.get(divipola)
        if geometry is None or municipality_id is None:
            continue
        simplified = shape(geometry).simplify(SIMPLIFY_DEGREES, preserve_topology=True)
        profile = next(item for item in MUNICIPALITIES if item["id"] == municipality_id)
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": municipality_id,
                    "name": profile["name"],
                    "divipola": divipola,
                    "source_name": properties.get("MPIO_CNMBRE"),
                    "department": properties.get("DPTO_CNMBRE"),
                    "mgn_year": properties.get("MPIO_NANO"),
                    "simplify_degrees": SIMPLIFY_DEGREES,
                    "provenance": "institutional",
                    "source_id": "dane-mgn-2025",
                },
                "geometry": mapping(simplified),
            }
        )
    if len(features) != 3:
        raise SystemExit(f"Expected 3 municipality polygons, received {len(features)}")
    return {
        "type": "FeatureCollection",
        "name": "cornare-decision-corridor",
        "source": {
            "id": "dane-mgn-2025",
            "title": "DANE Marco Geoestadístico Nacional 2025, capa Municipio",
            "url": DANE_QUERY,
            "accessed": "2026-10-07",
            "simplify_degrees": SIMPLIFY_DEGREES,
            "note": "Geometría oficial simplificada para el mapa del prototipo. No se fabricaron límites.",
        },
        "features": features,
    }


def write_json(name: str, payload) -> None:
    (OUT / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    write_audit()
    history = build_history()
    write_json("adaptation_history.json", history)
    write_json("interventions.json", catalogue_payload())
    write_json("dimension_metrics.json", dimension_metrics())
    write_json("scenario_metrics.json", {
        "schema": "ourea.cornare.scenario_metrics",
        "note": "Solo se incluye el cambio de escenario que el reto cuantifica. El resto no se simula.",
        "metrics": [item for item in dimension_metrics()["metrics"] if item.get("scenario") == "ssp3_7_0"],
    })
    write_json("municipality_profiles.json", municipality_profiles())
    write_json("decision_model.json", {
        "schema": "ourea.cornare.decision_model",
        **DECISION_PARAMETERS,
        "excluded_from_score": [
            "emissions_by_scope",
            "emission_reductions",
            "mitigation_measures",
            "production_unit_indicators",
            "sector_adaptation_actions_without_municipality",
        ],
    })
    write_evidence(history, OUT)
    write_json("municipalities.geojson", boundaries())
    print(f"Wrote CORNARE datasets in {OUT}")


if __name__ == "__main__":
    main()
