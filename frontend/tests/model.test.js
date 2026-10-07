import test from 'node:test';
import assert from 'node:assert/strict';
import { baselineStress, climateMultiplier } from '../src/domain/climateStress.js';
import {
  MODEL_LIMITS,
  MODEL_PARAMETERS,
  OBJECTIVE_PROFILES,
} from '../src/config/modelConfig.js';
import {
  capturedRainwaterVolumeM3,
  cellReduction,
  maturityFactor,
  sampleProjectEffects,
  sampleProjectEffectsForFuture,
} from '../src/domain/interventionModel.js';
import {
  createScenarioContext,
  evaluatePortfolio,
  monteCarloPortfolio,
} from '../src/domain/scenarioEngine.js';
import {
  fitPlanToBudget,
  optimizeRobustPortfolio,
  planCostCredits,
  objectiveProfile,
} from '../src/domain/optimizer.js';
import { sampleScenario, scenarioEnsemble, stableProjectSeed } from '../src/domain/uncertainty.js';
import { budgetRobustnessFrontier } from '../src/domain/frontier.js';
import { portfolioSelectionStability } from '../src/domain/stability.js';
import {
  buildDecisionPackage,
  DECISION_PACKAGE_SCHEMA,
  DECISION_PACKAGE_SCHEMA_VERSION,
  SCIENTIFIC_GUARDRAILS,
} from '../src/domain/decisionPackage.js';
import {
  generateAlternativePortfolios,
  policyConsensus,
} from '../src/domain/alternatives.js';
import { sampledParetoSet } from '../src/domain/pareto.js';

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

test('climate multiplier and stress increase with wetter scenarios', () => {
  const dry = climateMultiplier({ rainMm: 40, antecedentWetness: 0.1 });
  const wet = climateMultiplier({ rainMm: 150, antecedentWetness: 0.9 });
  assert.ok(wet > dry);

  const properties = buildings.features[0].properties;
  assert.ok(
    baselineStress(properties, { rainMm: 150, antecedentWetness: 0.9 }) >
      baselineStress(properties, { rainMm: 40, antecedentWetness: 0.1 }),
  );
});

test('restoration has a maturity delay while immediate interventions do not', () => {
  assert.equal(maturityFactor('rwh', 1), 1);
  assert.equal(maturityFactor('drainage', 1), 1);
  assert.ok(Math.abs(maturityFactor('restoration', 1) - 1 / 3) < 1e-12);
  assert.equal(maturityFactor('restoration', 4), 1);
});

test('project effect is sampled once and reused by project key', () => {
  const projects = [{ cell_id: 1, type: 'rwh' }];
  const effects = sampleProjectEffects(projects, () => 0.5);
  assert.equal(effects.size, 1);

  const cell = cells.features[0].properties;
  const first = cellReduction({ cell, projects, planningYear: 1, sampledEffects: effects });
  const second = cellReduction({ cell, projects, planningYear: 1, sampledEffects: effects });
  assert.equal(first, second);
  assert.ok(first > 0);
});

test('no-action portfolio has zero intervention benefit', () => {
  const context = createScenarioContext(buildings, cells);
  const result = evaluatePortfolio({ context, projects: [], scenario });
  assert.ok(Math.abs(result.benefit) < 1e-12);
  assert.ok(Math.abs(result.baselineExposure - result.residualExposure) < 1e-12);
});

test('intervention portfolio cannot increase residual exposure', () => {
  const context = createScenarioContext(buildings, cells);
  const result = evaluatePortfolio({
    context,
    projects: [{ cell_id: 1, type: 'drainage' }],
    scenario,
  });
  assert.ok(result.benefit >= 0);
  assert.ok(result.residualExposure <= result.baselineExposure);
});

test('Monte Carlo produces ordered uncertainty quantiles', () => {
  const context = createScenarioContext(buildings, cells);
  const result = monteCarloPortfolio({
    context,
    projects: [{ cell_id: 1, type: 'rwh' }],
    scenario,
    runs: 100,
    seed: 42,
  });
  assert.equal(result.runs, 100);
  assert.ok(result.p10 <= result.median);
  assert.ok(result.median <= result.p90);
  assert.ok(result.mean > 0);
});

test('RWH captured volume respects rainfall runoff and storage caps', () => {
  const projects = [{ cell_id: 1, type: 'rwh' }];
  const lowRain = capturedRainwaterVolumeM3(cells, projects, 10);
  const hugeRain = capturedRainwaterVolumeM3(cells, projects, 1000);
  assert.ok(lowRain > 0);
  assert.ok(hugeRain >= lowRain);
  assert.ok(hugeRain <= 1.5 * 10 * 0.25 + 1e-12);
});

