"""Evidence registry, information gaps and MEA rows."""

from __future__ import annotations

import json
from pathlib import Path

from institutional import INFORMATION_GAPS, INTERVENTIONS

ROOT = Path(__file__).resolve().parents[2]


def mea_indicators(history: dict) -> dict:
    indicators = []
    seen = set()
    for match in history["matches"]:
        for text in match["indicators"]:
            key = (match["intervention_id"], text)
            if key in seen:
                continue
            seen.add(key)
            indicators.append(
                {
                    "id": f"hist-{match['intervention_id']}-{len(indicators) + 1}",
                    "intervention_id": match["intervention_id"],
                    "name": text,
                    "indicator_type": "producto",
                    "unit": None,
                    "frequency": None,
                    "baseline": None,
                    "target": None,
                    "target_status": "META POR DEFINIR",
                    "sensitivity_signal": "Este indicador histórico mide actividad o producto. No demuestra menor sensibilidad.",
                    "adaptive_capacity_signal": "Puede informar gestión, pero no es una métrica de capacidad adaptativa del estudio de riesgo.",
                    "provenance": "institutional",
                    "source_id": "adaptacion-municipios",
                    "municipality_id": match["municipality_id"],
                    "match_provenance": "team_inference",
                }
            )
    for intervention in INTERVENTIONS:
        indicators.append(
            {
                "id": f"outcome-{intervention['id']}",
                "intervention_id": intervention["id"],
                "name": f"Resultado sobre sensibilidad y capacidad adaptativa: {intervention['name']}",
                "indicator_type": "resultado",
                "unit": None,
                "frequency": None,
                "baseline": None,
                "target": None,
                "target_status": "META POR DEFINIR",
                "sensitivity_signal": "Haría falta una variable de estado de la dimensión, medida antes y después, con la misma ficha de CORNARE.",
                "adaptive_capacity_signal": "Haría falta repetir el componente de capacidad adaptativa de esa dimensión. No se fija una meta numérica.",
                "provenance": "missing",
                "source_id": "mea-gap",
                "municipality_id": None,
                "match_provenance": "missing",
            }
        )
    return {
        "schema": "ourea.cornare.mea_indicators",
        "regional_context": {
            "statement": "El plan regional plantea disminuir 30% los indicadores de vulnerabilidad de cada regional a 2035.",
            "use": "Contexto institucional. No se reparte ese 30% entre las medidas del portafolio.",
            "provenance": "institutional",
            "source_id": "hackathon-deck-2026",
        },
        "indicators": indicators,
    }


