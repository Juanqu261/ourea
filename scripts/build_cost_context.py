"""Build frontend/public/data/cost_context.json from the versioned cost registry.

Runtime Ourea never calls this script or any price API. The shipped JSON is the
offline cost context for the decision-brief envelope.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "data" / "derived" / "cost_reference_registry.json"
DRAINAGE_CSV = ROOT / "data" / "derived" / "local_infrastructure_cost_scale.csv"
OUTPUT = ROOT / "frontend" / "public" / "data" / "cost_context.json"

TWOPLACES = Decimal("0.01")
SIXPLACES = Decimal("0.000001")


def dec(value) -> Decimal:
    return Decimal(str(value))


def money(value: Decimal) -> float:
    return float(value.quantize(TWOPLACES, rounding=ROUND_HALF_UP))


def rate(value: Decimal) -> float:
    return float(value.quantize(SIXPLACES, rounding=ROUND_HALF_UP))


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def inflate(amount: Decimal, factors: list[Decimal]) -> Decimal:
    out = amount
    for factor in factors:
        out *= factor
    return out


def factors_after(cpi_factors: list[dict], source_year: int) -> list[Decimal]:
    selected = [
        dec(item["factor"])
        for item in cpi_factors
        if int(item["applies_to_prices_of"]) >= int(source_year)
    ]
    if not selected:
        raise ValueError(f"No CPI factors apply to prices of {source_year}")
    return selected


def median(values: list[Decimal]) -> Decimal:
    ordered = sorted(values)
    n = len(ordered)
    if n == 0:
        raise ValueError("median of empty sequence")
    mid = n // 2
    if n % 2:
        return ordered[mid]
    return (ordered[mid - 1] + ordered[mid]) / 2


def reader_label(item: dict) -> str:
    if item.get("reader_label"):
        return item["reader_label"]
    identity = str(item.get("id") or "")
    source = str(item.get("source") or item.get("title") or "")
    if identity.startswith("fx_") or "Banco de la República" in source:
        return "Banco de la República - TRM"
    if "ICOCIV" in source or identity.startswith("icociv_"):
        return "DANE - ICOCIV"
    if "IPC" in source or identity.startswith("cpi_"):
        return "DANE - IPC"
    if identity.startswith("idb_") or "Inter-American" in source:
        return "IDB - Design Well, Build Better"
    if "DAGRD" in source or identity.startswith("restoration_"):
        return "Alcaldía de Medellín - DAGRD Comuna 8"
    if identity.startswith("drainage_scale_"):
        return f"Alcaldía de Medellín - hydraulic works ({item.get('project') or item.get('title')})"
    if identity.startswith("rwh_"):
        return "Fundación Universidad de Antioquia - rainwater harvesting"
    return str(item.get("source_title") or item.get("title") or item.get("source") or identity)


def source_card(item: dict, extra: dict | None = None) -> dict:
    card = {
        "id": item["id"],
        "source_date": item.get("source_date") or item.get("date") or item.get("year"),
        "location": item.get("location"),
        "original_currency": item.get("original_currency"),
        "original_amount": item.get("official_budget_cop")
        or item.get("cop_per_usd")
        or item.get("original_amount"),
        "quantity_basis": item.get("quantity_basis"),
        "inflation_method": item.get("inflation_method") or item.get("method"),
        "fx_method": item.get("fx_method"),
        "inclusions": item.get("inclusions") or item.get("scope_included") or [],
        "exclusions": item.get("exclusions") or [],
        "evidence_tier": item.get("evidence_tier") or item.get("evidence_type"),
        "comparability_warning": item.get("comparability_warning") or item.get("guardrail"),
        "url": item.get("url") or item.get("source"),
        "access_date": item.get("access_date", "2026-08-28"),
        "title": item.get("source_title") or item.get("source") or item.get("id"),
        "reader_label": reader_label(item),
        "source_type": item.get("source_type") or item.get("evidence_type") or item.get("evidence_tier"),
    }
    if extra:
        card.update(extra)
        if "reader_label" not in extra:
            card["reader_label"] = reader_label({**item, **card, **extra})
    return card


def build_context(registry: dict, drainage_rows: list[dict]) -> dict:
    fx = registry["fx"]
    cpi = registry["cpi"]
    icociv = registry["icociv"]
    design = registry["design_allowance"]
    assumptions = registry["planning_assumptions"]
    cop_per_usd = dec(fx["cop_per_usd"])
    cpi_factors = cpi["factors"]
    icociv_factors = icociv["factors"]

    rwh_ref = next(
        item for item in registry["references"] if item["id"] == "rwh_santa_elena_1000l_2023_budget_ceiling"
    )
    restoration_ref = next(
        item for item in registry["references"] if item["id"] == "restoration_dagrd_comuna8_2019"
    )

    rwh_ceiling = dec(rwh_ref["derived_budget_ceiling_cop_per_system"])
    rwh_2026_cop = inflate(rwh_ceiling, factors_after(cpi_factors, 2023))
    rwh_anchor_usd = rwh_2026_cop / cop_per_usd

    restoration_2026_cop = inflate(
        dec(restoration_ref["official_budget_cop"]),
        [dec("1.0161"), *factors_after(icociv_factors, 2020)],
    )
    restoration_anchor_usd = restoration_2026_cop / cop_per_usd

    drainage_records = []
    usd_per_m = []
    rom_package_usd = []
    for row in drainage_rows:
        length = dec(row["reported_length_m"])
        budget = dec(row["reported_budget_cop"])
        cop_per_m = budget / length
        usd_m = cop_per_m / cop_per_usd
        usd_total = budget / cop_per_usd
        usd_per_m.append(usd_m)
        record_id = f"drainage_scale_{slug(row['project'])}"
        scope = str(row["scope_note"]).lower()
        comparable_length = 20 <= float(length) <= 120 and "retaining" not in scope
        if comparable_length:
            rom_package_usd.append(usd_total)
        drainage_records.append(
            {
                "id": record_id,
                "project": row["project"],
                "location": row["location"],
                "source_date": row["reference_date"],
                "reported_length_m": float(length),
                "reported_budget_cop": int(budget),
                "usd_package_total": money(usd_total),
                "usd_per_reported_m": rate(usd_m),
                "rom_corridor_package": comparable_length,
                "scope": row["scope_note"],
                "comparability": row["comparability"],
                "model_use": (
                    "ROM hillside corridor package; not a transferable unit rate"
                    if comparable_length
                    else row["model_use"]
                ),
                "comparability_warning": row["warning"],
                "quantity_basis": "reported metres in a heterogeneous public-works package",
                "inflation_method": "none; source already dated 2026",
                "fx_method": "Divide source COP by Banco de la República TRM 2026-08-28",
                "original_currency": "COP",
                "original_amount": int(budget),
                "evidence_tier": "descriptive-scale",
                "url": registry["drainage_source_urls"][0],
                "access_date": "2026-08-28",
                "reader_label": f"Alcaldía de Medellín - hydraulic works ({row['project']})",
                "source_type": "municipal public-works report",
                "inclusions": [row["scope_note"]],
                "exclusions": [
                    "transferable unit price",
                    "surveyed Llanaditas corridor length",
                ],
            }
        )

    if not rom_package_usd:
        raise ValueError("No ROM drainage packages in the 35-100 m comparable set")
    drainage_package_low = min(rom_package_usd)
    drainage_package_high = max(rom_package_usd)
    drainage_package_base = median(rom_package_usd)
    drainage_low = min(usd_per_m)
    drainage_high = max(usd_per_m)
    drainage_ref = median(usd_per_m)

    sources = [
        source_card(fx, {"location": "Colombia", "original_amount": float(cop_per_usd)}),
        source_card(cpi, {"location": "Colombia", "original_currency": "index factor"}),
        source_card(icociv, {"location": "Colombia", "original_currency": "index factor"}),
        source_card(design, {"location": design.get("location")}),
        source_card(rwh_ref),
        source_card(restoration_ref),
    ]
    for record in drainage_records:
        sources.append(
            source_card(
                record,
                {
                    "title": record["project"],
                    "source_date": record["source_date"],
                    "reader_label": record["reader_label"],
                    "source_type": record["source_type"],
                },
            )
        )
    press_ids = []
    for url in registry["drainage_source_urls"][1:]:
        press_ids.append(f"drainage_press_{slug(url[-48:])}")
        sources.append(
            {
                "id": f"drainage_press_{slug(url[-48:])}",
                "source_date": "2026",
                "location": "Medellín",
                "original_currency": None,
                "original_amount": None,
                "quantity_basis": "public-works reporting for hydraulic packages",
                "inflation_method": "none",
                "fx_method": "same TRM as converted CSV rows",
                "inclusions": ["Press-reported 2026 hydraulic packages"],
                "exclusions": ["transferable USD/m"],
                "evidence_tier": "descriptive-scale",
                "comparability_warning": "Project scopes differ and must not be inserted as a unit-cost prior.",
                "url": url,
                "access_date": "2026-08-28",
                "title": "Medellín hydraulic public-works reporting",
                "reader_label": "Alcaldía de Medellín - hydraulic works",
                "source_type": "municipal public-works report",
            }
        )

    return {
        "schema": "ourea-cost-context",
        "schema_version": 1,
        "generated_by": "scripts/build_cost_context.py",
        "price_date": registry["price_date"],
        "status": registry["status"],
        "fx": {
            "id": fx["id"],
            "date": fx["date"],
            "cop_per_usd": float(cop_per_usd),
            "source": fx["source"],
            "url": fx["url"],
            "access_date": fx["access_date"],
        },
        "cpi": {
            "id": cpi["id"],
            "source": cpi["source"],
            "url": cpi["url"],
            "access_date": cpi["access_date"],
            "factors": cpi_factors,
            "used_for": "household rainwater-harvesting equipment only",
        },
        "icociv": {
            "id": icociv["id"],
            "source": icociv["source"],
            "url": icociv["url"],
            "access_date": icociv["access_date"],
            "factors": icociv_factors,
            "ipc_bridge_2019_to_2020": 1.0161,
            "used_for": "civil-works restoration package; 2026 drainage comparators need no inflation",
            "ytd_2026": None,
        },
        "design_allowance": {
            "id": design["id"],
            "low": design["low"],
            "base": design["base"],
            "high": design["high"],
            "basis": design["basis"],
            "source_id": design["id"],
            "url": design["url"],
        },
        "cell_width_m": 80,
        "interventions": {
            "rwh": {
                "quantity_unit": "participating household system",
                "quantity_rule": "max(1, round(cadastral buildings × participationShare))",
                "usd_per_system": assumptions["rwh_usd_per_system"],
                "anchor_cop_2023": float(rwh_ceiling),
                "normalized_cop_2026": money(rwh_2026_cop),
                "anchor_usd": money(rwh_anchor_usd),
                "evidence_tier": rwh_ref["evidence_tier"],
                "evidence_label": rwh_ref["evidence_label"],
                "source_ids": [rwh_ref["id"], fx["id"], cpi["id"]],
                "component": "equipment",
                "includes": rwh_ref["inclusions"],
                "excludes": rwh_ref["exclusions"],
                "price_date": registry["price_date"],
            },
            "drainage": {
                "quantity_unit": "hillside corridor package",
                "method": "rom_package",
                "length_m": assumptions["drainage_corridor_length_m"],
                "usd_per_package": {
                    "low": money(drainage_package_low),
                    "base": money(drainage_package_base),
                    "high": money(drainage_package_high),
                },
                "comparator_usd_per_reported_m": {
                    "low": rate(drainage_low),
                    "base": rate(drainage_ref),
                    "high": rate(drainage_high),
                    "model_use": "descriptive comparator only; not multiplied as a unit rate",
                },
                "records": drainage_records,
                "evidence_tier": "low-medium",
                "evidence_label": "ROM packages from 2026 Medellín hydraulic works with reported length 35-100 m; not a transferable USD/m rate",
                "source_ids": [item["id"] for item in drainage_records if item["rom_corridor_package"]] + [fx["id"]] + press_ids,
                "component": "construction",
                "length_note": assumptions["drainage_corridor_length_m"]["note"],
                "includes": [
                    "order-of-magnitude construction for one hillside corridor package per selected cell",
                ],
                "excludes": [
                    "transferable unit rate",
                    "surveyed alignment",
                    "land acquisition",
                    "construction supervision",
                ],
                "price_date": "2026",
            },
            "restoration": {
                "quantity_unit": "project-scale package",
                "usd_per_package": assumptions["restoration_usd_per_package"],
                "anchor_cop_2019": restoration_ref["official_budget_cop"],
                "normalized_cop_2026": money(restoration_2026_cop),
                "anchor_usd": money(restoration_anchor_usd),
                "evidence_tier": restoration_ref["evidence_tier"],
                "evidence_label": "ICOCIV- and TRM-normalized Comuna 8 DAGRD project-scale package; not a USD/m² rate",
                "source_ids": [restoration_ref["id"], fx["id"], icociv["id"], cpi["id"]],
                "component": "construction",
                "includes": restoration_ref["inclusions"],
                "excludes": restoration_ref["exclusions"],
                "price_date": registry["price_date"],
            },
        },
        "sources": sources,
        "guardrails": [
            "USD figures are a pre-feasibility implementation envelope, not an offer, contract or engineering estimate.",
            "Planning credits remain the optimizer unit for portfolio comparison.",
            "Drainage is a ROM corridor package per selected cell, not a transferable USD/m rate.",
            "Corridor length 40/60/80 m is a named survey scenario, not a bill-of-quantities multiplier.",
            "Immediate decision-preparation items are unpriced until survey and 30% design.",
            "Community review remains a decision gate.",
        ],
    }


def load_drainage_rows() -> list[dict]:
    with DRAINAGE_CSV.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def dump(context: dict) -> str:
    return json.dumps(context, indent=2, ensure_ascii=False) + "\n"


def build() -> dict:
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    return build_context(registry, load_drainage_rows())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="exit non-zero if the committed cost_context.json is stale",
    )
    args = parser.parse_args()
    context = build()
    text = dump(context)
    if args.check:
        current = OUTPUT.read_text(encoding="utf-8") if OUTPUT.exists() else ""
        if current.replace("\r\n", "\n") != text:
            print("cost_context.json is stale; run python scripts/build_cost_context.py", file=sys.stderr)
            return 1
        print("cost_context.json matches scripts/build_cost_context.py")
        return 0
    OUTPUT.write_text(text, encoding="utf-8", newline="\n")
    print(f"Wrote {OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
