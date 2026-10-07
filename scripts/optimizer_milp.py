"""Formal MILP checkpoint for OUREA.

The budget/selection constraints are exact binary MILP constraints. Candidate
benefit coefficients are a linearization of the same uncertainty model used by
the browser. Numerical model parameters come from one JSON source of truth.

The objective is additive, while stacked intervention effects are multiplicative
in the scenario engine. For that reason every selected MILP portfolio is also
re-evaluated with the nonlinear stacking rule before any combined benefit proxy
is written to the checkpoint.

All current effect, climate and planning-credit values remain development priors.
"""
from __future__ import annotations

from pathlib import Path
import json

import numpy as np
import pandas as pd
from scipy.optimize import Bounds, LinearConstraint, milp

from geojson_io import read_local_geojson
from geopandas import GeoDataFrame

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "frontend" / "public" / "data"
MODEL_FILE = ROOT / "frontend" / "src" / "config" / "modelParameters.json"
MODEL = json.loads(MODEL_FILE.read_text(encoding="utf-8"))
BASE_SEED = int(MODEL["scenarioUncertainty"]["baseSeed"])
COMPARISON_SEED = int(MODEL["scenarioUncertainty"]["comparisonSeed"])
CHECKPOINT_MONTE_CARLO_RUNS = int(
    MODEL["optimizer"]["checkpointMonteCarloRuns"]
)
UINT32_MASK = 0xFFFFFFFF
LCG_MULTIPLIER = 1664525
LCG_INCREMENT = 1013904223
PROJECT_HASH_MULTIPLIER = 16777619


def typical_wet_context() -> tuple[float, float]:
    climate = json.loads((DATA / "climate_context.json").read_text(encoding="utf-8"))
    typical = next(item for item in climate["scenario_presets"] if item["id"] == "typical_wet")
    return (
        float(typical["precipitation_mm"]),
        float(typical["antecedent_rainfall_percentile"]),
    )


TYPICAL_RAIN_MM, TYPICAL_ANTECEDENT = typical_wet_context()


def load_model() -> dict:
    return MODEL


class SeededRandom:
    """Mirror frontend createSeededRandom() exactly at uint32 precision."""

    def __init__(self, seed: int):
        self.state = int(seed) & UINT32_MASK

    def random(self) -> float:
        self.state = (
            LCG_MULTIPLIER * self.state + LCG_INCREMENT
        ) & UINT32_MASK
        return self.state / 4294967296.0


def _stable_project_seed(cell_id: int, intervention_type: str) -> int:
    """Mirror frontend stableProjectSeed() exactly."""
    token = f"{int(cell_id)}:{intervention_type}"
    value = BASE_SEED & UINT32_MASK
    for char in token:
        value ^= ord(char)
        value = (value * PROJECT_HASH_MULTIPLIER) & UINT32_MASK
    return value

def _stable_project_seed_with_base(
    cell_id: int,
    intervention_type: str,
    base_seed: int,
) -> int:
    """Mirror frontend stableProjectSeed(project, baseSeed)."""
    token = f"{int(cell_id)}:{intervention_type}"
    value = int(base_seed) & UINT32_MASK
    for char in token:
        value ^= ord(char)
        value = (value * PROJECT_HASH_MULTIPLIER) & UINT32_MASK
    return value


def _future_project_effect(
    config: dict,
    cell_id: int,
    intervention_type: str,
    future_index: int,
    base_seed: int,
    year: float,
) -> float:
    """Mirror frontend sampleProjectEffectsForFuture()."""
    future_seed = (
        int(base_seed)
        + (((int(future_index) + 1) * 2654435761) & UINT32_MASK)
    ) & UINT32_MASK
    random = SeededRandom(
        _stable_project_seed_with_base(
            cell_id,
            intervention_type,
            future_seed,
        )
    )
    low, high = map(float, config["effectRange"])
    maturity_years = float(config.get("maturityYears", 0))
    maturity = (
        1.0
        if maturity_years <= 0
        else min(1.0, max(0.0, float(year) / maturity_years))
    )
    return (low + (high - low) * random.random()) * maturity


def _lower_quantile(values: np.ndarray, probability: float) -> float:
    """Mirror the frontend's deterministic lower-index quantile."""
    if len(values) == 0:
        return 0.0
    ordered = np.sort(values)
    index = min(
        len(ordered) - 1,
        max(0, int(np.floor(probability * (len(ordered) - 1)))),
    )
    return float(ordered[index])