test('robust optimizer respects budget, uniqueness, and max projects per cell', () => {
  const context = createScenarioContext(buildings, cells);
  const result = optimizeRobustPortfolio({
    context,
    cellsGeoJson: cells,
    scenario,
    budgetCredits: 5,
  });
  assert.ok(result.spentCredits <= 5);
  assert.equal(result.spentCredits, planCostCredits(result.plan));
  const keys = new Set(result.plan.map((project) => `${project.cell_id}:${project.type}`));
  assert.equal(keys.size, result.plan.length);
  const counts = new Map();
  for (const project of result.plan) {
    counts.set(project.cell_id, (counts.get(project.cell_id) ?? 0) + 1);
  }
  assert.ok([...counts.values()].every((count) => count <= 2));
});

test('fitPlanToBudget never exceeds budget', () => {
  const plan = [
    { cell_id: 1, type: 'drainage' },
    { cell_id: 1, type: 'rwh' },
    { cell_id: 2, type: 'restoration' },
  ];
  const fitted = fitPlanToBudget(plan, 4);
  assert.ok(planCostCredits(fitted) <= 4);
});


test('scenario uncertainty is deterministic and remains within configured bounds', () => {
  const first = scenarioEnsemble(scenario, 12, 12345);
  const second = scenarioEnsemble(scenario, 12, 12345);
  assert.deepEqual(first, second);
  assert.equal(first.length, 12);

  const [rainLow, rainHigh] = MODEL_PARAMETERS.scenarioUncertainty.rainMultiplier;
  const wetHalfRange = MODEL_PARAMETERS.scenarioUncertainty.antecedentWetnessHalfRange;
  for (const draw of first) {
    assert.ok(draw.rainMm >= scenario.rainMm * rainLow - 1e-12);
    assert.ok(draw.rainMm <= scenario.rainMm * rainHigh + 1e-12);
    assert.ok(draw.antecedentWetness >= Math.max(0, scenario.antecedentWetness - wetHalfRange) - 1e-12);
    assert.ok(draw.antecedentWetness <= Math.min(1, scenario.antecedentWetness + wetHalfRange) + 1e-12);
    assert.equal(draw.planningYear, scenario.planningYear);
  }
});

test('scenario sampler clamps wetness to physical bounds', () => {
  const high = sampleScenario(
    { ...scenario, antecedentWetness: 0.99 },
    (() => {
      const values = [0.5, 1];
      let index = 0;
      return () => values[index++] ?? 1;
    })(),
  );
  assert.equal(high.antecedentWetness, 1);

  const low = sampleScenario(
    { ...scenario, antecedentWetness: 0.01 },
    (() => {
      const values = [0.5, 0];
      let index = 0;
      return () => values[index++] ?? 0;
    })(),
  );
  assert.equal(low.antecedentWetness, 0);
});

