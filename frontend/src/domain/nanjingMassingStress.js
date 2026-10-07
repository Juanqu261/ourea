/**
 * Nanjing map massing inherits live scenario_stress from planning-cell exposure
 * proxies (same baselineStress × cellReduction pipeline as Medellín).
 * Visualization-only — never optimizer input.
 */
export function stressByCellId(buildingsGeoJson) {
  const byCell = new Map();
  for (const feature of buildingsGeoJson?.features ?? []) {
    const cellId = Number(feature.properties?.cell_id);
    if (!Number.isFinite(cellId)) continue;
    byCell.set(cellId, Number(feature.properties?.scenario_stress) || 0);
  }
  return byCell;
}

export function massingDisplayStress(massingFeature, stressByCell) {
  const cellId = Number(
    massingFeature?.properties?.source_cell_id
      ?? massingFeature?.properties?.cell_id,
  );
  if (!Number.isFinite(cellId)) return 0;
  if (!stressByCell.has(cellId)) return 0;
  return stressByCell.get(cellId);
}

export function screeningConditionClass(score, { nanjingStops = false } = {}) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 'lower';
  if (nanjingStops) {
    if (value < 0.28) return 'lower';
    if (value < 0.36) return 'medium';
    return 'higher';
  }
  if (value < 0.48) return 'lower';
  if (value < 0.68) return 'medium';
  return 'higher';
}
