import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REFERENCE_CONFIG,
  evaluatePlansPaired,
  pairedBootstrapCI,
  relativeDelta,
  selectAllStrategyPlans,
  trialEvaluationSeed,
  winEqualLoss,
} from '../src/domain/redTeamBenchmark.js';
import { selectGreedyOpportunityPortfolio } from '../src/domain/benchmark.js';
import { createScenarioContext } from '../src/domain/scenarioEngine.js';

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
        population_proxy: 100,
        rwh_opportunity: 1,
        drainage_corridor_proxy: 0.9,
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
        buildings: 2,
        high_hazard_buildings: 0,
        stratum1_buildings: 0,
        population_proxy: 1,
        rwh_opportunity: 0.99,
        drainage_corridor_proxy: 0.2,
        restoration_opportunity: 0.2,
        roof_footprint_m2: 50,
        vehicular_access_m: 10,
        pedestrian_access_m: 10,
      },
      geometry: null,
    },
  ],
};

const buildings = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        objectid: 1,
        cell_id: 1,
        hazard_max: 'Alta',
        slope_deg: 30,
        population_proxy: 100,
        estrato: 1,
      },
      geometry: null,
    },
    {
      type: 'Feature',
      properties: {
        objectid: 2,
        cell_id: 2,
        hazard_max: 'Baja',
        slope_deg: 5,
        population_proxy: 1,
        estrato: 3,
      },
      geometry: null,
    },
  ],
};

const scenario = { rainMm: 95, antecedentWetness: 0.45, planningYear: 1 };

test('greedy ranks by opportunity per own cost credit', () => {
  // Drainage: 0.9/3=0.3; RWH cell2: 0.99/1=0.99 should beat drainage if packing starts with highest ratio
  const greedy = selectGreedyOpportunityPortfolio({ cellsGeoJson: cells, budgetCredits: 1 });
  assert.equal(greedy.plan[0].type, 'rwh');
  assert.ok([1, 2].includes(greedy.plan[0].cell_id));
});

test('trial evaluation seeds are deterministic from root seed', () => {
  assert.equal(trialEvaluationSeed(20260912, 0), 20260912);
  assert.equal(trialEvaluationSeed(20260912, 1), (20260912 + 9973) >>> 0);
  assert.equal(trialEvaluationSeed(20260912, 1), trialEvaluationSeed(20260912, 1));
});

test('paired evaluation shares one seed across strategies', () => {
  const context = createScenarioContext(buildings, cells);
  const plans = selectAllStrategyPlans({
    context,
    cellsGeoJson: cells,
    scenario,
    budgetCredits: 4,
    profile: 'balanced',
    randomSeed: 11,
  });
  const a = evaluatePlansPaired({
    context,
    scenario,
    plans,
    budgetCredits: 4,
    evaluationSeed: 12345,
    runs: 20,
  });
  const b = evaluatePlansPaired({
    context,
    scenario,
    plans,
    budgetCredits: 4,
    evaluationSeed: 12345,
    runs: 20,
  });
  for (const id of Object.keys(a)) {
    assert.equal(a[id].p10, b[id].p10);
  }
});

test('bootstrap CI is deterministic under fixed seed', () => {
  const deltas = [1, 2, 3, 4, 5, -1, 0.5];
  const x = pairedBootstrapCI(deltas, { samples: 200, seed: 424242 });
  const y = pairedBootstrapCI(deltas, { samples: 200, seed: 424242 });
  assert.deepEqual(x.ci95, y.ci95);
  assert.equal(x.mean, y.mean);
});

test('relative delta flags near-zero denominators', () => {
  const unsafe = relativeDelta(10, 0.0000001);
  assert.equal(unsafe.unsafe_relative, true);
  assert.equal(unsafe.relative, null);
  const safe = relativeDelta(110, 100);
  assert.equal(safe.unsafe_relative, false);
  assert.ok(Math.abs(safe.relative - 0.1) < 1e-12);
});

test('winEqualLoss rates sum to one', () => {
  const wel = winEqualLoss([1, -1, 0, 2, -0.5]);
  assert.equal(wel.n, 5);
  assert.ok(Math.abs(wel.winRate + wel.lossRate + wel.equalRate - 1) < 1e-12);
});

test('reference config separates smoke and full trials', () => {
  assert.ok(REFERENCE_CONFIG.smokeTrials >= 100);
  assert.ok(REFERENCE_CONFIG.trials >= 100);
  assert.ok(REFERENCE_CONFIG.trials >= REFERENCE_CONFIG.smokeTrials);
});

test('evidence freeze manifest schema', async () => {
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const freeze = JSON.parse(
    readFileSync(join(root, 'data/derived/cicsic_evidence_freeze.json'), 'utf8'),
  );
  assert.equal(freeze.schema, 'ourea-cicsic-evidence-freeze');
  assert.equal(freeze.protocol.trials, 500);
  assert.equal(freeze.protocol.rootSeed, 20260912);
  assert.ok(freeze.artifacts['frontend/src/config/modelParameters.json']);
  assert.ok(freeze.statement.includes('must not be modified for presentation'));
});

test('budget and uncertainty sweep schemas', async () => {
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const budget = JSON.parse(
    readFileSync(join(root, 'data/derived/cicsic_budget_sweep.json'), 'utf8'),
  );
  const unc = JSON.parse(
    readFileSync(join(root, 'data/derived/cicsic_uncertainty_sweep.json'), 'utf8'),
  );
  assert.ok(Array.isArray(budget.budgetSweep));
  assert.ok(budget.budgetSweep.every((r) => 'delta_mean' in r && 'budget' in r));
  assert.ok(Array.isArray(unc.uncertaintySweep));
  assert.ok(unc.uncertaintySweep.every((r) => ['low', 'base', 'high'].includes(r.regime)));
});

test('withEffectRangeMultiplier scales ranges without mutating canonical params', async () => {
  const { INTERVENTIONS } = await import('../src/config/modelConfig.js');
  const {
    scaledEffectRange,
    withEffectRangeMultiplier,
  } = await import('../src/domain/interventionModel.js');
  const base = [...INTERVENTIONS.rwh.effectRange];
  const scaled = withEffectRangeMultiplier(1.2, () => scaledEffectRange('rwh'));
  assert.deepEqual([...INTERVENTIONS.rwh.effectRange], base);
  assert.ok(Math.abs(scaled[0] - base[0] * 1.2) < 1e-12);
  assert.deepEqual(scaledEffectRange('rwh'), base);
});
