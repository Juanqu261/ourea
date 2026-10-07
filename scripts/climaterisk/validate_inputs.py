"""Fail if the derived CORNARE datasets violate the decision constraints."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "frontend" / "public" / "data" / "cornare"
MUNICIPALITIES = {"rionegro", "guarne", "marinilla"}
SCENARIOS = {"reference", "ssp3_7_0"}
METRICS = {"vulnerability", "sensitivity", "adaptive_capacity", "threat", "risk"}
CLASSES = {"muy_baja", "baja", "media", "alta", "muy_alta"}
PROVENANCE = {"institutional", "team_inference", "assumption", "missing"}


def load(name: str):
    path = DATA / name
    if not path.exists():
        raise SystemExit(f"Missing {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def main() -> None:
    errors: list[str] = []
    interventions = load("interventions.json")
    metrics = load("dimension_metrics.json")
    history = load("adaptation_history.json")
    model = load("decision_model.json")
    gaps = load("information_gaps.json")
    catalogue = interventions["interventions"]
    ids = [item["id"] for item in catalogue]
    require(len(ids) == len(set(ids)), "Duplicate intervention ids", errors)
    require(model["budget_million_cop"] == 5000, "Budget must be 5000 million COP", errors)
    require(interventions["budget_million_cop"] == 5000, "Catalogue budget drifted", errors)
    total = 0
    for item in catalogue:
        cost = item["cost_million_cop"]
        require(isinstance(cost, int) and cost > 0, f"{item['id']} cost is not a positive integer", errors)
        total += cost
        require(item["dimension_id"], f"{item['id']} has no dimension", errors)
        require(item["evidence"]["cost"] == "assumption", f"{item['id']} cost must stay an assumption", errors)
    require(total == interventions["catalogue_total_million_cop"] == 18900, f"Catalogue total {total} is not 18900", errors)
    require("emission" not in json.dumps(model["weights"]), "Weights must not use emissions", errors)
    for excluded in model["excluded_from_score"]:
        require("emission" in excluded or "mitigation" in excluded or "indicator" in excluded or "sector" in excluded, f"Unexpected exclusion {excluded}", errors)

    seen_metrics = set()
    for metric in metrics["metrics"]:
        municipality = metric.get("municipality_id")
        if municipality is not None:
            require(municipality in MUNICIPALITIES, f"Out of scope municipality {municipality}", errors)
        require(metric["scenario"] in SCENARIOS, f"Bad scenario {metric['scenario']}", errors)
        require(metric["metric"] in METRICS, f"Bad metric {metric['metric']}", errors)
        require(metric["provenance"] in PROVENANCE, f"Bad provenance on {metric['id']}", errors)
        if metric["classification"] is not None:
            require(metric["classification"] in CLASSES, f"Bad class {metric['classification']}", errors)
        for key in ("value", "value_min", "value_max"):
            value = metric.get(key)
            if value is not None:
                require(0 <= float(value) <= 1, f"{metric['id']} {key}={value} outside 0-1", errors)
        key = (
            metric.get("municipality_id"),
            metric["dimension_id"],
            metric["metric"],
            metric["scenario"],
            metric.get("year"),
            metric.get("value"),
            metric.get("classification"),
            metric["provenance"],
        )
        require(key not in seen_metrics, f"Duplicate metric row {metric['id']}", errors)
        seen_metrics.add(key)

    scoped_ids = {record["municipality_id"] for record in history["records"]}
    require(scoped_ids <= MUNICIPALITIES, f"History left the corridor: {scoped_ids}", errors)
    for record in history["records"]:
        require(record["hazard_label"] is None or isinstance(record["hazard_label"], str), "Hazard label corrupted", errors)
    require(history["hazard_label_is_not_vulnerability_index"] is True, "Hazard column was treated as the index", errors)

    for gap in gaps["gaps"]:
        for field in ("id", "missing_information", "why_it_matters", "which_decision_it_could_change", "how_to_collect_it", "priority"):
            require(gap.get(field), f"Gap {gap.get('id')} missing {field}", errors)
        require(gap["provenance"] in PROVENANCE, f"Gap provenance {gap['id']}", errors)

    geo_path = DATA / "municipalities.geojson"
    if geo_path.exists():
        geo = json.loads(geo_path.read_text(encoding="utf-8"))
        geo_ids = {feature["properties"]["id"] for feature in geo["features"]}
        require(geo_ids == MUNICIPALITIES, f"Boundary ids {geo_ids}", errors)

    if errors:
        print("\n".join(errors), file=sys.stderr)
        raise SystemExit(1)
    print("CORNARE inputs validated")


if __name__ == "__main__":
    main()