def source_registry() -> dict:
    return {
        "schema": "ourea.cornare.source_registry",
        "accessed": "2026-10-07",
        "sources": [
            {
                "id": "reto-brief-2026",
                "title": "Climate Risk Hackathon for Cities. Reto propuesto por CORNARE",
                "institution": "CORNARE",
                "year": 2026,
                "url": None,
                "file": "CLIMATERISK/RETO CLIMATE WEEK HACKATHON.pdf",
                "level": 1,
                "kind": "official",
                "claim": "Pregunta del reto, corredor, fondo de 5.000 millones, catálogo, costos y hallazgos numéricos citados.",
                "accessed": "2026-10-07",
            },
            {
                "id": "hackathon-deck-2026",
                "title": "Riesgos climáticos en la jurisdicción de CORNARE",
                "institution": "CORNARE",
                "year": 2026,
                "url": None,
                "file": "CLIMATERISK/HACKATHON RETO CORNARE.pptx",
                "level": 1,
                "kind": "official",
                "claim": "Matriz de clases por municipio y dimensión, pesos 70/15/15, meta regional de 30% a 2035 y arquitectura del MEA.",
                "accessed": "2026-10-07",
            },
            {
                "id": "adaptacion-municipios",
                "title": "Reporte de medidas de adaptación por municipio",
                "institution": "CORNARE",
                "year": 2026,
                "url": None,
                "file": "CLIMATERISK/REPORTE MEDIDAS DE ADAPTACIÓN MUNICIPIOS.xlsx",
                "level": 1,
                "kind": "official",
                "claim": "Historial de medidas, planes, indicadores y montos. La columna Vulnerabilidad es un tipo de amenaza, no el índice.",
                "accessed": "2026-10-07",
            },
            {
                "id": "observatorio-cornare",
                "title": "Observatorio Ambiental de CORNARE, cambio climático",
                "institution": "CORNARE",
                "year": 2026,
                "url": "https://observatorioambiental.cornare.gov.co/crecimiento-verde-y-cambio-climatico/cambio-climatico/",
                "file": None,
                "level": 2,
                "kind": "official",
                "claim": "Fuente pública para consultar amenaza, vulnerabilidad y riesgo. No sustituye las cifras ya dadas en el reto.",
                "accessed": "2026-10-07",
            },
            {
                "id": "marco-cornare",
                "title": "MARCO, Monitoreo Ambiental Regional CORNARE",
                "institution": "CORNARE",
                "year": 2026,
                "url": "https://marco.cornare.gov.co/",
                "file": None,
                "level": 2,
                "kind": "official",
                "claim": "Contexto hidrometeorológico. El enlace está en el reto. La verificación SSL local falló; no se extrajeron series.",
                "accessed": "2026-10-07",
            },
            {
                "id": "dane-mgn-2025",
                "title": "Marco Geoestadístico Nacional 2025, capa Municipio",
                "institution": "DANE",
                "year": 2025,
                "url": "https://geoportal.dane.gov.co/mparcgis/rest/services/Divipola/Serv_DIVIPOLA_MGN_2025/FeatureServer/317",
                "file": "frontend/public/data/cornare/municipalities.geojson",
                "level": 3,
                "kind": "official",
                "claim": "Límites municipales de Guarne (05318), Marinilla (05440) y Rionegro (05615).",
                "accessed": "2026-10-07",
            },
            {
                "id": "iucn-nbs-2020",
                "title": "Global Standard for Nature-based Solutions",
                "institution": "IUCN",
                "year": 2020,
                "url": "https://doi.org/10.2305/IUCN.CH.2020.08.en",
                "file": None,
                "level": 4,
                "kind": "official",
                "claim": "Definición y criterios de soluciones basadas en la naturaleza. Se usa como tamiz conceptual, no como certificación de las medidas.",
                "accessed": "2026-10-07",
            },
            {
                "id": "ipcc-ar6-wg2",
                "title": "Climate Change 2022: Impacts, Adaptation and Vulnerability. Working Group II",
                "institution": "IPCC",
                "year": 2022,
                "url": "https://www.ipcc.ch/report/ar6/wg2/",
                "file": None,
                "level": 4,
                "kind": "peer-reviewed",
                "claim": "La adaptación basada en ecosistemas y las decisiones bajo incertidumbre se evalúan con escenarios. No se importan porcentajes de efectividad.",
                "accessed": "2026-10-07",
            },
        ],
    }


def write_evidence(history: dict, directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    gaps = {
        "schema": "ourea.cornare.information_gaps",
        "gaps": INFORMATION_GAPS,
    }
    (directory / "information_gaps.json").write_text(
        json.dumps(gaps, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (directory / "mea_indicators.json").write_text(
        json.dumps(mea_indicators(history), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    registry = source_registry()
    (directory / "source_registry.json").write_text(
        json.dumps(registry, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    lines = [
        "# Registro de fuentes",
        "",
        "Acceso: 2026-10-07. Una fuente externa no reemplaza un valor ya entregado por CORNARE.",
        "",
    ]
    for source in registry["sources"]:
        lines.extend(
            [
                f"## {source['title']}",
                "",
                f"- Institución: {source['institution']}",
                f"- Año: {source['year']}",
                f"- Nivel: {source['level']}",
                f"- Tipo: {source['kind']}",
                f"- URL o archivo: {source['url'] or source['file']}",
                f"- Respalda: {source['claim']}",
                "",
            ]
        )
    lines.extend(
        [
            "## Fuentes no usadas como evidencia",
            "",
            "La monografía de RAND sobre robust decision making respondió 403 al intentar abrirla. No se cita.",
            "Los libros de emisiones y mitigación se describen en la auditoría de datos y no entran al puntaje de adaptación.",
            "",
        ]
    )
    docs = ROOT / "docs" / "climaterisk"
    docs.mkdir(parents=True, exist_ok=True)
    (docs / "source_registry.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    from build_adaptation_history import build_history

    write_evidence(build_history(), ROOT / "frontend" / "public" / "data" / "cornare")
    print("Wrote evidence registry, gaps and MEA indicators")