def _scenario_draws(
    model: dict,
    rain: float,
    wet: float,
    count: int,
    seed: int = BASE_SEED,
):
    uncertainty = model["scenarioUncertainty"]
    rain_low, rain_high = map(float, uncertainty["rainMultiplier"])
    wet_half = float(uncertainty["antecedentWetnessHalfRange"])
    random = SeededRandom(seed)

    rain_values = np.zeros(count, dtype=float)
    wet_values = np.zeros(count, dtype=float)
    for index in range(count):
        rain_multiplier = rain_low + (rain_high - rain_low) * random.random()
        wet_delta = (random.random() * 2 - 1) * wet_half
        rain_values[index] = max(0.0, float(rain) * rain_multiplier)
        wet_values[index] = np.clip(float(wet) + wet_delta, 0, 1)
    return rain_values, wet_values


def _cell_exposure_ensemble(
    model: dict,
    buildings: GeoDataFrame,
    rain: float = TYPICAL_RAIN_MM,
    wet: float = TYPICAL_ANTECEDENT,
    samples: int | None = None,
    seed: int = BASE_SEED,
) -> dict[int, np.ndarray]:
    stress = model["stress"]
    optimizer = model["optimizer"]
    sample_count = int(samples or optimizer["optimizerSamples"])

    spatial_weights = stress["spatialWeights"]
    slope = np.clip(
        pd.to_numeric(buildings["slope_deg"], errors="coerce")
        .fillna(0)
        .to_numpy(float)
        / float(stress["slopeNormalizationDegrees"]),
        0,
        1,
    )
    hazard = (
        buildings["hazard_max"]
        .map(stress["hazardScores"])
        .fillna(stress["hazardScores"]["Baja"])
        .to_numpy(float)
    )
    spatial = (
        float(spatial_weights["hazard"]) * hazard
        + float(spatial_weights["slope"]) * slope
    )
    people = (
        pd.to_numeric(buildings["population_proxy"], errors="coerce")
        .fillna(0)
        .clip(lower=0)
        .to_numpy(float)
    )
    cell_ids = (
        pd.to_numeric(buildings["cell_id"], errors="raise")
        .astype(int)
        .to_numpy()
    )

    rain_draws, wet_draws = _scenario_draws(
        model,
        rain,
        wet,
        sample_count,
        seed=seed,
    )
    rain_norm = stress["rainNormalization"]
    climate_weights = stress["climateWeights"]

    unique_cells = np.unique(cell_ids)
    cell_to_position = {
        cell_id: index for index, cell_id in enumerate(unique_cells)
    }
    ensemble = np.zeros((sample_count, len(unique_cells)), dtype=float)

    for sample_index, (rain_mm, wetness) in enumerate(
        zip(rain_draws, wet_draws)
    ):
        normalized_rain = np.clip(
            (
                rain_mm - float(rain_norm["offsetMm"])
            )
            / float(rain_norm["spanMm"]),
            0,
            1,
        )
        climate = (
            float(climate_weights["base"])
            + float(climate_weights["rain"]) * normalized_rain
            + float(climate_weights["antecedentWetness"]) * wetness
        )
        stress_value = np.clip(spatial * climate, 0, 1)
        exposure = people * stress_value

        for cell_id in unique_cells:
            ensemble[
                sample_index,
                cell_to_position[cell_id],
            ] = exposure[cell_ids == cell_id].sum()

    return {
        int(cell_id): ensemble[:, index]
        for cell_id, index in cell_to_position.items()
    }


def _effect_samples(
    config: dict,
    cell_id: int,
    intervention_type: str,
    sample_count: int,
    year: float,
) -> np.ndarray:
    low, high = map(float, config["effectRange"])
    maturity_years = float(config.get("maturityYears", 0))
    maturity = (
        1.0
        if maturity_years <= 0
        else min(1.0, max(0.0, float(year) / maturity_years))
    )
    random = SeededRandom(_stable_project_seed(cell_id, intervention_type))
    return np.array(
        [
            (low + (high - low) * random.random()) * maturity
            for _ in range(sample_count)
        ],
        dtype=float,
    )


