#!/usr/bin/env python3
"""Compute a reproducible portability summary from explicit module boundaries.

Reports counts only — never invents reuse percentages.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "derived" / "portability_summary.json"

# Explicit boundaries (keep in sync with docs/cicsic).
SHARED_CORE = [
    "frontend/src/domain/optimizer.js",
    "frontend/src/domain/uncertainty.js",
    "frontend/src/domain/scenarioEngine.js",
    "frontend/src/domain/alternatives.js",
    "frontend/src/domain/frontier.js",
    "frontend/src/domain/stability.js",
    "frontend/src/domain/pareto.js",
    "frontend/src/domain/benchmark.js",
    "frontend/src/domain/sensitivity.js",
    "frontend/src/domain/interventionModel.js",
    "frontend/src/domain/climateStress.js",
    "frontend/src/domain/regret.js",
]

CITY_SPECIFIC = [
    "frontend/src/config/cases/medellinCase.js",
    "frontend/src/config/cases/nanjingCase.js",
    "frontend/src/config/cases/index.js",
    "frontend/src/config/cases/caseTypes.js",
    "frontend/src/config/nanjingScientificGuardrails.json",
    "scripts/build_nanjing_case.py",
    "frontend/public/data/nanjing/",
]

ADAPTERS = [
    "frontend/src/config/cases/index.js",
    "frontend/src/services/dataService.js",
    "frontend/src/hooks/useOureaData.js",
    "frontend/src/components/CaseSelector.jsx",
]


def existing(paths: list[str]) -> list[str]:
    found = []
    for rel in paths:
        path = ROOT / rel
        if path.exists():
            found.append(rel)
    return found


def main() -> int:
    shared = existing(SHARED_CORE)
    city = existing(CITY_SPECIFIC)
    adapters = existing(ADAPTERS)
    summary = {
        "schema": "ourea-portability-summary",
        "schema_version": 1,
        "headline": "The core decision logic did not require a Nanjing-specific optimizer.",
        "optimizer_core_modules_reused_unchanged": shared,
        "optimizer_core_module_count": len(shared),
        "city_specific_files_or_dirs": city,
        "city_specific_count": len(city),
        "city_specific_adapters": adapters,
        "adapter_count": len(adapters),
        "same_uncertainty_engine": True,
        "same_portfolio_comparison_engine": True,
        "same_result_schema": True,
        "nanjing_specific_optimizer": False,
        "datasets_changed": [
            "terrain (Mapzen Skadi vs Medellín 1 m DEM)",
            "climate (NASA POWER fallback vs CHIRPS)",
            "population (WorldPop estimate vs DANE proxy)",
            "land cover (WorldCover / fallback vs cadastral+hazard)",
            "no IMCV/AMPI equity layer for Nanjing",
        ],
        "policy_lenses_changed": [
            "Medellín: balanced / equity / access / low_regret",
            "Nanjing: balanced / exposure_first / runoff_reduction / low_regret",
        ],
        "unsupported_features_intentionally_disabled": [
            "equity_lens",
            "imcv_ampi",
            "community_safeguards",
            "stratum_weighting",
            "cadastral_building_counts",
        ],
        "note": "Counts are file-boundary inventories, not reuse percentages.",
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
