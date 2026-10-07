import {
  MODEL_PARAMETERS,
  PARETO_GRID,
} from '../config/modelConfig.js';
import { optimizeRobustPortfolio } from './optimizer.js';
import {
  evaluatePortfolio,
  monteCarloPortfolio,
} from './scenarioEngine.js';

function dominates(a, b) {
  const noWorse =
    a.robustMedian >= b.robustMedian &&
    a.equityBenefit >= b.equityBenefit &&
    a.accessBenefit >= b.accessBenefit;
  const strictlyBetter =
    a.robustMedian > b.robustMedian ||
    a.equityBenefit > b.equityBenefit ||
    a.accessBenefit > b.accessBenefit;
  return noWorse && strictlyBetter;
}

export function sampledParetoSet({
  context,
  cellsGeoJson,
  scenario,
  budgetCredits,
}) {
  const candidates = [];
  let index = 0;

  for (const equityWeight of PARETO_GRID.equityWeights) {
    for (const accessWeight of PARETO_GRID.accessWeights) {
      const profile = {
        id: `pareto-${index}`,
        label: `E${equityWeight.toFixed(1)} / A${accessWeight.toFixed(1)}`,
        equityWeight,
        accessWeight,
        downsidePenalty: PARETO_GRID.downsidePenalty,
      };
      const optimized = optimizeRobustPortfolio({
        context,
        cellsGeoJson,
        scenario,
        budgetCredits,
        profile,
        scenarioSamples: PARETO_GRID.optimizerScenarioSamples,
        scenarioSeed:
          MODEL_PARAMETERS.scenarioUncertainty.comparisonSeed,
        projectSeedBase:
          MODEL_PARAMETERS.scenarioUncertainty.comparisonSeed,
      });
      const deterministic = evaluatePortfolio({
        context,
        projects: optimized.plan,
        scenario,
      });
      const uncertainty = monteCarloPortfolio({
        context,
        projects: optimized.plan,
        scenario,
        runs: PARETO_GRID.monteCarloRuns,
        seed: MODEL_PARAMETERS.scenarioUncertainty.comparisonSeed,
      });

      candidates.push({
        id: profile.id,
        label: profile.label,
        equityWeight,
        accessWeight,
        plan: optimized.plan,
        spentCredits: optimized.spentCredits,
        robustMedian: uncertainty.median,
        robustP10: uncertainty.p10,
        robustP90: uncertainty.p90,
        equityBenefit: deterministic.equityBenefit,
        accessBenefit: deterministic.accessBenefit,
      });
      index += 1;
    }
  }

  const unique = [];
  const seen = new Set();
  for (const item of candidates) {
    const key = item.plan
      .map((project) => `${project.cell_id}:${project.type}`)
      .sort()
      .join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  const frontier = unique.filter(
    (candidate) => !unique.some(
      (other) => other !== candidate && dominates(other, candidate),
    ),
  );

  return {
    sampledProfiles: candidates.length,
    uniquePortfolios: unique.length,
    frontier: frontier.sort(
      (a, b) => b.robustMedian - a.robustMedian,
    ),
    allUnique: unique,
    note:
      'Non-dominated set among sampled policy weights; not an exhaustive mathematical Pareto frontier.',
  };
}