def _cell_factors(
    model: dict,
    cell,
    policy: dict,
) -> tuple[float, float]:
    optimizer = model["optimizer"]
    building_count = max(1.0, float(cell.buildings))
    equity_share = np.clip(
        float(cell.stratum1_buildings) / building_count,
        0,
        1,
    )
    equity_factor = 1 + float(policy["equityWeight"]) * equity_share

    access_m = (
        max(0.0, float(cell.vehicular_access_m))
        + float(optimizer["pedestrianAccessWeight"])
        * max(0.0, float(cell.pedestrian_access_m))
    )
    access_factor = 1 + float(policy["accessWeight"]) * min(
        1,
        access_m / float(optimizer["accessNormalizationMeters"]),
    )
    return equity_factor, access_factor


def build_project_table(
    rain: float = TYPICAL_RAIN_MM,
    wet: float = TYPICAL_ANTECEDENT,
    year: float = 1,
    profile_name: str = "balanced",
):
    model = load_model()
    optimizer = model["optimizer"]
    if profile_name not in optimizer["objectiveProfiles"]:
        raise ValueError(f"Unknown objective profile: {profile_name}")
    policy = optimizer["objectiveProfiles"][profile_name]
    interventions = model["interventions"]

    cells = read_local_geojson(DATA / "planning_cells.geojson")
    buildings = read_local_geojson(DATA / "buildings.geojson")
    exposure_ensemble = _cell_exposure_ensemble(
        model,
        buildings,
        rain,
        wet,
    )

    rows = []
    for _, cell in cells.iterrows():
        cell_id = int(cell.cell_id)
        exposure_samples = exposure_ensemble.get(cell_id)
        if exposure_samples is None or np.max(exposure_samples) <= 0:
            continue

        equity_factor, access_factor = _cell_factors(
            model,
            cell,
            policy,
        )

        for intervention_type, config in interventions.items():
            opportunity = np.clip(
                float(cell[config["opportunityField"]]),
                0,
                1,
            )
            if opportunity < float(optimizer["minOpportunity"]):
                continue

            effects = _effect_samples(
                config,
                cell_id,
                intervention_type,
                len(exposure_samples),
                year,
            )
            project_reduction = np.clip(
                effects * opportunity,
                0,
                float(optimizer["maxLocalReduction"]),
            )
            benefits = exposure_samples * project_reduction
            mean_benefit = float(np.mean(benefits))
            p10_benefit = _lower_quantile(benefits, 0.1)
            downside = max(0.0, mean_benefit - p10_benefit)
            robust_value = (
                mean_benefit
                - float(policy["downsidePenalty"]) * downside
            ) * equity_factor * access_factor

            rows.append(
                {
                    "cell_id": cell_id,
                    "type": intervention_type,
                    "cost": int(config["costCredits"]),
                    "opportunity": float(opportunity),
                    "mean_benefit": mean_benefit,
                    "p10_benefit": p10_benefit,
                    "robust_value": robust_value,
                    "uncertainty_samples": len(exposure_samples),
                }
            )

    return cells, pd.DataFrame(rows)


def _solve_project_table(
    projects: pd.DataFrame,
    budget: int,
    max_projects_per_cell: int,
):
    """Solve one budget against an already-built candidate table."""
    if projects.empty:
        raise RuntimeError("No eligible intervention candidates were generated.")

    n = len(projects)
    objective = -projects["robust_value"].to_numpy(float)
    integrality = np.ones(n, dtype=int)
    bounds = Bounds(np.zeros(n), np.ones(n))

    rows = [projects["cost"].to_numpy(float)]
    lower = [-np.inf]
    upper = [float(budget)]

    for indices in projects.groupby("cell_id").groups.values():
        row = np.zeros(n)
        row[list(indices)] = 1
        rows.append(row)
        lower.append(-np.inf)
        upper.append(max_projects_per_cell)

    constraints = LinearConstraint(
        np.vstack(rows),
        np.array(lower),
        np.array(upper),
    )
    result = milp(
        objective,
        integrality=integrality,
        bounds=bounds,
        constraints=constraints,
        options={"time_limit": 20},
    )

    chosen = (
        projects[np.asarray(result.x) > 0.5].copy()
        if result.success and result.x is not None
        else projects.iloc[0:0].copy()
    )
    return result, chosen


