"""Rebuild the Ourea Medellín city-priority screen from official workbooks.

This script is intentionally deterministic. Naming variants are resolved through
an explicit audited alias map; ambiguous records are left unmatched rather than
assigned with unconstrained fuzzy matching.

Example:
    python scripts/build_city_screen.py \
      --baseline data/derived/city_screen_hazard_baseline.geojson \
      --population-xlsx /path/to/population.xlsx \
      --imcv-xlsx /path/to/imcv.xlsx
"""
from __future__ import annotations

from pathlib import Path
import argparse
import hashlib
import json
import math
import re
import unicodedata
import xml.etree.ElementTree as ET
import zipfile

import numpy as np
import pandas as pd

from geojson_io import read_local_geojson

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BASELINE = ROOT / "data" / "derived" / "city_screen_hazard_baseline.geojson"
DEFAULT_OUTPUT = ROOT / "frontend" / "public" / "data" / "medellin_city_priority_screen.geojson"
DERIVED = ROOT / "data" / "derived"
XML_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

CITY_POLICY = {
    "medium_hazard_weight": 0.5,
    "balanced": {"exposure": 0.75, "vulnerability": 0.25},
    "equity": {"exposure": 0.55, "vulnerability": 0.45},
}

ALIASES = {
    "Barrio Caicedo": "CAYCEDO",
    "Trece de Noviembre": "15 DE NOVIEMBRE",
    "Ocho de Marzo": "8 DE MARZO",
    "Veinte de Julio": "20 DE JULIO",
    "Moscú No.2": "MOSCU",
    "Versalles No.1": "VERSALES No.1",
    "Versalles No.2": "VERSALES No.2",
    "B. Cerro El Volador": "CERRO EL VOLADOR",
    "Facultad de Minas U. Nacional": "UNIVERSIDAD NACIONAL FACULTAD DE MINAS",
    "López de  Mesa": "LUIS LÓPEZ DE MESA",
    "Cucaracho": "EL CUCARACHO",
    "Llanaditas": "LLANADITAS No.2",
    "Villa Lilliam": "VILLA LILIAM",
    "Juan Pablo II": "JUAN PABLO",
    "Asomadera No.1": "LA ASOMADERA No.1",
    "Asomadera No.2": "LA ASOMADERA No.2",
    "Asomadera No.3": "LA ASOMADERA No.3",
    "Corazón de Jesús": "CORAZON DEJESUS",
    "Barrio Colón": "COLON",
    "Los Conquistadores": "CONQUISTADORES",
    "La Floresta": "FLORESTA",
    "Calasanz Parte Alta": "CALASANZ PA.",
    "Las Independencias": "LA INDEPENDENCIA",
    "Barrio Colombia": "COLOMBIA",
    "El Tesoro": "ELTESORO",
    "San Lucas": "SANLUCAS",
    "La Loma de Los Bernal": "LOMA DE LOS BERNAL",
    "Nueva Villa del Aburrá": "NUEVA VILLA DE ABURRA",
}

INTENTIONALLY_UNMATCHED_CODES = {"0725"}


