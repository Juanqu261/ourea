import {
  FRONTIER_BUDGETS,
  MODEL_LIMITS,
  MODEL_PARAMETERS,
} from '../config/modelConfig.js';
import { optimizeRobustPortfolio } from './optimizer.js';
import { monteCarloPortfolio } from './scenarioEngine.js';

export function budgetRobustnessFrontier({
  context,
  cellsGeoJson,
  scenario,
  budgets = FRONTIER_BUDGETS,
  optimizerScenarioSamples = MODEL_LIMITS.frontierScenarioSamples,
  monteCarloRuns = MODEL_LIMITS.frontierMonteCarloRuns,
  profile = 'balanced',
}) {
  const uniqueBudgets = [...new Set(
    budgets
      .map(Number)
      .filter((budget) => Number.isFinite(budget) && budget > 0),
  )].sort((a, b) => a - b);

  return uniqueBudgets.map((budgetCredits) => {
    const optimized = optimizeRobustPortfolio({
      context,
      cellsGeoJson,
      scenario,
      budgetCredits,
      profile,
      scenarioSamples: optimizerScenarioSamples,
    });

    const uncertainty = monteCarloPortfolio({
      context,
      projects: optimized.plan,
      scenario,
      runs: monteCarloRuns,
      seed: MODEL_PARAMETERS.scenarioUncertainty.comparisonSeed,
    });

    return {
      budgetCredits,
      spentCredits: optimized.spentCredits,
      projectCount: optimized.plan.length,
      p10: uncertainty.p10,
      median: uncertainty.median,
      p90: uncertainty.p90,
      mean: uncertainty.mean,
      downsideRetention:
        uncertainty.median > 0 ? uncertainty.p10 / uncertainty.median : 0,
      plan: optimized.plan,
      optimizerDiagnostics: optimized.diagnostics,
      profileId: optimized.diagnostics.profile.id,
      profileLabel: optimized.diagnostics.profile.label,
    };
  });
}
