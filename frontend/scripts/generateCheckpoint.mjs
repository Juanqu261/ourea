import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  DEFAULT_SCENARIO,
  MODEL_LIMITS,
  MODEL_PARAMETERS,
} from '../src/config/modelConfig.js';
import { budgetRobustnessFrontier } from '../src/domain/frontier.js';
import { portfolioSelectionStability } from '../src/domain/stability.js';
import { generateAlternativePortfolios, policyConsensus } from '../src/domain/alternatives.js';
import { sampledParetoSet } from '../src/domain/pareto.js';
import { createScenarioContext, monteCarloPortfolio } from '../src/domain/scenarioEngine.js';
import { optimizeRobustPortfolio, planCostCredits } from '../src/domain/optimizer.js';

const frontendRoot = fileURLToPath(new URL('../', import.meta.url));
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const dataDir = join(frontendRoot, 'public', 'data');
const derivedDir = join(projectRoot, 'data', 'derived');

async function load(name) {
  return JSON.parse(await readFile(join(dataDir, name), 'utf8'));
}

const buildings = await load('buildings.geojson');
const cells = await load('planning_cells.geojson');
const climate = await load('climate_context.json');
const typical = climate.scenario_presets.find((item) => item.id === 'typical_wet');
const scenario = {
  rainMm: typical.precipitation_mm,
  antecedentWetness: typical.antecedent_rainfall_percentile,
  planningYear: DEFAULT_SCENARIO.planningYear,
};
const context = createScenarioContext(buildings, cells);
const optimized = optimizeRobustPortfolio({
  context,
  cellsGeoJson: cells,
  scenario,
  budgetCredits: DEFAULT_SCENARIO.budgetCredits,
});
const uncertainty = monteCarloPortfolio({
  context,
  projects: optimized.plan,
  scenario,
  runs: MODEL_LIMITS.checkpointMonteCarloRuns,
  seed: MODEL_PARAMETERS.scenarioUncertainty.comparisonSeed,
});

const checkpoint = {
  status: 'browser robust heuristic with explicit planning priors; not a landslide forecast',
  scenario,
  budgetCredits: DEFAULT_SCENARIO.budgetCredits,
  spentCredits: planCostCredits(optimized.plan),
  projects: optimized.plan,
  optimizerDiagnostics: {
    profile: optimized.diagnostics.profile,
    candidateCount: optimized.diagnostics.candidateCount,
    scenarioSamples: optimized.diagnostics.scenarioSamples,
    selectionMethod: optimized.diagnostics.selectionMethod,
    robustObjectiveProxy: Number(optimized.diagnostics.robustObjectiveProxy.toFixed(4)),
  },
  benefitProxyMonteCarlo: Object.fromEntries(
    Object.entries(uncertainty).map(([key, value]) => [key, typeof value === 'number' ? Number(value.toFixed(4)) : value]),
  ),
  warning: 'Do not interpret benefit proxy as people protected, avoided losses, or landslide probability reduction.',
};
await writeFile(join(dataDir, 'optimizer_checkpoint.json'), `${JSON.stringify(checkpoint, null, 2)}\n`);

const byCell = new Map();
for (const project of optimized.plan) {
  const list = byCell.get(project.cell_id) ?? [];
  list.push(project.type);
  byCell.set(project.cell_id, list);
}
const planGeoJson = {
  type: 'FeatureCollection',
  features: cells.features
    .filter((feature) => byCell.has(Number(feature.properties.cell_id)))
    .map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        selected_projects: byCell.get(Number(feature.properties.cell_id)).join(', '),
      },
    })),
};
await writeFile(
  join(derivedDir, 'heuristic_plan_10credits.geojson'),
  `${JSON.stringify(planGeoJson)}\n`,
);

