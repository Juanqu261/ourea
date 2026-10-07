import {
  MODEL_LIMITS,
  MODEL_PARAMETERS,
} from '../config/modelConfig.js';
import { optimizeRobustPortfolio } from './optimizer.js';

const BASE_SEED = MODEL_PARAMETERS.scenarioUncertainty.baseSeed;

function projectKey(project) {
  return `${Number(project.cell_id)}:${project.type}`;
}

function runSeed(index, salt) {
  return (
    BASE_SEED +
    Math.imul((Number(index) + 1) >>> 0, salt >>> 0)
  ) >>> 0;
}

export function portfolioSelectionStability({
  context,
  cellsGeoJson,
  scenario,
  budgetCredits,
  runs = MODEL_LIMITS.stabilityRuns,
  scenarioSamples = MODEL_LIMITS.stabilityScenarioSamples,
  profile = 'balanced',
}) {
  const runCount = Math.max(1, Math.floor(Number(runs)));
  const sampleCount = Math.max(1, Math.floor(Number(scenarioSamples)));
  const counts = new Map();
  const plans = [];

  for (let index = 0; index < runCount; index += 1) {
    const scenarioSeed = runSeed(index, 2654435761);
    const projectSeedBase = runSeed(index, 2246822519);

    const optimized = optimizeRobustPortfolio({
      context,
      cellsGeoJson,
      scenario,
      budgetCredits,
      profile,
      scenarioSamples: sampleCount,
      scenarioSeed,
      projectSeedBase,
    });

    const keys = new Set(optimized.plan.map(projectKey));
    for (const project of optimized.plan) {
      const key = projectKey(project);
      const existing = counts.get(key) ?? {
        cell_id: Number(project.cell_id),
        type: project.type,
        selections: 0,
      };
      existing.selections += 1;
      counts.set(key, existing);
    }

    plans.push({
      run: index + 1,
      profileId: optimized.diagnostics.profile.id,
      scenarioSeed,
      projectSeedBase,
      spentCredits: optimized.spentCredits,
      projectKeys: [...keys].sort(),
    });
  }

  const projects = [...counts.values()]
    .map((item) => ({
      ...item,
      frequency: item.selections / runCount,
    }))
    .sort(
      (a, b) =>
        b.frequency - a.frequency ||
        a.cell_id - b.cell_id ||
        a.type.localeCompare(b.type),
    );

  return {
    profileId: plans[0]?.profileId ?? (
      typeof profile === 'string' ? profile : profile.id ?? 'custom'
    ),
    runCount,
    scenarioSamplesPerOptimization: sampleCount,
    projects,
    plans,
    interpretation:
      'Selection frequency across independent uncertainty resamples; not probability of true optimality.',
  };
}
