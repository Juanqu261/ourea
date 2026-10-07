"""Create the Ourea reproducibility manifest."""
from __future__ import annotations

from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "MANIFEST.json"
CHECKSUMS = ROOT / "SHA256SUMS.txt"


def include(path: Path) -> bool:
    if not path.is_file():
        return False
    relative = path.relative_to(ROOT)
    if any(
        part in {
            "__pycache__",
            "node_modules",
            "dist",
            ".git",
            ".venv",
            "venv",
            ".cursor",
            ".idea",
            ".vscode",
            ".pytest_cache",
            "playwright-report",
            "test-results",
            "blob-report",
            ".cache",
        }
        for part in relative.parts
    ):
        return False
    if path.name.startswith(".env") and path.name != ".env.example":
        return False
    if path.suffix == ".local":
        return False
    if ".vercel" in relative.parts:
        return False
    return path not in {MANIFEST, CHECKSUMS}


BINARY_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def canonical_bytes(path: Path) -> bytes:
    data = path.read_bytes()
    if path.suffix.lower() in BINARY_SUFFIXES or b"\0" in data:
        return data
    return data.replace(b"\r\n", b"\n")


def sha256(path: Path) -> str:
    return hashlib.sha256(canonical_bytes(path)).hexdigest()


def load_json(relative: str):
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def main() -> None:
    files = sorted(
        (path for path in ROOT.rglob("*") if include(path)),
        key=lambda path: str(path.relative_to(ROOT)),
    )
    hashes = [
        {
            "path": str(path.relative_to(ROOT)).replace("\\", "/"),
            "bytes": len(canonical_bytes(path)),
            "sha256": sha256(path),
        }
        for path in files
    ]

    package = load_json("frontend/package.json")
    model = load_json("frontend/src/config/modelParameters.json")
    buildings = load_json("frontend/public/data/buildings.geojson")
    cells = load_json("frontend/public/data/planning_cells.geojson")
    city = load_json("frontend/public/data/medellin_city_priority_screen.geojson")
    summary = load_json("frontend/public/data/summary.json")
    evidence = load_json("frontend/public/data/evidence_status.json")
    climate = load_json("frontend/public/data/climate_context.json")
    alignment = load_json("frontend/public/data/plan_alignment.json")
    browser = load_json("frontend/public/data/optimizer_checkpoint.json")
    frontier = load_json("data/derived/browser_budget_frontier.json")
    stability = load_json("data/derived/browser_selection_stability.json")
    alternatives = load_json("data/derived/robust_policy_alternatives.json")
    consensus = load_json("data/derived/policy_consensus.json")
    pareto = load_json("data/derived/sampled_pareto.json")
    milp = load_json("data/derived/milp_checkpoint.json")
    milp_policies = load_json("data/derived/milp_policy_alternatives.json")
    city_meta = load_json("data/derived/city_screening_source_metadata.json")
    costs = load_json("data/derived/cost_reference_registry.json")
    cost_context = load_json("frontend/public/data/cost_context.json")
    guardrails = load_json("frontend/src/config/scientificGuardrails.json")

    population_matched = sum(
        1
        for feature in city["features"]
        if feature["properties"].get("population_2026") is not None
    )
    llanaditas = next(
        feature["properties"]
        for feature in city["features"]
        if "LLANADITAS" in str(feature["properties"].get("BARRIO", "")).upper()
    )
    terrain_tiles = len(list((ROOT / "frontend/public/terrain").rglob("*.png")))

    manifest = {
        "project": "Ourea",
        "package_version": package["version"],
        "manifest_date": "2026-08-28",
        "model_status": model["status"],
        "production_build_status": (
            "local npm ci, npm test and npm run build succeeded; "
            "initial application JS is ~397 kB minified; MapLibre is a deferred ~947 kB chunk"
        ),
        "data_counts": {
            "detailed_buildings": len(buildings["features"]),
            "planning_cells": len(cells["features"]),
            "city_polygons": len(city["features"]),
            "official_urban_population_records": city_meta["population_projection"]["urban_barrio_records"],
            "population_matched_city_polygons": population_matched,
            "terrain_png_tiles": terrain_tiles,
            "detailed_population_proxy_rounded": summary["population_proxy"],
            "detailed_high_hazard_buildings": summary["high_hazard_buildings"],
        },
        "llanaditas_city_screen": {
            "population_2026": llanaditas["population_2026"],
            "rank_hazard_only": llanaditas["rank_hazard_only"],
            "rank_exposure": llanaditas["rank_exposure"],
            "rank_balanced": llanaditas["rank_balanced"],
            "rank_equity": llanaditas["rank_equity"],
        },
        "evidence_registry": {
            "schema": evidence.get("schema"),
            "schema_version": evidence.get("schema_version"),
            "entries": len(evidence["layers"]),
            "global_guardrails": len(guardrails["items"]),
        },
        "climate_context": {
            "source_name": climate["source_name"],
            "source_version": climate["source_version"],
            "climatology_period": climate["climatology_period"]["label"],
            "available_period": climate["available_period"]["label"],
            "preset_ids": [item["id"] for item in climate["scenario_presets"]],
        },
        "plan_alignment": {
            "schema_version": alignment.get("schema_version"),
            "entries": len(alignment.get("entries", [])),
        },
        "browser_balanced_checkpoint": {
            "budget_credits": browser["budgetCredits"],
            "spent_credits": browser["spentCredits"],
            "projects": len(browser["projects"]),
            "candidate_count": browser["optimizerDiagnostics"]["candidateCount"],
            "scenario_samples": browser["optimizerDiagnostics"]["scenarioSamples"],
            "monte_carlo_runs": browser["benefitProxyMonteCarlo"]["runs"],
            "p10": browser["benefitProxyMonteCarlo"]["p10"],
            "median": browser["benefitProxyMonteCarlo"]["median"],
            "p90": browser["benefitProxyMonteCarlo"]["p90"],
        },
        "browser_budget_frontier": {
            "profile": frontier[0]["profileId"] if frontier else None,
            "points": len(frontier),
            "budgets": [item["budgetCredits"] for item in frontier],
        },
        "selection_stability": {
            "profile": stability["profileId"],
            "runs": stability["runCount"],
            "scenario_samples_per_optimization": stability["scenarioSamplesPerOptimization"],
            "projects_seen": len(stability["projects"]),
        },
        "robust_policy_alternatives": {
            "profiles": [item["profileId"] for item in alternatives],
            "highest_p10_profile": max(alternatives, key=lambda item: item["benefitProxy"]["p10"])["profileId"],
            "count": len(alternatives),
        },
        "policy_consensus": {
            "projects_seen": len(consensus),
            "all_policy_core_projects": sum(
                1 for item in consensus if item["consensusAllNamedPolicies"]
            ),
        },
        "sampled_tradeoffs": {
            "sampled_profiles": pareto["sampledProfiles"],
            "unique_portfolios": pareto["uniquePortfolios"],
            "non_dominated_portfolios": len(pareto["frontier"]),
        },
        "formal_milp": {
            "balanced_solver_success": milp["solver_success"],
            "balanced_projects": len(milp["projects"]),
            "balanced_spent_credits": milp["spent"],
            "nonlinear_runs": milp["nonlinear_portfolio_re_evaluation"]["runs"],
            "policy_crosschecks": [
                {
                    "profile": item["profile_id"],
                    "solver_success": item["solver_success"],
                    "spent_credits": item["spent_credits"],
                    "projects": len(item["projects"]),
                }
                for item in milp_policies
            ],
        },
        "cost_evidence": {
            "schema": costs.get("schema"),
            "schema_version": costs.get("schema_version"),
            "references": len(costs["references"]),
            "public_context_schema": cost_context.get("schema"),
            "fx_date": cost_context.get("fx", {}).get("date"),
            "cop_per_usd": cost_context.get("fx", {}).get("cop_per_usd"),
        },
        "file_count_excluding_manifest": len(hashes),
        "files": hashes,
    }

    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    CHECKSUMS.write_text(
        "".join(f'{item["sha256"]}  {item["path"]}\n' for item in hashes),
        encoding="utf-8",
    )
    print(f"Wrote Ourea manifest/checksums for {len(hashes)} files.")


if __name__ == "__main__":
    main()
