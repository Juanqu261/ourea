"""Parse the municipal adaptation workbook into corridor history."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from institutional import MUNICIPALITIES
from match_measures import fold, match_intervention

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "CLIMATERISK" / "REPORTE MEDIDAS DE ADAPTACIÓN MUNICIPIOS.xlsx"
MUNICIPALITY_BY_FOLD = {fold(item["name"]): item["id"] for item in MUNICIPALITIES}


def _number(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    return float(value)


def load_adaptation_frame(path: Path = SOURCE) -> pd.DataFrame:
    frame = pd.read_excel(path)
    expected = [
        "Municipio",
        "Subregion",
        "Vigencia",
        "Plan",
        "Linea",
        "Medida",
        "Indicador",
        "Ecosistema",
        "Vulnerabilidad",
        "Valor Inversion",
    ]
    missing = [column for column in expected if column not in frame.columns]
    if missing:
        raise SystemExit(f"Adaptation workbook is missing columns: {missing}")
    return frame


def build_history(path: Path = SOURCE) -> dict:
    frame = load_adaptation_frame(path)
    records = []
    for index, row in frame.iterrows():
        municipality_name = "" if pd.isna(row["Municipio"]) else str(row["Municipio"]).strip()
        municipality_id = MUNICIPALITY_BY_FOLD.get(fold(municipality_name))
        measure = "" if pd.isna(row["Medida"]) else str(row["Medida"]).strip()
        records.append(
            {
                "source_row": int(index) + 2,
                "municipality_name": municipality_name,
                "municipality_id": municipality_id,
                "in_decision_scope": municipality_id is not None,
                "subregion": None if pd.isna(row["Subregion"]) else str(row["Subregion"]),
                "year": None if pd.isna(row["Vigencia"]) else int(row["Vigencia"]),
                "plan": None if pd.isna(row["Plan"]) else str(row["Plan"]),
                "line": None if pd.isna(row["Linea"]) else str(row["Linea"]),
                "measure": measure,
                "indicator": None if pd.isna(row["Indicador"]) else str(row["Indicador"]),
                "ecosystem": None if pd.isna(row["Ecosistema"]) else str(row["Ecosistema"]),
                "hazard_label": None if pd.isna(row["Vulnerabilidad"]) else str(row["Vulnerabilidad"]),
                "investment_cop": _number(row["Valor Inversion"]),
                "matched_intervention_id": match_intervention(measure) if municipality_id else None,
            }
        )

    scoped = [record for record in records if record["in_decision_scope"]]
    coverage = []
    for municipality in MUNICIPALITIES:
        subset = [record for record in scoped if record["municipality_id"] == municipality["id"]]
        investments = [record["investment_cop"] for record in subset if record["investment_cop"] is not None]
        coverage.append(
            {
                "municipality_id": municipality["id"],
                "records": len(subset),
                "investment_cop_sum": sum(investments) if investments else None,
                "null_investment_rows": sum(record["investment_cop"] is None for record in subset),
                "hazard_label_counts": _counts(record["hazard_label"] for record in subset),
                "note": (
                    "Pocos registros no significan poca adaptación. La recurrencia no se califica como cero."
                    if len(subset) < 5
                    else "Cobertura suficiente para leer recurrencia documentada, no para afirmar que no hay más acciones."
                ),
            }
        )

    matches = []
    for municipality in MUNICIPALITIES:
        for intervention_id in sorted({record["matched_intervention_id"] for record in scoped if record["matched_intervention_id"]}):
            subset = [
                record
                for record in scoped
                if record["municipality_id"] == municipality["id"]
                and record["matched_intervention_id"] == intervention_id
            ]
            if not subset:
                continue
            matches.append(
                {
                    "intervention_id": intervention_id,
                    "municipality_id": municipality["id"],
                    "count": len(subset),
                    "years": sorted({record["year"] for record in subset if record["year"] is not None}),
                    "plans": sorted({record["plan"] for record in subset if record["plan"]}),
                    "indicators": sorted({record["indicator"] for record in subset if record["indicator"]}),
                    "sample_measure": subset[0]["measure"],
                    "match_provenance": "team_inference",
                    "match_note": "Coincidencia por frase explícita del catálogo del reto. No es una evaluación de efectividad.",
                }
            )

    adequate_counts = []
    min_records = 5
    for match in matches:
        coverage_row = next(item for item in coverage if item["municipality_id"] == match["municipality_id"])
        if coverage_row["records"] >= min_records:
            adequate_counts.append(match["count"])

    return {
        "schema": "ourea.cornare.adaptation_history",
        "source_file": "CLIMATERISK/REPORTE MEDIDAS DE ADAPTACIÓN MUNICIPIOS.xlsx",
        "source_rows": len(records),
        "scoped_rows": len(scoped),
        "hazard_label_is_not_vulnerability_index": True,
        "coverage_min_records_for_recurrence": min_records,
        "coverage": coverage,
        "matches": matches,
        "max_adequate_match_count": max(adequate_counts) if adequate_counts else 0,
        "records": scoped,
        "out_of_scope_row_count": len(records) - len(scoped),
    }


def _counts(values) -> dict:
    counts = {}
    for value in values:
        key = value or "Sin dato"
        counts[key] = counts.get(key, 0) + 1
    return counts


def write_history(target: Path) -> dict:
    payload = build_history()
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload


if __name__ == "__main__":
    output = ROOT / "frontend" / "public" / "data" / "cornare" / "adaptation_history.json"
    written = write_history(output)
    print(f"Wrote {output} scoped={written['scoped_rows']} matches={len(written['matches'])}")
