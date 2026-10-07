import { HAZARD_SCORE, MODEL_PARAMETERS } from '../config/modelConfig.js';
import { clamp } from '../utils/math.js';

export function hazardScore(category) {
  return HAZARD_SCORE[category] ?? HAZARD_SCORE.Baja;
}

export function spatialSusceptibility(properties) {
  const { spatialWeights, slopeNormalizationDegrees } = MODEL_PARAMETERS.stress;
  const slope = clamp(Number(properties.slope_deg ?? 0) / slopeNormalizationDegrees);
  return spatialWeights.hazard * hazardScore(properties.hazard_max) + spatialWeights.slope * slope;
}

export function climateMultiplier({ rainMm, antecedentWetness }) {
  const { rainNormalization, climateWeights } = MODEL_PARAMETERS.stress;
  const rainNormalized = clamp(
    (Number(rainMm) - rainNormalization.offsetMm) / rainNormalization.spanMm,
  );
  const wetness = clamp(Number(antecedentWetness));
  return (
    climateWeights.base +
    climateWeights.rain * rainNormalized +
    climateWeights.antecedentWetness * wetness
  );
}

export function baselineStress(properties, scenario) {
  return clamp(spatialSusceptibility(properties) * climateMultiplier(scenario));
}
