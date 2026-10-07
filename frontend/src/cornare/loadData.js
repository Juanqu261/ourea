const FILES = [
  ['interventions', 'interventions.json'],
  ['metrics', 'dimension_metrics.json'],
  ['history', 'adaptation_history.json'],
  ['parameters', 'decision_model.json'],
  ['gaps', 'information_gaps.json'],
  ['mea', 'mea_indicators.json'],
  ['profiles', 'municipality_profiles.json'],
  ['boundaries', 'municipalities.geojson'],
  ['sources', 'source_registry.json'],
];

export async function loadCornareData() {
  const base = import.meta.env.BASE_URL;
  const entries = await Promise.all(FILES.map(async ([key, file]) => {
    const response = await fetch(`${base}data/cornare/${file}`);
    if (!response.ok) throw new Error(`No se pudo leer ${file}`);
    return [key, await response.json()];
  }));
  return Object.fromEntries(entries);
}