def normalize(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(char for char in text if not unicodedata.combining(char)).upper().strip()
    text = text.replace("Nº", "NO").replace("N°", "NO").replace("NO.", "NO")
    text = text.replace("#", "NO").replace("-", " ")
    text = re.sub(r"\bNRO\b|\bNUMERO\b", "NO", text)
    text = re.sub(r"[^A-Z0-9 ]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _xlsx_rows(path: Path, sheet_xml: str):
    with zipfile.ZipFile(path) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall(XML_NS + "si"):
                shared.append("".join((node.text or "") for node in item.iter(XML_NS + "t")))

        sheet = ET.fromstring(archive.read(sheet_xml))

        def col_index(reference: str) -> int:
            match = re.match(r"([A-Z]+)", reference)
            value = 0
            for char in match.group(1):
                value = value * 26 + ord(char) - 64
            return value

        for row in sheet.findall(".//" + XML_NS + "row"):
            values = {}
            max_col = 0
            for cell in row.findall(XML_NS + "c"):
                index = col_index(cell.attrib["r"])
                max_col = max(max_col, index)
                kind = cell.attrib.get("t")
                value_node = cell.find(XML_NS + "v")
                value = ""
                if kind == "s" and value_node is not None:
                    value = shared[int(value_node.text)]
                elif kind == "inlineStr":
                    text_node = cell.find(".//" + XML_NS + "t")
                    value = text_node.text if text_node is not None else ""
                elif value_node is not None:
                    value = value_node.text
                values[index] = value
            yield int(row.attrib.get("r", "0")), [values.get(i, "") for i in range(1, max_col + 1)]


def population_records(path: Path) -> list[dict]:
    urban = {f"{value:02d}" for value in range(1, 17)}
    records = []
    for row_number, values in _xlsx_rows(path, "xl/worksheets/sheet2.xml"):
        if row_number < 15 or len(values) < 18 or values[4] != "Total":
            continue
        code = values[2]
        if not re.fullmatch(r"\d{4}", code or "") or code[:2] not in urban:
            continue
        records.append(
            {
                "comuna_code": code[:2],
                "comuna": values[1],
                "barrio_code": code,
                "barrio_population_name": values[3],
                "population_2026": int(float(values[13])),
            }
        )
    if len(records) != 249:
        raise ValueError(f"Expected 249 urban barrio records, found {len(records)}")
    return records


def imcv_values(path: Path) -> dict[str, float]:
    values = {}
    for row_number, row in _xlsx_rows(path, "xl/worksheets/sheet1.xml"):
        if row_number < 3 or len(row) < 2:
            continue
        key = normalize(row[0])
        if not key or key == "MEDELLIN":
            continue
        try:
            values[key] = float(row[1])
        except (TypeError, ValueError):
            pass
    return values


def minmax(series: pd.Series) -> pd.Series:
    low, high = float(series.min()), float(series.max())
    return (series - low) / max(1e-12, high - low)


def build(baseline_path: Path, population_path: Path, imcv_path: Path, output_path: Path):
    baseline = read_local_geojson(baseline_path)
    baseline["_norm"] = baseline["BARRIO"].map(normalize)
    index = {value: idx for idx, value in enumerate(baseline["_norm"])}
    aliases = {normalize(source): normalize(target) for source, target in ALIASES.items()}
    imcv = imcv_values(imcv_path)

    records = []
    for record in population_records(population_path):
        source_key = normalize(record["barrio_population_name"])
        target_key = aliases.get(source_key, source_key)
        polygon_index = None if record["barrio_code"] in INTENTIONALLY_UNMATCHED_CODES else index.get(target_key)
        records.append(
            {
                **record,
                "polygon_index": polygon_index,
                "polygon_barrio_name": (
                    baseline.iloc[polygon_index]["BARRIO"] if polygon_index is not None else None
                ),
                "match_method": (
                    "explicit_alias" if source_key in aliases else "exact"
                ) if polygon_index is not None else "intentionally_unmatched",
                "imcv_ampi_2023": imcv.get(normalize(record["comuna"])),
            }
        )

    match = pd.DataFrame(records)
    if match["polygon_index"].notna().sum() != 248:
        raise ValueError("Expected exactly 248 safe polygon matches")

    for field in [
        "barrio_code", "comuna_code", "comuna_name", "population_2026", "imcv_ampi_2023"
    ]:
        baseline[field] = np.nan if field in {"population_2026", "imcv_ampi_2023"} else None
    baseline["population_match"] = "unmatched_or_special"

    for _, row in match.dropna(subset=["polygon_index"]).iterrows():
        idx = int(row["polygon_index"])
        baseline.at[idx, "barrio_code"] = row["barrio_code"]
        baseline.at[idx, "comuna_code"] = row["comuna_code"]
        baseline.at[idx, "comuna_name"] = row["comuna"]
        baseline.at[idx, "population_2026"] = row["population_2026"]
        baseline.at[idx, "imcv_ampi_2023"] = row["imcv_ampi_2023"]
        baseline.at[idx, "population_match"] = row["match_method"]

    valid = baseline["population_2026"].notna()
    baseline["population_density_km2_2026"] = np.where(
        valid & (baseline["area_total_ha"] > 0),
        baseline["population_2026"] / (baseline["area_total_ha"] / 100.0),
        np.nan,
    )

    high_share = pd.to_numeric(baseline["high_share"], errors="coerce").fillna(0).clip(0, 1)
    medium_share = np.where(
        baseline["area_total_ha"] > 0,
        pd.to_numeric(baseline["Media"], errors="coerce").fillna(0) / baseline["area_total_ha"],
        0,
    )
    hazard_factor = np.clip(
        high_share + CITY_POLICY["medium_hazard_weight"] * np.clip(medium_share, 0, 1),
        0,
        1,
    )
    baseline["hazard_weighted_population_proxy_2026"] = baseline["population_2026"] * hazard_factor

    exposure_raw = np.log1p(
        pd.to_numeric(
            baseline.loc[valid, "hazard_weighted_population_proxy_2026"],
            errors="coerce",
        ).fillna(0)
    )
    baseline["exposure_component"] = np.nan
    baseline.loc[valid, "exposure_component"] = minmax(exposure_raw)

    imcv_series = pd.to_numeric(baseline.loc[valid, "imcv_ampi_2023"], errors="coerce")
    imcv_min, imcv_max = float(imcv_series.min()), float(imcv_series.max())
    baseline["vulnerability_component"] = np.nan
    baseline.loc[valid, "vulnerability_component"] = (
        (imcv_max - imcv_series) / max(1e-12, imcv_max - imcv_min)
    ).clip(0, 1)

    baseline["priority_exposure"] = baseline["exposure_component"]
    baseline["priority_balanced"] = (
        CITY_POLICY["balanced"]["exposure"] * baseline["exposure_component"]
        + CITY_POLICY["balanced"]["vulnerability"] * baseline["vulnerability_component"]
    )
    baseline["priority_equity"] = (
        CITY_POLICY["equity"]["exposure"] * baseline["exposure_component"]
        + CITY_POLICY["equity"]["vulnerability"] * baseline["vulnerability_component"]
    )

    for field, rank in [
        ("priority_exposure", "rank_exposure"),
        ("priority_balanced", "rank_balanced"),
        ("priority_equity", "rank_equity"),
    ]:
        baseline[rank] = np.nan
        baseline.loc[valid, rank] = baseline.loc[valid, field].rank(method="min", ascending=False).astype(int)

    if "screening_rank" in baseline.columns:
        baseline["rank_hazard_only"] = baseline["screening_rank"]

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        baseline.drop(columns=["_norm"]).to_json(),
        encoding="utf-8",
    )

    DERIVED.mkdir(parents=True, exist_ok=True)
    match.drop(columns=["polygon_index"]).to_csv(
        DERIVED / "city_population_2026_barrio_match.csv", index=False
    )
    pd.DataFrame(
        [{"comuna": key, "imcv_ampi_2023": value} for key, value in sorted(imcv.items())]
    ).to_csv(DERIVED / "imcv_ampi_2023_comunas.csv", index=False)

    ranking_cols = [
        "BARRIO", "barrio_code", "comuna_name", "population_2026",
        "hazard_weighted_population_proxy_2026", "imcv_ampi_2023",
        "priority_exposure", "rank_exposure", "priority_balanced", "rank_balanced",
        "priority_equity", "rank_equity", "rank_hazard_only",
    ]
    baseline.loc[valid, ranking_cols].sort_values("rank_balanced").to_csv(
        DERIVED / "city_priority_screen.csv", index=False
    )

    metadata = {
        "population_projection": {
            "url": "https://www.medellin.gov.co/es/wp-content/uploads/2022/08/5.-Proyecciones-poblacionales-a-nivel-Barrios-y-Veredas-Medellin-2018-%E2%80%93-2030.xlsx",
            "sha256_downloaded_source": sha256(population_path),
            "urban_barrio_records": 249,
            "matched_to_current_polygon_export": 248,
        },
        "imcv_2023": {
            "url": "https://www.medellin.gov.co/es/wp-content/uploads/2022/08/socializacionIMCV2023.xlsx",
            "sha256_downloaded_source": sha256(imcv_path),
            "method": "AMPI-AMPI 2023",
        },
        "city_policy": CITY_POLICY,
        "intentional_unmatched_codes": sorted(INTENTIONALLY_UNMATCHED_CODES),
    }
    (DERIVED / "city_screening_source_metadata.json").write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
    )
    return baseline, match


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", type=Path, default=DEFAULT_BASELINE)
    parser.add_argument("--population-xlsx", type=Path, required=True)
    parser.add_argument("--imcv-xlsx", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    for path in [args.baseline, args.population_xlsx, args.imcv_xlsx]:
        if not path.exists():
            raise FileNotFoundError(path)

    city, match = build(args.baseline, args.population_xlsx, args.imcv_xlsx, args.output)
    valid = city["population_2026"].notna()
    llanaditas = city[city["BARRIO"].str.contains("LLANADITAS", case=False, na=False)].iloc[0]
    print(f"Wrote {args.output}")
    print(f"Population matches: {int(valid.sum())}/249")
    print(
        "Llanaditas: "
        f"population={int(llanaditas.population_2026)}, "
        f"exposure_rank={int(llanaditas.rank_exposure)}, "
        f"balanced_rank={int(llanaditas.rank_balanced)}, "
        f"equity_rank={int(llanaditas.rank_equity)}"
    )


if __name__ == "__main__":
    main()
