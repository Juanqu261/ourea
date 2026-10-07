import { INTERVENTIONS } from '../config/modelConfig.js';
import { evaluatePortfolio } from './scenarioEngine.js';
import { optimizeRobustPortfolio } from './optimizer.js';
import { projectKey } from './interventionModel.js';

const ANTECEDENT_STEPS = Object.freeze([0.25, 0.5, 0.75]);
const YEAR_STEPS = Object.freeze([1, 3, 5]);
const EFFECT_LEVELS = Object.freeze(['low', 'mid', 'high']);
const COST_FACTORS = Object.freeze([0.8, 1, 1.2]);

function planKey(plan) {
  return [...plan]
    .map((project) => `${project.cell_id}:${project.type}`)
    .sort()
    .join('|');
}

function rainStepsFrom(scenario, climateRainSteps) {
  if (climateRainSteps?.length) {
    return [...new Set(climateRainSteps.map((value) => Number(value)))];
  }
  const center = Number(scenario.rainMm);
  return [center * 0.7, center, center * 1.4].map((value) => Number(value.toFixed(1)));
}

function effectMap(plan, level) {
  const effects = new Map();
  for (const project of plan) {
    const range = INTERVENTIONS[project.type]?.effectRange ?? [0, 0];
    const [low, high] = range;
    const value = level === 'low' ? low : level === 'high' ? high : (low + high) / 2;
    effects.set(projectKey(project), value);
  }
  return effects;
}

function oatOutcome({ context, plan, scenario, levels, applyLevel }) {
  const reference = evaluatePortfolio({ context, projects: plan, scenario });
  return levels.map((level) => {
    const next = applyLevel(level);
    const metrics = evaluatePortfolio({
      context,
      projects: plan,
      scenario: next.scenario ?? scenario,
      sampledEffects: next.sampledEffects ?? null,
    });
    return {
      level,
      benefit: Number(metrics.benefit.toFixed(4)),
      deltaBenefit: Number((metrics.benefit - reference.benefit).toFixed(4)),
    };
  });
}

function compositionShift({
  context,
  cellsGeoJson,
  plan,
  scenario,
  budgetCredits,
  profile,
  levels,
  applyLevel,
}) {
  if (!cellsGeoJson) return [];
  const current = planKey(plan);
  const changes = [];
  for (const level of levels) {
    const nextScenario = applyLevel(level);
    const optimized = optimizeRobustPortfolio({
      context,
      cellsGeoJson,
      scenario: nextScenario.scenario ?? scenario,
      budgetCredits: nextScenario.budgetCredits ?? budgetCredits,
      profile,
      scenarioSamples: 20,
    });
    if (planKey(optimized.plan) !== current) {
      changes.push({ level, changed: true });
    }
  }
  return changes;
}

export function diagnosePortfolioBreaks({
  context,
  cellsGeoJson,
  plan,
  alternativePlan = [],
  scenario,
  budgetCredits,
  profile = 'balanced',
  thresholdRatio = 0.8,
  climateRainSteps = null,
}) {
  const baseline = evaluatePortfolio({ context, projects: plan, scenario });
  const threshold = baseline.benefit * thresholdRatio;
  const rainSteps = rainStepsFrom(scenario, climateRainSteps);
  const breaches = [];

  for (const rainMm of rainSteps) {
    for (const antecedentWetness of ANTECEDENT_STEPS) {
      for (const planningYear of YEAR_STEPS) {
        const draw = { ...scenario, rainMm, antecedentWetness, planningYear };
        const metrics = evaluatePortfolio({ context, projects: plan, scenario: draw });
        if (metrics.benefit + 1e-9 < threshold) {
          breaches.push({
            rainMm,
            antecedentWetness,
            planningYear,
            benefit: Number(metrics.benefit.toFixed(4)),
          });
        }
      }
    }
  }

  const oneAtATime = [
    {
      assumption: 'rainfall',
      changesComposition: false,
      outcomes: oatOutcome({
        context,
        plan,
        scenario,
        levels: rainSteps,
        applyLevel: (rainMm) => ({ scenario: { ...scenario, rainMm } }),
      }),
    },
    {
      assumption: 'antecedent_rainfall',
      changesComposition: false,
      outcomes: oatOutcome({
        context,
        plan,
        scenario,
        levels: ANTECEDENT_STEPS,
        applyLevel: (antecedentWetness) => ({ scenario: { ...scenario, antecedentWetness } }),
      }),
    },
    {
      assumption: 'restoration_maturity',
      changesComposition: false,
      outcomes: oatOutcome({
        context,
        plan,
        scenario,
        levels: YEAR_STEPS,
        applyLevel: (planningYear) => ({ scenario: { ...scenario, planningYear } }),
      }),
    },
    {
      assumption: 'effect_range',
      changesComposition: false,
      outcomes: oatOutcome({
        context,
        plan,
        scenario,
        levels: EFFECT_LEVELS,
        applyLevel: (level) => ({ sampledEffects: effectMap(plan, level) }),
      }),
    },
    {
      assumption: 'cost_uncertainty',
      changesComposition: true,
      outcomes: COST_FACTORS.map((factor) => ({
        level: factor,
        effectiveBudget: Number((Number(budgetCredits) * factor).toFixed(2)),
      })),
    },
  ];

  const composition = {
    rainfall: compositionShift({
      context,
      cellsGeoJson,
      plan,
      scenario,
      budgetCredits,
      profile,
      levels: rainSteps,
      applyLevel: (rainMm) => ({ scenario: { ...scenario, rainMm } }),
    }),
    antecedent_rainfall: compositionShift({
      context,
      cellsGeoJson,
      plan,
      scenario,
      budgetCredits,
      profile,
      levels: ANTECEDENT_STEPS,
      applyLevel: (antecedentWetness) => ({ scenario: { ...scenario, antecedentWetness } }),
    }),
    restoration_maturity: compositionShift({
      context,
      cellsGeoJson,
      plan,
      scenario,
      budgetCredits,
      profile,
      levels: YEAR_STEPS,
      applyLevel: (planningYear) => ({ scenario: { ...scenario, planningYear } }),
    }),
    cost_uncertainty: compositionShift({
      context,
      cellsGeoJson,
      plan,
      scenario,
      budgetCredits,
      profile,
      levels: COST_FACTORS,
      applyLevel: (factor) => ({ budgetCredits: Number(budgetCredits) * factor }),
    }),
  };

  for (const item of oneAtATime) {
    item.changesComposition = (composition[item.assumption] ?? []).length > 0;
    item.compositionChanges = composition[item.assumption] ?? [];
  }

  const alternative = alternativePlan.length
    ? evaluatePortfolio({ context, projects: alternativePlan, scenario })
    : null;

  return {
    referenceBenefit: Number(baseline.benefit.toFixed(4)),
    breachThreshold: Number(threshold.toFixed(4)),
    thresholdRatio,
    scenarioCombinationsBelowThreshold: breaches,
    breaches,
    oneAtATime,
    versusAlternative: alternative
      ? {
          benefitDelta: Number((baseline.benefit - alternative.benefit).toFixed(4)),
          equityDelta: Number((baseline.equityBenefit - alternative.equityBenefit).toFixed(4)),
        }
      : null,
    note: 'One-at-a-time sensitivity on published planning controls. Combinations below the threshold are scenario combinations, not spatial grid cells. Not a calibrated climate forecast.',
  };
}
