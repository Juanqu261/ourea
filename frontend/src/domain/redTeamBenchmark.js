/**
 * Paired red-team benchmark utilities.
 * Primary metric: mean P10 lower-tail planning benefit.
 * Primary comparison: ourea_robust vs deterministic_central.
 * Strategies within a trial share one evaluation ensemble seed (paired).
 */
import {
  INTERVENTIONS,
  MODEL_LIMITS,
  MODEL_PARAMETERS,
} from '../config/modelConfig.js';
import {
  selectDeterministicPortfolio,
  selectGreedyOpportunityPortfolio,
  selectHazardOnlyPortfolio,
  selectRandomFeasiblePortfolio,
} from './benchmark.js';
import { optimizeRobustPortfolio, planCostCredits } from './optimizer.js';
import { evaluatePortfolio } from './scenarioEngine.js';
import { sampleProjectEffectsForFuture } from './interventionModel.js';
import { clamp, createSeededRandom, mean, quantile } from '../utils/math.js';

export const PRIMARY_METRIC = 'mean_p10';
export const PRIMARY_BASELINE = 'deterministic_central';
export const PRIMARY_STRATEGY = 'ourea_robust';

export const REFERENCE_CONFIG = Object.freeze({
  budgetCredits: 10,
  uncertaintyRegime: 'base',
  trials: 500,
  smokeTrials: 100,
  rootSeed: 20260912,
  bootstrapSamples: 2000,
  bootstrapSeed: 424242,
  mcRuns: MODEL_LIMITS.monteCarloRuns,
});

export const UNCERTAINTY_REGIMES = Object.freeze({
  low: Object.freeze({
    id: 'low',
    rainMultiplier: [0.95, 1.05],
    antecedentWetnessHalfRange: 0.04,
  }),
  base: Object.freeze({
    id: 'base',
    rainMultiplier: [...MODEL_PARAMETERS.scenarioUncertainty.rainMultiplier],
    antecedentWetnessHalfRange:
      MODEL_PARAMETERS.scenarioUncertainty.antecedentWetnessHalfRange,
  }),
  high: Object.freeze({
    id: 'high',
    rainMultiplier: [0.7, 1.3],
    antecedentWetnessHalfRange: 0.22,
  }),
});

export const BUDGET_SWEEP = Object.freeze([6, 8, 10, 12, 15, 20]);

function sampleScenarioWithRegime(baseScenario, random, regime) {
  const [rainLow, rainHigh] = regime.rainMultiplier;
  const wetnessHalfRange = regime.antecedentWetnessHalfRange;
  const rainMultiplier = rainLow + (rainHigh - rainLow) * random();
  return {
    ...baseScenario,
    rainMm: Math.max(0, Number(baseScenario.rainMm) * rainMultiplier),
    antecedentWetness: clamp(
      Number(baseScenario.antecedentWetness) + (random() * 2 - 1) * wetnessHalfRange,
    ),
  };
}

export function pairedMonteCarloPortfolio({
  context,
  projects,
  scenario,
  runs = REFERENCE_CONFIG.mcRuns,
  seed,
  regime = UNCERTAINTY_REGIMES.base,
}) {
  if (!projects.length || runs <= 0) {
    return { p10: 0, median: 0, p90: 0, mean: 0, runs: Math.max(0, runs), benefits: [] };
  }
  const random = createSeededRandom(seed >>> 0);
  const benefits = [];
  for (let index = 0; index < runs; index += 1) {
    const draw = sampleScenarioWithRegime(scenario, random, regime);
    const sampledEffects = sampleProjectEffectsForFuture(projects, index, seed);
    const result = evaluatePortfolio({
      context,
      projects,
      scenario: draw,
      sampledEffects,
    });
    benefits.push(result.benefit);
  }
  const sorted = [...benefits].sort((a, b) => a - b);
  return {
    p10: quantile(sorted, 0.1),
    median: quantile(sorted, 0.5),
    p90: quantile(sorted, 0.9),
    mean: mean(benefits),
    runs,
    benefits,
  };
}

