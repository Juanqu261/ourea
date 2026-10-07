import { MODEL_LIMITS, MODEL_PARAMETERS } from '../config/modelConfig.js';
import { baselineStress } from './climateStress.js';
import {
  cellReduction,
  indexProjectsByCell,
  sampleProjectEffectsForFuture,
} from './interventionModel.js';
import { mean, quantile } from '../utils/math.js';
import { scenarioEnsemble } from './uncertainty.js';

export function createScenarioContext(buildingsGeoJson, cellsGeoJson) {
  return Object.freeze({
    buildings: buildingsGeoJson.features,
    cellsById: new Map(
      cellsGeoJson.features.map((feature) => [
        Number(feature.properties.cell_id),
        feature.properties,
      ]),
    ),
  });
}

export function evaluatePortfolio({
  context,
  projects,
  scenario,
  sampledEffects = null,
  stressModel = baselineStress,
}) {
  const projectsByCell = indexProjectsByCell(projects);
  let baselineExposure = 0;
  let residualExposure = 0;
  let population = 0;
  let buildingsAboveThreshold = 0;
  let populationAboveThreshold = 0;
  let equityBenefit = 0;
  let accessBenefit = 0;

  for (const feature of context.buildings) {
    const properties = feature.properties;
    const cellId = Number(properties.cell_id);
    const cell = context.cellsById.get(cellId);
    const base = stressModel(properties, scenario);
    const reduction = cell
      ? cellReduction({
          cell,
          projects: projectsByCell.get(cellId) ?? [],
          planningYear: scenario.planningYear,
          sampledEffects,
        })
      : 0;
    const residual = base * (1 - reduction);
    const people = Math.max(0, Number(properties.population_proxy ?? 0));

    const localBenefit = people * (base - residual);
    const stratum = Number(properties.estrato ?? 0);
    const equityWeight = stratum === 1 ? 1 : 0;
    const accessMeters =
      Math.max(0, Number(cell?.vehicular_access_m ?? 0)) +
      MODEL_PARAMETERS.optimizer.pedestrianAccessWeight *
        Math.max(0, Number(cell?.pedestrian_access_m ?? 0));
    const accessIndex = Math.min(
      1,
      accessMeters / MODEL_PARAMETERS.optimizer.accessNormalizationMeters,
    );

    baselineExposure += people * base;
    residualExposure += people * residual;
    equityBenefit += localBenefit * equityWeight;
    accessBenefit += localBenefit * accessIndex;
    population += people;

    if (residual >= MODEL_LIMITS.stressThreshold) {
      buildingsAboveThreshold += 1;
      populationAboveThreshold += people;
    }
  }

  return {
    baselineExposure,
    residualExposure,
    benefit: baselineExposure - residualExposure,
    population,
    equityBenefit,
    accessBenefit,
    buildingsAboveThreshold,
    populationAboveThreshold,
  };
}

export function monteCarloPortfolio({
  context,
  projects,
  scenario,
  runs = MODEL_LIMITS.monteCarloRuns,
  seed = MODEL_PARAMETERS.scenarioUncertainty.monteCarloSeed,
  stressModel = baselineStress,
}) {
  if (!projects.length || runs <= 0) {
    return { p10: 0, median: 0, p90: 0, mean: 0, runs: Math.max(0, runs) };
  }

  const benefits = [];
  const scenarios = scenarioEnsemble(scenario, runs, seed);

  for (let index = 0; index < scenarios.length; index += 1) {
    const sampledEffects = sampleProjectEffectsForFuture(
      projects,
      index,
      seed,
    );
    const result = evaluatePortfolio({
      context,
      projects,
      scenario: scenarios[index],
      sampledEffects,
      stressModel,
    });
    benefits.push(result.benefit);
  }

  benefits.sort((a, b) => a - b);
  return {
    p10: quantile(benefits, 0.1),
    median: quantile(benefits, 0.5),
    p90: quantile(benefits, 0.9),
    mean: mean(benefits),
    runs,
  };
}

export function buildingStressGeoJson({
  context,
  projects,
  scenario,
  originalGeoJson,
  stressModel = baselineStress,
}) {
  const projectsByCell = indexProjectsByCell(projects);

  originalGeoJson.features.forEach((feature, index) => {
    if (feature.id == null) feature.id = index + 1;
    const properties = feature.properties;
    const cellId = Number(properties.cell_id);
    const cell = context.cellsById.get(cellId);
    const reduction = cell
      ? cellReduction({
          cell,
          projects: projectsByCell.get(cellId) ?? [],
          planningYear: scenario.planningYear,
        })
      : 0;
    properties.scenario_stress = stressModel(properties, scenario) * (1 - reduction);
  });

  return originalGeoJson;
}
