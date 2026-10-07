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
  ['fichas', 'measure_fichas.json'],
  ['context', 'municipal_context.json'],
];

// Precomputed by `python -m decision_engine.build`. The app works without them: their sections hide.
const ENGINE_FILES = [
  ['ranges', 'uncertainty_ranges.json'],
  ['levers', 'lever_profiles.json'],
  ['robustness', 'robustness.json'],
  ['breaking', 'breaking_points.json'],
  ['voi', 'value_of_information.json'],
];

async function optionalJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function loadCornareData() {
  const base = import.meta.env.BASE_URL;
  const entries = await Promise.all(FILES.map(async ([key, file]) => {
    const response = await fetch(`${base}data/cornare/${file}`);
    if (!response.ok) throw new Error(`No se pudo leer ${file}`);
    return [key, await response.json()];
  }));
  const engine = await Promise.all(ENGINE_FILES.map(async ([key, file]) => [key, await optionalJson(`${base}data/cornare/${file}`)]));
  return { ...Object.fromEntries(entries), engine: Object.fromEntries(engine) };
}