export function selectAllStrategyPlans({
  context,
  cellsGeoJson,
  scenario,
  budgetCredits,
  profile,
  randomSeed = MODEL_PARAMETERS.scenarioUncertainty.baseSeed,
}) {
  const robust = optimizeRobustPortfolio({
    context,
    cellsGeoJson,
    scenario,
    budgetCredits,
    profile,
  });
  const deterministic = selectDeterministicPortfolio({
    context,
    cellsGeoJson,
    scenario,
    budgetCredits,
    profile,
  });
  const greedy = selectGreedyOpportunityPortfolio({ cellsGeoJson, budgetCredits });
  const hazard = selectHazardOnlyPortfolio({ cellsGeoJson, budgetCredits });
  const random = selectRandomFeasiblePortfolio({
    cellsGeoJson,
    budgetCredits,
    seed: randomSeed,
  });

  return {
    ourea_robust: {
      id: 'ourea_robust',
      plan: robust.plan,
      spentCredits: robust.spentCredits,
      selectionMethod: robust.diagnostics.selectionMethod,
    },
    deterministic_central: {
      id: 'deterministic_central',
      plan: deterministic.plan,
      spentCredits: deterministic.spentCredits,
      selectionMethod: deterministic.selectionMethod,
    },
    greedy_opportunity: {
      id: 'greedy_opportunity',
      plan: greedy.plan,
      spentCredits: greedy.spentCredits,
      selectionMethod: greedy.selectionMethod,
    },
    hazard_only: {
      id: 'hazard_only',
      plan: hazard.plan,
      spentCredits: hazard.spentCredits,
      selectionMethod: hazard.selectionMethod,
    },
    random_feasible: {
      id: 'random_feasible',
      plan: random.plan,
      spentCredits: random.spentCredits,
      selectionMethod: random.selectionMethod,
    },
  };
}

export function evaluatePlansPaired({
  context,
  scenario,
  plans,
  budgetCredits,
  evaluationSeed,
  regime = UNCERTAINTY_REGIMES.base,
  runs = REFERENCE_CONFIG.mcRuns,
}) {
  const rows = {};
  for (const [id, selection] of Object.entries(plans)) {
    const central = evaluatePortfolio({
      context,
      projects: selection.plan,
      scenario,
    });
    const mc = pairedMonteCarloPortfolio({
      context,
      projects: selection.plan,
      scenario,
      runs,
      seed: evaluationSeed,
      regime,
    });
    const spent = selection.spentCredits ?? planCostCredits(selection.plan);
    rows[id] = {
      id,
      selectionMethod: selection.selectionMethod,
      spentCredits: spent,
      budgetUtilization: spent / Math.max(1, Number(budgetCredits)),
      projectCount: selection.plan.length,
      typeCounts: selection.plan.reduce((acc, p) => {
        acc[p.type] = (acc[p.type] ?? 0) + 1;
        return acc;
      }, {}),
      expectedBenefit: central.benefit,
      p10: mc.p10,
      median: mc.median,
      p90: mc.p90,
      meanMc: mc.mean,
      downsideRetention: mc.median > 0 ? mc.p10 / mc.median : 0,
      planKeys: selection.plan.map((p) => `${p.cell_id}:${p.type}`).sort(),
    };
  }
  return rows;
}

export function trialEvaluationSeed(rootSeed, trialIndex) {
  return (rootSeed + trialIndex * 9973) >>> 0;
}

