const MEASURE_LAYERS = {
  bio_pa: ['protected_areas'],
  bio_restore: ['protected_areas', 'wetlands'],
  bio_psa: ['protected_areas', 'wetlands'],
  water_eff: ['hydrography'],
  water_riparian: ['rio_negro_riparian', 'la_marinilla_zoning', 'la_marinilla_ecosystem', 'hydrography'],
  water_head: ['hydrography', 'protected_areas'],
  food_agro: [],
  food_soil: [],
  hab_green: ['wetlands'],
  hab_suds: ['hydrography'],
  infra_resilient: ['mass_movement'],
  infra_services: ['mass_movement'],
  risk_sat: ['mass_movement', 'hydrography', 'flood'],
  risk_knowledge: [],
  health: [],
};

const CANDIDATE_LAYERS = new Set([
  'protected_areas',
  'rio_negro_riparian',
  'la_marinilla_zoning',
  'la_marinilla_ecosystem',
]);

export const GREEN_BLUE_LAYERS = [
  'wetlands',
  'protected_areas',
  'rio_negro_riparian',
  'la_marinilla_ecosystem',
  'la_marinilla_zoning',
  'hydrography',
];

export function focusForMeasure(measure) {
  const municipalityIds = (measure.placement?.candidates ?? []).map((row) => row.municipalityId);
  const layerIds = MEASURE_LAYERS[measure.id] ?? [];
  return {
    measureId: measure.id,
    title: measure.name,
    municipalityIds,
    layerIds,
    scopeLabel: measure.place?.localization ?? 'Ámbito por confirmar',
    exactLocation: layerIds.some((id) => CANDIDATE_LAYERS.has(id))
      ? 'Área candidata para prefactibilidad'
      : 'Ubicación por validar',
    contextLabel: layerIds.length
      ? 'Contexto espacial disponible para mirar la medida. Esas geometrías no son el sitio de intervención.'
      : 'No hay una capa que localice esta medida.',
    sourceLabel: 'Ámbito: DANE MGN 2025. Contexto: servicios públicos de CORNARE, cuando la capa existe.',
  };
}
