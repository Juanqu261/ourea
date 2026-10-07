import {
  MODEL_LIMITS,
  MODEL_PARAMETERS,
  OBJECTIVE_PROFILES,
} from '../config/modelConfig.js';
import { optimizeRobustPortfolio } from './optimizer.js';
import {
  evaluatePortfolio,
  monteCarloPortfolio,
} from './scenarioEngine.js';

export function generateAlternativePortfolios({
  context,
  cellsGeoJson,
  scenario,
  budgetCredits,
  profiles = OBJECTIVE_PROFILES,
}) {
  return Object.entries(profiles).map(([profileId, profile]) => {
    const optimized = optimizeRobustPortfolio({
      context,
      cellsGeoJson,
      scenario,
      budgetCredits,
      profile: { id: profileId, ...profile },
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
      runs: MODEL_LIMITS.monteCarloRuns,
      seed: MODEL_PARAMETERS.scenarioUncertainty.comparisonSeed,
    });

    return {
      profileId,
      profile,
      plan: optimized.plan,
      spentCredits: optimized.spentCredits,
      diagnostics: optimized.diagnostics,
      deterministic,
      uncertainty,
      downsideRetention:
        uncertainty.median > 0 ? uncertainty.p10 / uncertainty.median : 0,
    };
  });
}

export function alternativeById(alternatives, profileId) {
  return alternatives?.find((item) => item.profileId === profileId) ?? null;
}

export function policyConsensus(alternatives) {
  const options = alternatives ?? [];
  if (!options.length) return [];

  const counts = new Map();
  for (const option of options) {
    const seen = new Set();
    for (const project of option.plan) {
      const key = `${Number(project.cell_id)}:${project.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const current = counts.get(key) ?? {
        cell_id: Number(project.cell_id),
        type: project.type,
        policyCount: 0,
      };
      current.policyCount += 1;
      counts.set(key, current);
    }
  }

  return [...counts.values()]
    .map((item) => ({
      ...item,
      policyShare: item.policyCount / options.length,
      consensus: item.policyCount === options.length,
    }))
    .sort(
      (a, b) =>
        b.policyCount - a.policyCount ||
        a.cell_id - b.cell_id ||
        a.type.localeCompare(b.type),
    );
}
