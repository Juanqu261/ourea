import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareSelectionStrategies,
  selectDeterministicPortfolio,
  selectHazardOnlyPortfolio,
} from '../src/domain/benchmark.js';
import { diagnosePortfolioBreaks } from '../src/domain/sensitivity.js';
import { createScenarioContext } from '../src/domain/scenarioEngine.js';
import { MODEL_PARAMETERS } from '../src/config/modelConfig.js';

const buildings = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        objectid: 1,
        cell_id: 1,
        hazard_max: 'Alta',
        slope_deg: 35,
        population_proxy: 10,
        estrato: 1,
      },
      geometry: null,
    },
    {
      type: 'Feature',
      properties: {
        objectid: 2,
        cell_id: 2,
        hazard_max: 'Media',
        slope_deg: 20,
        population_proxy: 5,
        estrato: 2,
      },
      geometry: null,
    },
  ],
};

const cells = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        cell_id: 1,
        buildings: 10,
        high_hazard_buildings: 8,
        stratum1_buildings: 10,
        rwh_opportunity: 1,
        drainage_corridor_proxy: 0.8,
        restoration_opportunity: 0.5,
        roof_footprint_m2: 1000,
        vehicular_access_m: 200,
        pedestrian_access_m: 100,
      },
      geometry: null,
    },
    {
      type: 'Feature',
      properties: {
        cell_id: 2,
        buildings: 5,
        high_hazard_buildings: 1,
        stratum1_buildings: 4,
        rwh_opportunity: 0.4,
        drainage_corridor_proxy: 0.7,
        restoration_opportunity: 0.9,
        roof_footprint_m2: 500,
        vehicular_access_m: 100,
        pedestrian_access_m: 150,
      },
      geometry: null,
    },
  ],
};

const scenario = { rainMm: 95, antecedentWetness: 0.45, planningYear: 1 };

test('hazard-only selection stays inside the budget and prefers high-hazard cells', () => {
  const selected = selectHazardOnlyPortfolio({
    cellsGeoJson: cells,
    budgetCredits: 4,
  });
  assert.equal(selected.selectionMethod, 'hazard-only-greedy');
  assert.ok(selected.spentCredits <= 4);
  assert.ok(selected.plan.every((project) => project.cell_id === 1));
});

test('deterministic and robust comparisons are seed-stable', () => {
  const context = createScenarioContext(buildings, cells);
  const first = compareSelectionStrategies({
    context,
    cellsGeoJson: cells,
    scenario,
    budgetCredits: 4,
  });
  const second = compareSelectionStrategies({
    context,
    cellsGeoJson: cells,
    scenario,
    budgetCredits: 4,
  });
  assert.equal(first.seed, MODEL_PARAMETERS.scenarioUncertainty.comparisonSeed);
  assert.deepEqual(first.strategies.map((item) => item.plan), second.strategies.map((item) => item.plan));
  assert.equal(first.strategies.length, 5);
  assert.ok(first.strategies.some((item) => item.id === 'random_feasible'));
  assert.ok(first.strategies.some((item) => item.id === 'greedy_opportunity'));
  assert.ok(first.strategies.every((item) => item.budgetFeasible));
  const robust = first.strategies.find((item) => item.id === 'ourea_robust');
  assert.equal(robust.p10RegretVersusRobust, 0);
  assert.equal(robust.p10DeltaVersusRobust, 0);
  const hazard = first.strategies.find((item) => item.id === 'hazard_only');
  if (hazard.p10 < robust.p10) {
    assert.ok(hazard.p10DeltaVersusRobust < 0);
    assert.equal(
      hazard.p10RegretVersusRobust,
      Number((robust.p10 - hazard.p10).toFixed(4)),
    );
  }
  assert.ok(first.strategies.every((item) => Number.isFinite(item.median)));
  assert.ok(first.strategies.every((item) => Number.isFinite(item.p10)));
});

test('frozen deterministic selection does not sample an uncertainty ensemble', () => {
  const context = createScenarioContext(buildings, cells);
  const selected = selectDeterministicPortfolio({
    context,
    cellsGeoJson: cells,
    scenario,
    budgetCredits: 4,
  });
  assert.equal(selected.selectionMethod, 'deterministic-central-scenario');
  assert.equal(selected.diagnostics.scenarioSamples, 1);
});

test('portfolio breakage reports threshold breaches and assumption influence', () => {
  const context = createScenarioContext(buildings, cells);
  const robust = compareSelectionStrategies({
    context,
    cellsGeoJson: cells,
    scenario,
    budgetCredits: 4,
  }).strategies.find((item) => item.id === 'ourea_robust');
  const breakage = diagnosePortfolioBreaks({
    context,
    cellsGeoJson: cells,
    plan: robust.plan,
    alternativePlan: [{ cell_id: 2, type: 'restoration' }],
    scenario,
    budgetCredits: 4,
  });
  assert.ok(breakage.breachThreshold <= breakage.referenceBenefit);
  assert.ok(Array.isArray(breakage.scenarioCombinationsBelowThreshold));
  assert.ok(Array.isArray(breakage.oneAtATime));
  assert.ok(
    breakage.oneAtATime.some((item) => item.assumption === 'rainfall'),
  );
  assert.ok(
    breakage.oneAtATime.some((item) => item.assumption === 'antecedent_rainfall'),
  );
  assert.match(breakage.note, /scenario combinations, not spatial grid cells/i);
  assert.ok(breakage.versusAlternative);
});
