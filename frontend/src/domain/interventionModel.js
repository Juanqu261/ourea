import {
  INTERVENTIONS,
  MODEL_LIMITS,
  RWH_ASSUMPTIONS,
} from '../config/modelConfig.js';
import { clamp, createSeededRandom } from '../utils/math.js';
import { stableProjectSeed } from './uncertainty.js';

/** Joint effect-range scale for sensitivity runs only (does not mutate canonical params). */
let effectRangeMultiplier = 1;

export function getEffectRangeMultiplier() {
  return effectRangeMultiplier;
}

export function withEffectRangeMultiplier(multiplier, fn) {
  const previous = effectRangeMultiplier;
  effectRangeMultiplier = Number(multiplier);
  if (!Number.isFinite(effectRangeMultiplier) || effectRangeMultiplier <= 0) {
    effectRangeMultiplier = previous;
    throw new Error(`Invalid effectRangeMultiplier: ${multiplier}`);
  }
  try {
    return fn();
  } finally {
    effectRangeMultiplier = previous;
  }
}

export function interventionConfig(type) {
  const config = INTERVENTIONS[type];
  if (!config) throw new Error(`Unknown intervention type: ${type}`);
  return config;
}

export function scaledEffectRange(type) {
  const [low, high] = interventionConfig(type).effectRange;
  const m = effectRangeMultiplier;
  return [low * m, high * m];
}

export function projectKey(project) {
  return `${Number(project.cell_id)}:${project.type}`;
}

export function maturityFactor(type, planningYear) {
  const years = Number(interventionConfig(type).maturityYears ?? 0);
  if (years <= 0) return 1;
  return clamp(Number(planningYear) / years);
}

export function sampleProjectEffects(projects, random) {
  const effects = new Map();
  for (const project of projects) {
    const [low, high] = scaledEffectRange(project.type);
    effects.set(projectKey(project), low + (high - low) * random());
  }
  return effects;
}

export function sampleProjectEffectsForFuture(
  projects,
  futureIndex,
  baseSeed = 1009,
) {
  const effects = new Map();
  const futureSeed = (
    Number(baseSeed) +
    Math.imul((Number(futureIndex) + 1) >>> 0, 2654435761)
  ) >>> 0;

  for (const project of projects) {
    const [low, high] = scaledEffectRange(project.type);
    const random = createSeededRandom(stableProjectSeed(project, futureSeed));
    effects.set(projectKey(project), low + (high - low) * random());
  }
  return effects;
}

export function indexProjectsByCell(projects) {
  const byCell = new Map();
  for (const project of projects) {
    const cellId = Number(project.cell_id);
    const list = byCell.get(cellId) ?? [];
    list.push(project);
    byCell.set(cellId, list);
  }
  return byCell;
}

export function cellReduction({
  cell,
  projects = [],
  planningYear,
  sampledEffects = null,
}) {
  let remainingFraction = 1;

  for (const project of projects) {
    const config = interventionConfig(project.type);
    const suitability = clamp(Number(cell[config.suitabilityField] ?? 0));
    const [low, high] = scaledEffectRange(project.type);
    const effect = sampledEffects?.get(projectKey(project)) ?? (low + high) / 2;
    const localReduction = clamp(
      effect * suitability * maturityFactor(project.type, planningYear),
      0,
      MODEL_LIMITS.maxLocalReduction,
    );
    remainingFraction *= 1 - localReduction;
  }

  return 1 - remainingFraction;
}

export function capturedRainwaterVolumeM3(cellsGeoJson, projects, rainMm) {
  const cellsById = new Map(
    cellsGeoJson.features.map((feature) => [
      Number(feature.properties.cell_id),
      feature.properties,
    ]),
  );

  let totalM3 = 0;
  const countedProjects = new Set();
  for (const project of projects) {
    if (project.type !== 'rwh') continue;
    const key = projectKey(project);
    if (countedProjects.has(key)) continue;
    countedProjects.add(key);

    const cell = cellsById.get(Number(project.cell_id));
    if (!cell) continue;

    const roofM2 = Math.max(0, Number(cell.roof_footprint_m2 ?? 0));
    const buildings = Math.max(0, Number(cell.buildings ?? 0));
    const runoffM3 =
      (Math.max(0, Number(rainMm)) / 1000) *
      roofM2 *
      RWH_ASSUMPTIONS.runoffCoefficient;
    const storageM3 =
      RWH_ASSUMPTIONS.storageM3PerParticipatingBuilding *
      buildings *
      RWH_ASSUMPTIONS.participationShare;

    totalM3 += Math.min(runoffM3, storageM3);
  }

  return totalM3;
}
