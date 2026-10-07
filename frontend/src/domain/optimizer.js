import {
  INTERVENTIONS,
  MODEL_LIMITS,
  MODEL_PARAMETERS,
  OBJECTIVE_PROFILES,
} from '../config/modelConfig.js';
import { baselineStress } from './climateStress.js';
import { maturityFactor, scaledEffectRange } from './interventionModel.js';
import { scenarioEnsemble, stableProjectSeed } from './uncertainty.js';
import { createSeededRandom, mean, quantile } from '../utils/math.js';

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value)));
}

export function objectiveProfile(profile = 'balanced') {
  if (typeof profile === 'object' && profile) {
    return {
      id: profile.id ?? 'custom',
      label: profile.label ?? 'Custom',
      description: profile.description ?? 'Custom decision-policy weights.',
      equityWeight: Number(profile.equityWeight ?? 0),
      accessWeight: Number(profile.accessWeight ?? 0),
      downsidePenalty: Number(profile.downsidePenalty ?? 0),
    };
  }

  const config = OBJECTIVE_PROFILES[profile];
  if (!config) throw new Error(`Unknown objective profile: ${profile}`);
  return { id: profile, ...config };
}

function exposureByCell(context, scenario, stressModel) {
  const exposure = new Map();
  for (const feature of context.buildings) {
    const properties = feature.properties;
    const cellId = Number(properties.cell_id);
    const people = Math.max(0, Number(properties.population_proxy ?? 0));
    const value = people * stressModel(properties, scenario);
    exposure.set(cellId, (exposure.get(cellId) ?? 0) + value);
  }
  return exposure;
}

function exposureEnsembleByCell(
  context,
  scenario,
  stressModel,
  samples,
  scenarioSeed,
) {
  return scenarioEnsemble(scenario, samples, scenarioSeed).map((draw) =>
    exposureByCell(context, draw, stressModel),
  );
}

function projectEffectSamples(
  project,
  runs,
  planningYear,
  projectSeedBase,
) {
  const config = INTERVENTIONS[project.type];
  const [low, high] = scaledEffectRange(project.type);
  const maturity = maturityFactor(project.type, planningYear);
  const random = createSeededRandom(
    stableProjectSeed(project, projectSeedBase),
  );

  return Array.from(
    { length: runs },
    () => (low + (high - low) * random()) * maturity,
  );
}

export function cellDecisionFactors(cell, profile = 'balanced') {
  const optimizer = MODEL_PARAMETERS.optimizer;
  const policy = objectiveProfile(profile);
  const buildingCount = Math.max(1, Number(cell.buildings ?? 0));
  const equityShare = clamp01(
    Number(cell.stratum1_buildings ?? 0) / buildingCount,
  );
  const equityFactor = 1 + policy.equityWeight * equityShare;

  const accessMeters =
    Math.max(0, Number(cell.vehicular_access_m ?? 0)) +
    optimizer.pedestrianAccessWeight *
      Math.max(0, Number(cell.pedestrian_access_m ?? 0));
  const accessIndex = Math.min(
    1,
    accessMeters / optimizer.accessNormalizationMeters,
  );
  const accessFactor = 1 + policy.accessWeight * accessIndex;

  return {
    equityShare,
    accessIndex,
    equityFactor,
    accessFactor,
  };
}

function buildCandidates(
  cellsGeoJson,
  runCount,
  planningYear,
  projectSeedBase,
  profile,
) {
  const optimizer = MODEL_PARAMETERS.optimizer;
  const candidates = [];

  for (const feature of cellsGeoJson.features) {
    const cell = feature.properties;
    const cellId = Number(cell.cell_id);
    const decision = cellDecisionFactors(cell, profile);

    for (const type of Object.keys(INTERVENTIONS)) {
      const config = INTERVENTIONS[type];
      const opportunity = clamp01(cell[config.suitabilityField] ?? 0);
      if (opportunity < optimizer.minOpportunity) continue;

      const project = { cell_id: cellId, type };
      candidates.push({
        ...project,
        costCredits: config.costCredits,
        opportunity,
        ...decision,
        effectSamples: projectEffectSamples(
          project,
          runCount,
          planningYear,
          projectSeedBase,
        ),
      });
    }
  }
  return candidates;
}

function robustMarginalValue({
  candidate,
  exposureSamples,
  remainingFractionByCell,
  profile,
}) {
  const policy = objectiveProfile(profile);
  const remaining = remainingFractionByCell.get(candidate.cell_id);
  const benefits = [];

  for (let index = 0; index < exposureSamples.length; index += 1) {
    const exposure = exposureSamples[index].get(candidate.cell_id) ?? 0;
    const currentRemaining = remaining?.[index] ?? 1;
    const projectReduction = Math.min(
      MODEL_LIMITS.maxLocalReduction,
      candidate.effectSamples[index] * candidate.opportunity,
    );
    benefits.push(exposure * currentRemaining * projectReduction);
  }

  benefits.sort((a, b) => a - b);
  const avg = mean(benefits);
  const p10 = quantile(benefits, 0.1);
  const downside = Math.max(0, avg - p10);
  const robustValue =
    (avg - policy.downsidePenalty * downside) *
    candidate.equityFactor *
    candidate.accessFactor;

  return {
    meanBenefit: avg,
    p10Benefit: p10,
    downside,
    robustValue,
    scorePerCredit: robustValue / candidate.costCredits,
  };
}