export function summarizeNumeric(values) {
  if (!values.length) {
    return {
      n: 0,
      mean: 0,
      median: 0,
      stdev: 0,
      p25: 0,
      p75: 0,
      min: 0,
      max: 0,
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const avg = mean(values);
  const variance = mean(values.map((v) => (v - avg) ** 2));
  return {
    n: values.length,
    mean: avg,
    median: quantile(sorted, 0.5),
    stdev: Math.sqrt(variance),
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

export function relativeDelta(numerator, denominator, minAbsDenominator = 1e-6) {
  const absDen = Math.abs(denominator);
  if (absDen < minAbsDenominator) {
    return {
      relative: null,
      unsafe_relative: true,
      reason: `denominator |${denominator}| < ${minAbsDenominator}`,
      denominator,
      absolute: numerator - denominator,
    };
  }
  return {
    relative: (numerator - denominator) / denominator,
    unsafe_relative: false,
    reason: null,
    denominator,
    absolute: numerator - denominator,
  };
}

export function pairedBootstrapCI(
  pairedDeltas,
  {
    samples = REFERENCE_CONFIG.bootstrapSamples,
    seed = REFERENCE_CONFIG.bootstrapSeed,
    alpha = 0.05,
  } = {},
) {
  if (!pairedDeltas.length) {
    return { mean: 0, ci95: [0, 0], samples: 0 };
  }
  const random = createSeededRandom(seed >>> 0);
  const n = pairedDeltas.length;
  const boots = [];
  for (let i = 0; i < samples; i += 1) {
    let sum = 0;
    for (let j = 0; j < n; j += 1) {
      const idx = Math.floor(random() * n);
      sum += pairedDeltas[idx];
    }
    boots.push(sum / n);
  }
  boots.sort((a, b) => a - b);
  const lo = quantile(boots, alpha / 2);
  const hi = quantile(boots, 1 - alpha / 2);
  return {
    mean: mean(pairedDeltas),
    median: quantile([...pairedDeltas].sort((a, b) => a - b), 0.5),
    ci95: [lo, hi],
    samples,
    seed,
  };
}

export function winEqualLoss(deltas, eps = 1e-9) {
  let win = 0;
  let equal = 0;
  let loss = 0;
  for (const d of deltas) {
    if (d > eps) win += 1;
    else if (d < -eps) loss += 1;
    else equal += 1;
  }
  return {
    win,
    equal,
    loss,
    n: deltas.length,
    winRate: win / Math.max(1, deltas.length),
    lossRate: loss / Math.max(1, deltas.length),
    equalRate: equal / Math.max(1, deltas.length),
  };
}

export function interventionUnitEconomics(cellsGeoJson) {
  const features = cellsGeoJson?.features ?? [];
  const out = {};
  for (const [type, config] of Object.entries(INTERVENTIONS)) {
    const field = config.opportunityField;
    const opps = features
      .map((f) => Number(f.properties[field] ?? 0))
      .filter((v) => v >= MODEL_PARAMETERS.optimizer.minOpportunity);
    const [lo, hi] = config.effectRange;
    const midEffect = (lo + hi) / 2;
    out[type] = {
      costCredits: config.costCredits,
      effectRange: [lo, hi],
      midEffect,
      midEffectPerCredit: midEffect / config.costCredits,
      eligibleCells: opps.length,
      meanOpportunity: opps.length ? mean(opps) : 0,
      p90Opportunity: opps.length
        ? quantile([...opps].sort((a, b) => a - b), 0.9)
        : 0,
      opportunityField: field,
    };
  }
  return out;
}

export function diagnoseGreedyPlan(cellsGeoJson, budgetCredits) {
  const greedy = selectGreedyOpportunityPortfolio({ cellsGeoJson, budgetCredits });
  const features = new Map(
    (cellsGeoJson?.features ?? []).map((f) => [Number(f.properties.cell_id), f.properties]),
  );
  const rows = greedy.plan.map((project) => {
    const cell = features.get(Number(project.cell_id)) ?? {};
    const config = INTERVENTIONS[project.type];
    const opportunity = Number(cell[config.opportunityField] ?? 0);
    return {
      ...project,
      opportunity,
      opportunityPerCredit: opportunity / config.costCredits,
      population_proxy: Number(cell.population_proxy ?? 0),
      drainage_stress_proxy: Number(cell.drainage_stress_proxy ?? cell.baseline_stress ?? 0),
      high_hazard_buildings: Number(cell.high_hazard_buildings ?? 0),
    };
  });
  const meanPop = rows.length ? mean(rows.map((r) => r.population_proxy)) : 0;
  const allPop = (cellsGeoJson?.features ?? []).map((f) => Number(f.properties.population_proxy ?? 0));
  const cityMeanPop = allPop.length ? mean(allPop) : 0;
  return {
    plan: greedy.plan,
    spentCredits: greedy.spentCredits,
    rows,
    meanSelectedPopulation: meanPop,
    cityMeanPopulation: cityMeanPop,
    classification_hypothesis:
      meanPop < 0.5 * cityMeanPop
        ? 'expected consequence of greedy objective: ranks opportunity/credit without exposure'
        : 'investigate further — selected population not obviously low',
  };
}
