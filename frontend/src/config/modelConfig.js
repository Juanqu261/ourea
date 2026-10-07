import parameters from './modelParameters.json' with { type: 'json' };

export const SANDBOX_BBOX = [-75.541116, 6.250378, -75.53662, 6.25492];

export const CITY_MAX_BOUNDS = Object.freeze([
  [-75.72, 6.12],
  [-75.43, 6.4],
]);

export const MAP_VIEWS = Object.freeze({
  city: Object.freeze({ center: [-75.572, 6.255], zoom: 12.2, pitch: 0, bearing: 0 }),
  sandbox: Object.freeze({
    center: [-75.53887, 6.25265],
    zoom: 16.55,
    pitch: 36,
    bearing: -12,
  }),
});

export const DEFAULT_SCENARIO = Object.freeze({
  rainMm: 95,
  antecedentWetness: 0.45,
  planningYear: 1,
  budgetCredits: 10,
});

export const MODEL_PARAMETERS = Object.freeze(parameters);
export const HAZARD_SCORE = Object.freeze(parameters.stress.hazardScores);

export const MODEL_LIMITS = Object.freeze({
  stressThreshold: parameters.stress.threshold,
  maxLocalReduction: parameters.optimizer.maxLocalReduction,
  monteCarloRuns: parameters.optimizer.monteCarloRuns,
  optimizerSamples: parameters.optimizer.optimizerSamples,
  maxProjectsPerCell: parameters.optimizer.maxProjectsPerCell,
  frontierMonteCarloRuns: parameters.optimizer.frontierMonteCarloRuns,
  frontierScenarioSamples: parameters.optimizer.frontierScenarioSamples,
  stabilityRuns: parameters.optimizer.stabilityRuns,
  stabilityScenarioSamples: parameters.optimizer.stabilityScenarioSamples,
  checkpointMonteCarloRuns: parameters.optimizer.checkpointMonteCarloRuns,
});

export const INTERVENTIONS = Object.freeze(
  Object.fromEntries(
    Object.entries(parameters.interventions).map(([key, value]) => [
      key,
      Object.freeze({
        ...value,
        effectRange: Object.freeze([...value.effectRange]),
        suitabilityField: value.opportunityField,
      }),
    ]),
  ),
);

export const RWH_ASSUMPTIONS = Object.freeze(parameters.rwh);

export const FRONTIER_BUDGETS = Object.freeze([
  ...parameters.optimizer.frontierBudgets,
]);

export const OBJECTIVE_PROFILES = Object.freeze(
  Object.fromEntries(
    Object.entries(parameters.optimizer.objectiveProfiles).map(([key, value]) => [
      key,
      Object.freeze({ ...value }),
    ]),
  ),
);

export const PARETO_GRID = Object.freeze({
  ...parameters.optimizer.paretoGrid,
  equityWeights: Object.freeze([...parameters.optimizer.paretoGrid.equityWeights]),
  accessWeights: Object.freeze([...parameters.optimizer.paretoGrid.accessWeights]),
});
