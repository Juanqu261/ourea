"""Write the challenge intervention catalogue."""

from __future__ import annotations

import json
from pathlib import Path

from institutional import BUDGET_MILLION_COP, DIMENSIONS, INTERVENTIONS

ROOT = Path(__file__).resolve().parents[2]
SOURCE = {
    "id": "reto-brief-2026",
    "title": "Reto Climate Risk Hackathon for Cities propuesto por CORNARE",
    "file": "CLIMATERISK/RETO CLIMATE WEEK HACKATHON.pdf",
    "page": "Catálogo de medidas y costos de referencia",
}


def catalogue_payload() -> dict:
    costs = [item["cost_million_cop"] for item in INTERVENTIONS]
    return {
        "schema": "ourea.cornare.interventions",
        "budget_million_cop": BUDGET_MILLION_COP,
        "catalogue_total_million_cop": sum(costs),
        "costs_are_exercise_assumptions": True,
        "costs_indivisible": True,
        "source": SOURCE,
        "dimensions": DIMENSIONS,
        "interventions": [
            {
                **item,
                "evidence": {
                    "cost": "assumption",
                    "name_and_unit": "institutional",
                    "nbs_class": "team_inference",
                    "actors": "team_inference",
                },
                "source_id": SOURCE["id"],
            }
            for item in INTERVENTIONS
        ],
    }


def write_catalogue(target: Path) -> dict:
    payload = catalogue_payload()
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload


if __name__ == "__main__":
    path = ROOT / "frontend" / "public" / "data" / "cornare" / "interventions.json"
    written = write_catalogue(path)
    print(f"Wrote {path} measures={len(written['interventions'])} total={written['catalogue_total_million_cop']}")
