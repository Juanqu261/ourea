import {
  INTERVENTIONS,
  MODEL_LIMITS,
  MODEL_PARAMETERS,
} from '../config/modelConfig.js';
import { planCostCredits, optimizeRobustPortfolio } from './optimizer.js';
import { evaluatePortfolio, monteCarloPortfolio } from './scenarioEngine.js';
import { regret, signedDelta } from './regret.js';
import { createSeededRandom } from '../utils/math.js';

const HAZARD_RANK = Object.freeze({ Alta: 3, Media: 2, Baja: 1 });
const INTERVENTION_ORDER = Object.freeze(['drainage', 'rwh', 'restoration']);

function cellHazardScore(cell) {
  const high = Number(cell.high_hazard_buildings ?? 0);
  if (Number.isFinite(high) && high > 0) return high;
  return HAZARD_RANK[cell.hazard_max] ?? 0;
}

function eligibleCandidates(cellsGeoJson) {
  const candidates = [];
  for (const feature of cellsGeoJson?.features ?? []) {
    const cell = feature.properties;
    const cellId = Number(cell.cell_id);
    if (!Number.isFinite(cellId)) continue;
    for (const type of INTERVENTION_ORDER) {
      const config = INTERVENTIONS[type];
      const opportunity = Number(cell[config.suitabilityField] ?? 0);
      if (opportunity < MODEL_PARAMETERS.optimizer.minOpportunity) continue;
      candidates.push({
        cell_id: cellId,
        type,
        costCredits: config.costCredits,
        opportunity,
        hazardScore: cellHazardScore(cell),
      });
    }
  }
  return candidates;
}

function packPlan(rankedCandidates, budgetCredits, maxProjectsPerCell) {
  const budget = Math.max(0, Number(budgetCredits));
  const plan = [];
  const countByCell = new Map();
  let spent = 0;
  for (const candidate of rankedCandidates) {
    const cellId = candidate.cell_id;
    if ((countByCell.get(cellId) ?? 0) >= maxProjectsPerCell) continue;
    if (spent + candidate.costCredits > budget) continue;
    plan.push({ cell_id: cellId, type: candidate.type });
    countByCell.set(cellId, (countByCell.get(cellId) ?? 0) + 1);
    spent += candidate.costCredits;
    if (spent >= budget) break;
  }
  return { plan, spentCredits: spent };
}

export function selectHazardOnlyPortfolio({
  cellsGeoJson,
  budgetCredits,
  maxProjectsPerCell = MODEL_LIMITS.maxProjectsPerCell,
}) {
  const ranked = eligibleCandidates(cellsGeoJson).sort(
    (a, b) =>
      b.hazardScore - a.hazardScore
      || b.opportunity - a.opportunity
      || a.cell_id - b.cell_id
      || a.type.localeCompare(b.type),
  );
  const packed = packPlan(ranked, budgetCredits, maxProjectsPerCell);
  return { ...packed, selectionMethod: 'hazard-only-greedy' };
}

export function selectGreedyOpportunityPortfolio({
  cellsGeoJson,
  budgetCredits,
  maxProjectsPerCell = MODEL_LIMITS.maxProjectsPerCell,
}) {
  const ranked = eligibleCandidates(cellsGeoJson).sort(
    (a, b) =>
      b.opportunity / b.costCredits - a.opportunity / a.costCredits
      || a.cell_id - b.cell_id
      || a.type.localeCompare(b.type),
  );
  const packed = packPlan(ranked, budgetCredits, maxProjectsPerCell);
  return { ...packed, selectionMethod: 'greedy-opportunity-per-credit' };
}

export function selectRandomFeasiblePortfolio({
  cellsGeoJson,
  budgetCredits,
  maxProjectsPerCell = MODEL_LIMITS.maxProjectsPerCell,
  seed = MODEL_PARAMETERS.scenarioUncertainty.baseSeed,
}) {
  const candidates = eligibleCandidates(cellsGeoJson);
  const random = createSeededRandom(seed);
  const shuffled = [...candidates].sort((a, b) => {
    const da = random();
    const db = random();
    return da - db || a.cell_id - b.cell_id || a.type.localeCompare(b.type);
  });
  const packed = packPlan(shuffled, budgetCredits, maxProjectsPerCell);
  return { ...packed, selectionMethod: 'random-feasible' };
}