def optimize(
    budget: int = 10,
    rain: float = TYPICAL_RAIN_MM,
    wet: float = TYPICAL_ANTECEDENT,
    year: float = 1,
    profile_name: str = "balanced",
):
    model = load_model()
    max_projects_per_cell = int(
        model["optimizer"]["maxProjectsPerCell"]
    )
    cells, projects = build_project_table(
        rain,
        wet,
        year,
        profile_name=profile_name,
    )
    result, chosen = _solve_project_table(
        projects,
        budget,
        max_projects_per_cell,
    )
    return result, cells, chosen


def reevaluate_nonlinear(
    selected: pd.DataFrame,
    cells: GeoDataFrame,
    rain: float = TYPICAL_RAIN_MM,
    wet: float = TYPICAL_ANTECEDENT,
    year: float = 1,
    samples: int = 500,
) -> dict:
    """Re-evaluate a selected plan with multiplicative stacked effects."""
    if selected.empty:
        return {
            "runs": samples,
            "p10": 0.0,
            "median": 0.0,
            "p90": 0.0,
            "mean": 0.0,
        }

    model = load_model()
    optimizer = model["optimizer"]
    interventions = model["interventions"]
    buildings = read_local_geojson(DATA / "buildings.geojson")
    exposure = _cell_exposure_ensemble(
        model,
        buildings,
        rain,
        wet,
        samples=samples,
        seed=COMPARISON_SEED,
    )
    cells_by_id = {
        int(row.cell_id): row
        for _, row in cells.iterrows()
    }
    total_benefit = np.zeros(samples, dtype=float)

    for cell_id, projects in selected.groupby("cell_id"):
        cell_id = int(cell_id)
        cell = cells_by_id[cell_id]
        remaining = np.ones(samples, dtype=float)

        for _, project in projects.iterrows():
            config = interventions[str(project["type"])]
            opportunity = np.clip(
                float(cell[config["opportunityField"]]),
                0,
                1,
            )
            effects = np.array(
                [
                    _future_project_effect(
                        config,
                        cell_id,
                        str(project["type"]),
                        future_index,
                        COMPARISON_SEED,
                        year,
                    )
                    for future_index in range(samples)
                ],
                dtype=float,
            )
            local_reduction = np.clip(
                effects * opportunity,
                0,
                float(optimizer["maxLocalReduction"]),
            )
            remaining *= 1 - local_reduction

        exposure_samples = exposure.get(cell_id)
        if exposure_samples is not None:
            total_benefit += exposure_samples * (1 - remaining)

    ordered = np.sort(total_benefit)
    return {
        "runs": int(samples),
        "p10": round(_lower_quantile(ordered, 0.1), 4),
        "median": round(_lower_quantile(ordered, 0.5), 4),
        "p90": round(_lower_quantile(ordered, 0.9), 4),
        "mean": round(float(np.mean(ordered)), 4),
    }