const frontier = budgetRobustnessFrontier({
  context,
  cellsGeoJson: cells,
  scenario,
});
const frontierCheckpoint = frontier.map((point) => ({
  budgetCredits: point.budgetCredits,
  spentCredits: point.spentCredits,
  projectCount: point.projectCount,
  profileId: point.profileId,
  p10: Number(point.p10.toFixed(4)),
  median: Number(point.median.toFixed(4)),
  p90: Number(point.p90.toFixed(4)),
  mean: Number(point.mean.toFixed(4)),
  downsideRetention: Number(point.downsideRetention.toFixed(4)),
  plan: point.plan,
}));
await writeFile(
  join(derivedDir, 'browser_budget_frontier.json'),
  `${JSON.stringify(frontierCheckpoint, null, 2)}\n`,
);

const stability = portfolioSelectionStability({
  context,
  cellsGeoJson: cells,
  scenario,
  budgetCredits: DEFAULT_SCENARIO.budgetCredits,
});
const stabilityCheckpoint = {
  profileId: stability.profileId,
  runCount: stability.runCount,
  scenarioSamplesPerOptimization: stability.scenarioSamplesPerOptimization,
  projects: stability.projects.map((project) => ({
    cell_id: project.cell_id,
    type: project.type,
    selections: project.selections,
    frequency: Number(project.frequency.toFixed(4)),
  })),
};
await writeFile(
  join(derivedDir, 'browser_selection_stability.json'),
  `${JSON.stringify(stabilityCheckpoint, null, 2)}\n`,
);

const alternatives = generateAlternativePortfolios({
  context,
  cellsGeoJson: cells,
  scenario,
  budgetCredits: DEFAULT_SCENARIO.budgetCredits,
});
const alternativeCheckpoint = alternatives.map((option) => ({
  profileId: option.profileId,
  profile: option.profile,
  spentCredits: option.spentCredits,
  projects: option.plan,
  benefitProxy: {
    deterministic: Number(option.deterministic.benefit.toFixed(4)),
    equity: Number(option.deterministic.equityBenefit.toFixed(4)),
    access: Number(option.deterministic.accessBenefit.toFixed(4)),
    p10: Number(option.uncertainty.p10.toFixed(4)),
    median: Number(option.uncertainty.median.toFixed(4)),
    p90: Number(option.uncertainty.p90.toFixed(4)),
    downsideRetention: Number(option.downsideRetention.toFixed(4)),
  },
}));
await writeFile(
  join(derivedDir, 'robust_policy_alternatives.json'),
  `${JSON.stringify(alternativeCheckpoint, null, 2)}\n`,
);

const consensusCheckpoint = policyConsensus(alternatives).map((item) => ({
  cell_id: item.cell_id,
  type: item.type,
  selectedByPolicies: item.policyCount,
  policyShare: Number(item.policyShare.toFixed(4)),
  consensusAllNamedPolicies: item.consensus,
}));
await writeFile(
  join(derivedDir, 'policy_consensus.json'),
  `${JSON.stringify(consensusCheckpoint, null, 2)}\n`,
);

const pareto = sampledParetoSet({
  context,
  cellsGeoJson: cells,
  scenario,
  budgetCredits: DEFAULT_SCENARIO.budgetCredits,
});
const paretoCheckpoint = {
  sampledProfiles: pareto.sampledProfiles,
  uniquePortfolios: pareto.uniquePortfolios,
  note: pareto.note,
  frontier: pareto.frontier.map((item) => ({
    label: item.label,
    equityWeight: item.equityWeight,
    accessWeight: item.accessWeight,
    spentCredits: item.spentCredits,
    robustMedian: Number(item.robustMedian.toFixed(4)),
    robustP10: Number(item.robustP10.toFixed(4)),
    robustP90: Number(item.robustP90.toFixed(4)),
    equityBenefit: Number(item.equityBenefit.toFixed(4)),
    accessBenefit: Number(item.accessBenefit.toFixed(4)),
    plan: item.plan,
  })),
};
await writeFile(
  join(derivedDir, 'sampled_pareto.json'),
  `${JSON.stringify(paretoCheckpoint, null, 2)}\n`,
);

console.log(
  JSON.stringify(
    {
      checkpoint,
      frontier: frontierCheckpoint,
      stability: stabilityCheckpoint,
      alternatives: alternativeCheckpoint,
      policyConsensus: consensusCheckpoint,
      pareto: paretoCheckpoint,
    },
    null,
    2,
  ),
);