export function selectDeterministicPortfolio({
  context,
  cellsGeoJson,
  scenario,
  budgetCredits,
  profile = 'balanced',
}) {
  const optimized = optimizeRobustPortfolio({
    context,
    cellsGeoJson,
    scenario,
    budgetCredits,
    profile,
    scenarioSamples: 1,
    freezeScenario: true,
  });
  return {
    plan: optimized.plan,
    spentCredits: optimized.spentCredits,
    selectionMethod: 'deterministic-central-scenario',
    diagnostics: optimized.diagnostics,
  };
}

function overlapShare(plan, reference) {
  if (!reference.length) return 0;
  const keys = new Set(plan.map((project) => `${project.cell_id}:${project.type}`));
  const hits = reference.filter((project) => keys.has(`${project.cell_id}:${project.type}`));
  return hits.length / reference.length;
}

function summarizeStrategy(label, selection, context, scenario, budgetCredits, robustPlan) {
  const spent = selection.spentCredits ?? planCostCredits(selection.plan);
  const deterministic = evaluatePortfolio({
    context,
    projects: selection.plan,
    scenario,
  });
  const uncertainty = monteCarloPortfolio({
    context,
    projects: selection.plan,
    scenario,
    seed: MODEL_PARAMETERS.scenarioUncertainty.comparisonSeed,
  });
  return {
    id: label,
    selectionMethod: selection.selectionMethod,
    spentCredits: spent,
    budgetFeasible: spent <= Number(budgetCredits),
    projectCount: selection.plan.length,
    plan: selection.plan,
    median: uncertainty.median,
    p10: uncertainty.p10,
    p90: uncertainty.p90,
    downsideRetention: uncertainty.median > 0 ? uncertainty.p10 / uncertainty.median : 0,
    equityBenefit: deterministic.equityBenefit,
    accessBenefit: deterministic.accessBenefit,
    overlapWithRobust: overlapShare(selection.plan, robustPlan),
    p10RegretVersusRobust: null,
    p10DeltaVersusRobust: null,
  };
}

export function compareSelectionStrategies({
  context,
  cellsGeoJson,
  scenario,
  budgetCredits,
  profile = 'balanced',
}) {
  const robust = optimizeRobustPortfolio({
    context,
    cellsGeoJson,
    scenario,
    budgetCredits,
    profile,
  });
  const hazard = selectHazardOnlyPortfolio({ cellsGeoJson, budgetCredits });
  const greedy = selectGreedyOpportunityPortfolio({ cellsGeoJson, budgetCredits });
  const random = selectRandomFeasiblePortfolio({ cellsGeoJson, budgetCredits });
  const deterministic = selectDeterministicPortfolio({
    context,
    cellsGeoJson,
    scenario,
    budgetCredits,
    profile,
  });

  const strategies = [
    summarizeStrategy('random_feasible', random, context, scenario, budgetCredits, robust.plan),
    summarizeStrategy('greedy_opportunity', greedy, context, scenario, budgetCredits, robust.plan),
    summarizeStrategy('hazard_only', hazard, context, scenario, budgetCredits, robust.plan),
    summarizeStrategy(
      'deterministic_central',
      deterministic,
      context,
      scenario,
      budgetCredits,
      robust.plan,
    ),
    summarizeStrategy(
      'ourea_robust',
      {
        plan: robust.plan,
        spentCredits: robust.spentCredits,
        selectionMethod: robust.diagnostics.selectionMethod,
      },
      context,
      scenario,
      budgetCredits,
      robust.plan,
    ),
  ];

  const robustStrategy = strategies.find((item) => item.id === 'ourea_robust');
  const robustP10 = robustStrategy?.p10 ?? 0;
  for (const item of strategies) {
    item.p10RegretVersusRobust = regret(robustP10, item.p10);
    item.p10DeltaVersusRobust = signedDelta(robustP10, item.p10);
  }

  const byP10 = [...strategies].sort((a, b) => b.p10 - a.p10);
  return {
    budgetCredits: Number(budgetCredits),
    profile,
    seed: MODEL_PARAMETERS.scenarioUncertainty.comparisonSeed,
    note:
      'Baselines share the same budget and scenario set. Random = seeded feasible pack; greedy = opportunity per credit; hazard-only = high drainage/hazard proxy first; deterministic = single central scenario; Ourea robust = uncertainty ensemble. Metrics are planning proxies, not people saved. If a baseline wins a metric, that result is reported honestly.',
    p10Leader: byP10[0]?.id ?? null,
    strategies,
  };
}