def generate_outputs(budgets=range(4, 21)):
    derived = ROOT / "data" / "derived"
    derived.mkdir(parents=True, exist_ok=True)
    frontier_rows = []
    selected_for_10 = None
    cells_for_10 = None
    result_for_10 = None

    model = load_model()
    max_projects_per_cell = int(
        model["optimizer"]["maxProjectsPerCell"]
    )
    cells, projects = build_project_table(
        profile_name="balanced",
    )

    for budget in budgets:
        result, chosen = _solve_project_table(
            projects,
            budget,
            max_projects_per_cell,
        )
        frontier_rows.append(
            {
                "budget_credits": budget,
                "spent": int(chosen.cost.sum()) if len(chosen) else 0,
                "projects": int(len(chosen)),
                "robust_objective_linearized": (
                    float(chosen.robust_value.sum())
                    if len(chosen)
                    else 0.0
                ),
                "mean_benefit_proxy_additive": (
                    float(chosen.mean_benefit.sum())
                    if len(chosen)
                    else 0.0
                ),
                "p10_benefit_proxy_additive": (
                    float(chosen.p10_benefit.sum())
                    if len(chosen)
                    else 0.0
                ),
                "solver_success": bool(result.success),
            }
        )
        if budget == 10:
            selected_for_10 = chosen.copy()
            cells_for_10 = cells.copy()
            result_for_10 = result

    frontier = pd.DataFrame(frontier_rows)
    frontier.to_csv(
        derived / "portfolio_frontier_milp.csv",
        index=False,
    )

    if selected_for_10 is None:
        return None, frontier

    nonlinear = reevaluate_nonlinear(
        selected_for_10,
        cells_for_10,
        samples=CHECKPOINT_MONTE_CARLO_RUNS,
    )
    checkpoint = {
        "solver_success": bool(result_for_10.success),
        "policy_profile": "balanced",
        "policy_weights": load_model()["optimizer"]["objectiveProfiles"]["balanced"],
        "status": (
            "Exact binary budget selection over linearized robust-benefit "
            "coefficients; current effect/cost/climate priors are uncalibrated."
        ),
        "spent": int(selected_for_10.cost.sum()),
        "coefficient_uncertainty_samples": (
            int(selected_for_10.uncertainty_samples.iloc[0])
            if len(selected_for_10)
            else 0
        ),
        "projects": selected_for_10[
            ["cell_id", "type", "cost", "opportunity"]
        ].round(4).to_dict("records"),
        "robust_objective_linearized": round(
            float(selected_for_10.robust_value.sum()),
            3,
        ),
        "nonlinear_portfolio_re_evaluation": nonlinear,
        "warning": (
            "The MILP objective is a linear selection checkpoint. The "
            "nonlinear re-evaluation is the appropriate combined portfolio "
            "benefit proxy, but it is still based on uncalibrated priors."
        ),
    }
    (derived / "milp_checkpoint.json").write_text(
        json.dumps(checkpoint, indent=2) + "\n",
        encoding="utf-8",
    )

    ids = set(selected_for_10.cell_id.astype(int))
    plan_cells = cells_for_10[
        cells_for_10.cell_id.astype(int).isin(ids)
    ].copy()
    plan_cells["selected_projects"] = (
        plan_cells.cell_id.astype(int).map(
            lambda cell_id: ", ".join(
                selected_for_10[
                    selected_for_10.cell_id.astype(int) == cell_id
                ].type.tolist()
            )
        )
    )
    plan_cells.to_file(
        derived / "milp_plan_10credits.geojson",
        driver="GeoJSON",
    )
    return checkpoint, frontier


def generate_policy_crosschecks(
    budget: int = 10,
    rain: float = TYPICAL_RAIN_MM,
    wet: float = TYPICAL_ANTECEDENT,
    year: float = 1,
):
    """Solve every named policy lens with the formal binary model."""
    model = load_model()
    optimizer = model["optimizer"]
    output = []

    for profile_name, policy in optimizer["objectiveProfiles"].items():
        cells, projects = build_project_table(
            rain,
            wet,
            year,
            profile_name=profile_name,
        )
        result, chosen = _solve_project_table(
            projects,
            budget,
            int(optimizer["maxProjectsPerCell"]),
        )
        nonlinear = reevaluate_nonlinear(
            chosen,
            cells,
            rain=rain,
            wet=wet,
            year=year,
            samples=CHECKPOINT_MONTE_CARLO_RUNS,
        )

        output.append(
            {
                "profile_id": profile_name,
                "policy": policy,
                "solver_success": bool(result.success),
                "budget_credits": int(budget),
                "spent_credits": (
                    int(chosen.cost.sum()) if len(chosen) else 0
                ),
                "projects": chosen[
                    ["cell_id", "type", "cost", "opportunity"]
                ].round(4).to_dict("records"),
                "linearized_robust_objective": (
                    round(float(chosen.robust_value.sum()), 4)
                    if len(chosen)
                    else 0.0
                ),
                "nonlinear_re_evaluation": nonlinear,
                "warning": (
                    "Formal selection uses linearized development coefficients; "
                    "nonlinear re-evaluation remains based on uncalibrated priors."
                ),
            }
        )

    destination = (
        ROOT / "data" / "derived" / "milp_policy_alternatives.json"
    )
    destination.write_text(
        json.dumps(output, indent=2) + "\n",
        encoding="utf-8",
    )
    return output


if __name__ == "__main__":
    checkpoint, frontier = generate_outputs()
    policy_crosschecks = generate_policy_crosschecks()
    print(json.dumps(checkpoint, indent=2))
    print("\nFrontier rows:", len(frontier))
    print("\nPolicy MILP cross-checks:")
    for item in policy_crosschecks:
        print(
            f"- {item['profile_id']}: "
            f"{len(item['projects'])} projects, "
            f"{item['spent_credits']} credits, "
            f"P10={item['nonlinear_re_evaluation']['p10']:.4f}, "
            f"median={item['nonlinear_re_evaluation']['median']:.4f}"
        )
