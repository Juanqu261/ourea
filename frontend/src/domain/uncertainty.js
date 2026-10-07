import { MODEL_PARAMETERS } from '../config/modelConfig.js';
import { clamp, createSeededRandom } from '../utils/math.js';

export function sampleScenario(baseScenario, random) {
  const [rainLow, rainHigh] = MODEL_PARAMETERS.scenarioUncertainty.rainMultiplier;
  const wetnessHalfRange = MODEL_PARAMETERS.scenarioUncertainty.antecedentWetnessHalfRange;
  const rainMultiplier = rainLow + (rainHigh - rainLow) * random();

  return {
    ...baseScenario,
    rainMm: Math.max(0, Number(baseScenario.rainMm) * rainMultiplier),
    antecedentWetness: clamp(
      Number(baseScenario.antecedentWetness) + (random() * 2 - 1) * wetnessHalfRange,
    ),
  };
}

export function scenarioEnsemble(
  baseScenario,
  runs,
  seed = MODEL_PARAMETERS.scenarioUncertainty.baseSeed,
) {
  const count = Math.max(0, Math.floor(Number(runs)));
  const random = createSeededRandom(seed);
  return Array.from({ length: count }, () => sampleScenario(baseScenario, random));
}

export function stableProjectSeed(
  project,
  baseSeed = MODEL_PARAMETERS.scenarioUncertainty.baseSeed,
) {
  const text = `${Number(project.cell_id)}:${project.type}`;
  let hash = baseSeed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}