function applyCandidate(candidate, remainingFractionByCell) {
  const current =
    remainingFractionByCell.get(candidate.cell_id) ??
    Array.from({ length: candidate.effectSamples.length }, () => 1);

  const updated = current.map((remaining, index) => {
    const reduction = Math.min(
      MODEL_LIMITS.maxLocalReduction,
      candidate.effectSamples[index] * candidate.opportunity,
    );
    return remaining * (1 - reduction);
  });
  remainingFractionByCell.set(candidate.cell_id, updated);
}

export function optimizeRobustPortfolio({
  context,
  cellsGeoJson,
  scenario,
  budgetCredits,
  profile = 'balanced',
  stressModel = baselineStress,
  scenarioSamples = MODEL_LIMITS.optimizerSamples,
  scenarioSeed = MODEL_PARAMETERS.scenarioUncertainty.baseSeed,
  projectSeedBase = MODEL_PARAMETERS.scenarioUncertainty.baseSeed,
  freezeScenario = false,
}) {
  const policy = objectiveProfile(profile);
  const budget = Math.max(0, Number(budgetCredits));
  const sampleCount = Math.max(1, Math.floor(Number(scenarioSamples)));
  const exposureSamples = freezeScenario
    ? [exposureByCell(context, scenario, stressModel)]
    : exposureEnsembleByCell(
        context,
        scenario,
        stressModel,
        sampleCount,
        scenarioSeed,
      );

  if (!exposureSamples.length || budget <= 0) {
    return {
      plan: [],
      spentCredits: 0,
      diagnostics: {
        profile: policy,
        candidateCount: 0,
        robustObjectiveProxy: 0,
        scenarioSamples: exposureSamples.length,
        selectionMethod: 'marginal-robust-greedy',
        selectedProjects: [],
      },
    };
  }

  const candidates = buildCandidates(
    cellsGeoJson,
    exposureSamples.length,
    scenario.planningYear,
    projectSeedBase,
    policy,
  );

  const plan = [];
  const selectedDiagnostics = [];
  const selectedKeys = new Set();
  const countByCell = new Map();
  const remainingFractionByCell = new Map();
  let spentCredits = 0;
  let robustObjectiveProxy = 0;

  while (spentCredits < budget) {
    let best = null;

    for (const candidate of candidates) {
      const key = `${candidate.cell_id}:${candidate.type}`;
      if (selectedKeys.has(key)) continue;
      if (spentCredits + candidate.costCredits > budget) continue;
      if (
        (countByCell.get(candidate.cell_id) ?? 0) >=
        MODEL_LIMITS.maxProjectsPerCell
      ) continue;

      const marginal = robustMarginalValue({
        candidate,
        exposureSamples,
        remainingFractionByCell,
        profile: policy,
      });
      if (marginal.robustValue <= 0) continue;

      if (
        !best ||
        marginal.scorePerCredit > best.scorePerCredit ||
        (
          marginal.scorePerCredit === best.scorePerCredit &&
          marginal.robustValue > best.robustValue
        )
      ) {
        best = { candidate, ...marginal };
      }
    }

    if (!best) break;

    const { candidate } = best;
    plan.push({ cell_id: candidate.cell_id, type: candidate.type });
    selectedDiagnostics.push({
      cell_id: candidate.cell_id,
      type: candidate.type,
      costCredits: candidate.costCredits,
      opportunity: candidate.opportunity,
      equityShare: candidate.equityShare,
      accessIndex: candidate.accessIndex,
      equityFactor: candidate.equityFactor,
      accessFactor: candidate.accessFactor,
      meanMarginalBenefit: best.meanBenefit,
      p10MarginalBenefit: best.p10Benefit,
      downside: best.downside,
      marginalRobustValue: best.robustValue,
      scorePerCredit: best.scorePerCredit,
    });
    spentCredits += candidate.costCredits;
    robustObjectiveProxy += best.robustValue;
    selectedKeys.add(`${candidate.cell_id}:${candidate.type}`);
    countByCell.set(
      candidate.cell_id,
      (countByCell.get(candidate.cell_id) ?? 0) + 1,
    );
    applyCandidate(candidate, remainingFractionByCell);
  }

  return {
    plan,
    spentCredits,
    diagnostics: {
      profile: policy,
      candidateCount: candidates.length,
      robustObjectiveProxy,
      scenarioSamples: exposureSamples.length,
      selectionMethod: 'marginal-robust-greedy',
      selectedProjects: selectedDiagnostics,
    },
  };
}

export function planCostCredits(projects) {
  return projects.reduce(
    (sum, project) => sum + (INTERVENTIONS[project.type]?.costCredits ?? 0),
    0,
  );
}

export function fitPlanToBudget(projects, budgetCredits) {
  const budget = Math.max(0, Number(budgetCredits));
  const fitted = [];
  const keys = new Set();
  const countByCell = new Map();
  let spent = 0;

  for (const project of projects) {
    const cellId = Number(project.cell_id);
    const key = `${cellId}:${project.type}`;
    const cost = INTERVENTIONS[project.type]?.costCredits ?? 0;
    const cellCount = countByCell.get(cellId) ?? 0;

    if (
      !Number.isFinite(cellId) ||
      cost <= 0 ||
      keys.has(key) ||
      cellCount >= MODEL_LIMITS.maxProjectsPerCell ||
      spent + cost > budget
    ) continue;

    fitted.push({ cell_id: cellId, type: project.type });
    keys.add(key);
    countByCell.set(cellId, cellCount + 1);
    spent += cost;
  }
  return fitted;
}