test('stable project seed is repeatable and distinguishes project keys', () => {
  const a = stableProjectSeed({ cell_id: 1, type: 'rwh' });
  const b = stableProjectSeed({ cell_id: 1, type: 'rwh' });
  const c = stableProjectSeed({ cell_id: 1, type: 'drainage' });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('robust optimizer uses configured scenario ensemble and positive marginal objective', () => {
  const context = createScenarioContext(buildings, cells);
  const result = optimizeRobustPortfolio({
    context,
    cellsGeoJson: cells,
    scenario,
    budgetCredits: 5,
  });
  assert.equal(result.diagnostics.scenarioSamples, MODEL_LIMITS.optimizerSamples);
  assert.equal(result.diagnostics.selectionMethod, 'marginal-robust-greedy');
  assert.ok(result.diagnostics.candidateCount > 0);
  assert.ok(result.diagnostics.robustObjectiveProxy > 0);
});

test('fitPlanToBudget removes duplicates, invalid interventions, and excessive stacking', () => {
  const plan = [
    { cell_id: 1, type: 'rwh' },
    { cell_id: 1, type: 'rwh' }, // duplicate
    { cell_id: 1, type: 'drainage' },
    { cell_id: 1, type: 'restoration' }, // third project in same cell
    { cell_id: 2, type: 'unknown' },
    { cell_id: Number.NaN, type: 'rwh' },
    { cell_id: 2, type: 'rwh' },
  ];
  const fitted = fitPlanToBudget(plan, 20);
  assert.deepEqual(fitted, [
    { cell_id: 1, type: 'rwh' },
    { cell_id: 1, type: 'drainage' },
    { cell_id: 2, type: 'rwh' },
  ]);
});

test('model parameter weights and ranges satisfy structural invariants', () => {
  const { stress, interventions, optimizer, scenarioUncertainty } = MODEL_PARAMETERS;
  const spatialWeightSum = stress.spatialWeights.hazard + stress.spatialWeights.slope;
  assert.ok(Math.abs(spatialWeightSum - 1) < 1e-12);

  const climateWeightSum =
    stress.climateWeights.base +
    stress.climateWeights.rain +
    stress.climateWeights.antecedentWetness;
  assert.ok(Math.abs(climateWeightSum - 1) < 1e-12);

  assert.ok(stress.threshold > 0 && stress.threshold < 1);
  assert.ok(optimizer.optimizerSamples > 0);
  assert.ok(optimizer.monteCarloRuns > 0);
  assert.ok(optimizer.frontierMonteCarloRuns > 0);
  assert.ok(optimizer.frontierScenarioSamples > 0);
  assert.ok(optimizer.stabilityRuns > 0);
  assert.ok(optimizer.stabilityScenarioSamples > 0);
  assert.ok(optimizer.checkpointMonteCarloRuns > 0);
  assert.ok(optimizer.maxProjectsPerCell >= 1);
  assert.equal(Object.keys(optimizer.objectiveProfiles).length, 4);
  for (const profile of Object.values(optimizer.objectiveProfiles)) {
    assert.ok(profile.equityWeight >= 0);
    assert.ok(profile.accessWeight >= 0);
    assert.ok(profile.downsidePenalty >= 0);
  }
  assert.ok(optimizer.paretoGrid.equityWeights.length >= 2);
  assert.ok(optimizer.paretoGrid.accessWeights.length >= 2);
  assert.ok(optimizer.paretoGrid.optimizerScenarioSamples > 0);
  assert.ok(optimizer.paretoGrid.monteCarloRuns > 0);
  assert.ok(optimizer.maxLocalReduction > 0 && optimizer.maxLocalReduction <= 1);

  for (const config of Object.values(interventions)) {
    const [low, high] = config.effectRange;
    assert.ok(low >= 0 && high >= low && high <= 1);
    assert.ok(config.costCredits > 0);
  }

  const [rainLow, rainHigh] = scenarioUncertainty.rainMultiplier;
  assert.ok(rainLow > 0 && rainHigh >= rainLow);
  assert.ok(scenarioUncertainty.antecedentWetnessHalfRange >= 0);
  assert.ok(Number.isInteger(scenarioUncertainty.baseSeed));
  assert.ok(Number.isInteger(scenarioUncertainty.monteCarloSeed));
  assert.ok(Number.isInteger(scenarioUncertainty.comparisonSeed));
});


test('seeded uncertainty fixture remains cross-language reproducible', () => {
  const seed = stableProjectSeed({ cell_id: 35, type: 'rwh' });
  assert.equal(seed, 1249792281);

  const draws = scenarioEnsemble(scenario, 3, 20260818);
  assert.ok(Math.abs(draws[0].rainMm - 91.92791593084112) < 1e-12);
  assert.ok(Math.abs(draws[0].antecedentWetness - 0.5115487693995238) < 1e-12);
  assert.ok(Math.abs(draws[1].rainMm - 95.19390029413627) < 1e-12);
  assert.ok(Math.abs(draws[2].rainMm - 104.93739998685197) < 1e-12);
});


test('duplicate RWH project keys do not double-count captured volume', () => {
  const unique = capturedRainwaterVolumeM3(
    cells,
    [{ cell_id: 1, type: 'rwh' }],
    100,
  );
  const duplicated = capturedRainwaterVolumeM3(
    cells,
    [
      { cell_id: 1, type: 'rwh' },
      { cell_id: 1, type: 'rwh' },
    ],
    100,
  );
  assert.equal(duplicated, unique);
});


test('future-keyed project effects are invariant to portfolio order', () => {
  const firstOrder = [
    { cell_id: 1, type: 'rwh' },
    { cell_id: 2, type: 'drainage' },
  ];
  const secondOrder = [...firstOrder].reverse();

  const a = sampleProjectEffectsForFuture(firstOrder, 7, 7301);
  const b = sampleProjectEffectsForFuture(secondOrder, 7, 7301);

  for (const project of firstOrder) {
    const key = `${project.cell_id}:${project.type}`;
    assert.equal(a.get(key), b.get(key));
  }
});

test('Monte Carlo portfolio distribution is invariant to project ordering', () => {
  const context = createScenarioContext(buildings, cells);
  const firstOrder = [
    { cell_id: 1, type: 'rwh' },
    { cell_id: 2, type: 'drainage' },
  ];
  const secondOrder = [...firstOrder].reverse();

  const a = monteCarloPortfolio({
    context,
    projects: firstOrder,
    scenario,
    runs: 80,
    seed: 7301,
  });
  const b = monteCarloPortfolio({
    context,
    projects: secondOrder,
    scenario,
    runs: 80,
    seed: 7301,
  });

  assert.deepEqual(a, b);
});

test('budget robustness frontier is ordered, budget-feasible, and uncertainty-ordered', () => {
  const context = createScenarioContext(buildings, cells);
  const frontier = budgetRobustnessFrontier({
    context,
    cellsGeoJson: cells,
    scenario,
    budgets: [8, 4, 8],
    optimizerScenarioSamples: 20,
    monteCarloRuns: 30,
  });

  assert.deepEqual(frontier.map((point) => point.budgetCredits), [4, 8]);
  for (const point of frontier) {
    assert.ok(point.spentCredits <= point.budgetCredits);
    assert.ok(point.p10 <= point.median);
    assert.ok(point.median <= point.p90);
    assert.ok(point.downsideRetention >= 0);
    assert.ok(point.downsideRetention <= 1 + 1e-12);
  }
});

test('decision package preserves scientific guardrails and portfolio mode', () => {
  const context = createScenarioContext(buildings, cells);
  const projects = [{ cell_id: 1, type: 'rwh' }];
  const metrics = evaluatePortfolio({ context, projects, scenario });
  const baseline = evaluatePortfolio({ context, projects: [], scenario });
  const uncertainty = monteCarloPortfolio({
    context,
    projects,
    scenario,
    runs: 20,
    seed: 7301,
  });

  const payload = buildDecisionPackage({
    scenario,
    budgetCredits: 10,
    view: 'user',
    cityLens: 'balanced',
    selectedAiProfileId: 'balanced',
    projects,
    metrics,
    baseline,
    monteCarlo: uncertainty,
    frontier: null,
    aiDiagnostics: null,
    alternatives: [],
    stability: null,
    pareto: null,
    summary: { buildings: 2, population_proxy: 15 },
    evidence: { global_guardrails: ['test'] },
  });

  assert.equal(payload.schema, DECISION_PACKAGE_SCHEMA);
  assert.equal(payload.schema_version, DECISION_PACKAGE_SCHEMA_VERSION);
  assert.equal(payload.portfolio_mode, 'user');
  assert.equal(payload.budget.unit, 'planning-credit-not-COP');
  assert.equal(payload.portfolio.length, 1);
  assert.equal(payload.scope.city_screen_lens, 'balanced');
  assert.equal(payload.selected_ai_policy, 'balanced');
  assert.ok(Number.isFinite(payload.deterministic_metrics.equity_benefit_proxy));
  assert.ok(Number.isFinite(payload.deterministic_metrics.access_benefit_proxy));
  assert.deepEqual(payload.guardrails, SCIENTIFIC_GUARDRAILS);
  assert.ok(payload.guardrails.some((item) => item.includes('not landslide probability')));
  assert.ok(payload.guardrails.some((item) => item.includes('not COP')));
  assert.equal(payload.community_safeguards.validation_status, 'not_assessed');
  assert.equal(payload.community_safeguards.not_assessed_count, 1);
  assert.ok(
    payload.community_safeguards.guardrail.includes('not a prediction'),
  );
});


test('portfolio stability frequencies are bounded and selection counts reconcile', () => {
  const context = createScenarioContext(buildings, cells);
  const stability = portfolioSelectionStability({
    context,
    cellsGeoJson: cells,
    scenario,
    budgetCredits: 5,
    scenarioSamples: 15,
  });

  assert.equal(stability.runCount, MODEL_LIMITS.stabilityRuns);
  assert.equal(stability.plans.length, MODEL_LIMITS.stabilityRuns);
  const scenarioSeeds = new Set(stability.plans.map((plan) => plan.scenarioSeed));
  const projectSeeds = new Set(stability.plans.map((plan) => plan.projectSeedBase));
  assert.equal(scenarioSeeds.size, stability.runCount);
  assert.equal(projectSeeds.size, stability.runCount);

  for (const project of stability.projects) {
    assert.ok(project.frequency > 0);
    assert.ok(project.frequency <= 1);
    assert.equal(
      project.frequency,
      project.selections / stability.runCount,
    );
  }

  const repeated = portfolioSelectionStability({
    context,
    cellsGeoJson: cells,
    scenario,
    budgetCredits: 5,
  });
  assert.deepEqual(repeated.projects, stability.projects);
});


test('objective profiles are explicit, complete, and reject unknown names', () => {
  assert.deepEqual(
    Object.keys(OBJECTIVE_PROFILES).sort(),
    ['access', 'balanced', 'equity', 'low_regret'].sort(),
  );
  assert.equal(objectiveProfile('balanced').label, 'Balanced');
  assert.throws(() => objectiveProfile('not-a-policy'), /Unknown objective profile/);
});

test('robust policy alternatives are all budget-feasible and share the same comparison runs', () => {
  const context = createScenarioContext(buildings, cells);
  const alternatives = generateAlternativePortfolios({
    context,
    cellsGeoJson: cells,
    scenario,
    budgetCredits: 5,
  });

  assert.equal(alternatives.length, 4);
  assert.deepEqual(
    alternatives.map((item) => item.profileId).sort(),
    Object.keys(OBJECTIVE_PROFILES).sort(),
  );

  for (const option of alternatives) {
    assert.ok(option.spentCredits <= 5);
    assert.equal(planCostCredits(option.plan), option.spentCredits);
    assert.equal(option.uncertainty.runs, MODEL_LIMITS.monteCarloRuns);
    assert.ok(option.uncertainty.p10 <= option.uncertainty.median);
    assert.ok(option.uncertainty.median <= option.uncertainty.p90);
    assert.ok(option.deterministic.equityBenefit >= 0);
    assert.ok(option.deterministic.accessBenefit >= 0);
  }
});

test('sampled Pareto set contains only non-dominated unique portfolios', () => {
  const context = createScenarioContext(buildings, cells);
  const result = sampledParetoSet({
    context,
    cellsGeoJson: cells,
    scenario,
    budgetCredits: 5,
  });

  assert.equal(
    result.sampledProfiles,
    MODEL_PARAMETERS.optimizer.paretoGrid.equityWeights.length *
      MODEL_PARAMETERS.optimizer.paretoGrid.accessWeights.length,
  );
  assert.ok(result.uniquePortfolios >= result.frontier.length);
  assert.ok(result.frontier.length > 0);

  const planKeys = new Set(
    result.allUnique.map((item) =>
      item.plan
        .map((project) => `${project.cell_id}:${project.type}`)
        .sort()
        .join('|'),
    ),
  );
  assert.equal(planKeys.size, result.allUnique.length);

  const dominates = (a, b) => {
    const noWorse =
      a.robustMedian >= b.robustMedian &&
      a.equityBenefit >= b.equityBenefit &&
      a.accessBenefit >= b.accessBenefit;
    const strict =
      a.robustMedian > b.robustMedian ||
      a.equityBenefit > b.equityBenefit ||
      a.accessBenefit > b.accessBenefit;
    return noWorse && strict;
  };

  for (const point of result.frontier) {
    assert.ok(
      !result.allUnique.some(
        (other) => other !== point && dominates(other, point),
      ),
    );
  }
});

test('equity and access benefit diagnostics are non-negative and intervention-dependent', () => {
  const context = createScenarioContext(buildings, cells);
  const none = evaluatePortfolio({ context, projects: [], scenario });
  const plan = evaluatePortfolio({
    context,
    projects: [
      { cell_id: 1, type: 'rwh' },
      { cell_id: 2, type: 'drainage' },
    ],
    scenario,
  });

  assert.equal(none.equityBenefit, 0);
  assert.equal(none.accessBenefit, 0);
  assert.ok(plan.equityBenefit >= 0);
  assert.ok(plan.accessBenefit >= 0);
});


test('policy consensus correctly counts project membership across named lenses', () => {
  const alternatives = [
    { plan: [{ cell_id: 1, type: 'rwh' }, { cell_id: 2, type: 'drainage' }] },
    { plan: [{ cell_id: 1, type: 'rwh' }, { cell_id: 3, type: 'drainage' }] },
    { plan: [{ cell_id: 1, type: 'rwh' }, { cell_id: 2, type: 'drainage' }] },
  ];
  const consensus = policyConsensus(alternatives);
  const core = consensus.find((item) => item.cell_id === 1 && item.type === 'rwh');
  const partial = consensus.find((item) => item.cell_id === 2 && item.type === 'drainage');
  assert.equal(core.policyCount, 3);
  assert.equal(core.consensus, true);
  assert.equal(core.policyShare, 1);
  assert.equal(partial.policyCount, 2);
  assert.equal(partial.consensus, false);
});
