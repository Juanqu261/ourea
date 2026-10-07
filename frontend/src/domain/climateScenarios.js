export const EXPLORE_PRESET_ID = 'explore';

export function observationalPresets(climateContext) {
  return Array.isArray(climateContext?.scenario_presets)
    ? climateContext.scenario_presets
    : [];
}

export function presetById(climateContext, presetId) {
  return observationalPresets(climateContext).find((item) => item.id === presetId) ?? null;
}

export function scenarioFromPreset(preset, extras = {}) {
  if (!preset) {
    throw new Error('Climate preset is required');
  }
  return {
    rainMm: Number(preset.precipitation_mm),
    antecedentWetness: Number(preset.antecedent_rainfall_percentile),
    planningYear: Number(extras.planningYear ?? 1),
    presetId: preset.id,
    climate: {
      accumulationWindowDays: Number(preset.accumulation_window_days),
      percentile: Number(preset.percentile),
      climatologyPeriod: preset.climatology_period,
      sourceName: preset.source_name,
      antecedentWindowDays: Number(preset.antecedent_window_days),
    },
  };
}

export function defaultScenarioFromClimate(climateContext, budgetCredits = 10) {
  const typical = presetById(climateContext, 'typical_wet');
  if (!typical) {
    throw new Error('climate_context.json is missing the typical_wet preset');
  }
  return {
    ...scenarioFromPreset(typical),
    budgetCredits: Number(budgetCredits),
  };
}

export function rainStepsFromClimate(climateContext) {
  const rains = observationalPresets(climateContext)
    .map((item) => Number(item.precipitation_mm))
    .filter((value) => Number.isFinite(value));
  return rains.length ? rains : null;
}

export function matchPresetId(climateContext, scenario) {
  const matched = observationalPresets(climateContext).find(
    (preset) =>
      Number(preset.precipitation_mm) === Number(scenario.rainMm)
      && Number(preset.antecedent_rainfall_percentile) === Number(scenario.antecedentWetness),
  );
  return matched?.id ?? EXPLORE_PRESET_ID;
}

export function climateSourceSummary(climateContext) {
  if (!climateContext) return null;
  return {
    source_name: climateContext.source_name,
    source_version: climateContext.source_version,
    doi: climateContext.doi,
    climatology_period: climateContext.climatology_period,
    spatial_resolution: climateContext.spatial_resolution,
    temporal_resolution: climateContext.temporal_resolution,
    area: climateContext.area,
  };
}
