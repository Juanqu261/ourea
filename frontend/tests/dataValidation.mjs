import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dataDir = join(root, 'public', 'data');

async function json(name) {
  return JSON.parse(await readFile(join(dataDir, name), 'utf8'));
}

function sumBy(features, field) {
  return features.reduce(
    (sum, feature) =>
      sum + Number(feature.properties[field] ?? 0),
    0,
  );
}

function approxEqual(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: ${actual} vs ${expected}`,
  );
}

function finite(value) {
  return value !== null &&
    value !== undefined &&
    value !== '' &&
    Number.isFinite(Number(value));
}

const buildings = await json('buildings.geojson');
const cells = await json('planning_cells.geojson');
const screening = await json('medellin_city_priority_screen.geojson');
const summary = await json('summary.json');
const registry = await json('intervention_registry.json');
const evidence = await json('evidence_status.json');
const climate = await json('climate_context.json');
const model = JSON.parse(
  await readFile(
    join(root, 'src', 'config', 'modelParameters.json'),
    'utf8',
  ),
);

assert.equal(
  buildings.features.length,
  1588,
  'detailed sandbox building count changed unexpectedly',
);
assert.equal(
  cells.features.length,
  49,
  'planning cell count changed unexpectedly',
);
assert.equal(
  screening.features.length,
  271,
  'city screen should preserve 271 official/special barrio polygons',
);
assert.equal(summary.buildings, 1588);
assert.equal(
  registry.optimizer.budget_unit,
  'planning credit, NOT COP',
);
assert.equal(model.status, 'planning-priors-explicit');
assert.equal(registry.status.includes('versioned evidence registry'), true);
assert.ok(!JSON.stringify(registry).includes('v2_model_role'));
assert.ok(!JSON.stringify(registry).includes('needs_before_submission'));
assert.match(
  summary.note,
  /Climate stress is a dimensionless planning index/,
);

const cityContract = JSON.parse(
  await readFile(join(root, 'src', 'config', 'cityScreenContract.json'), 'utf8'),
);
assert.equal(cityContract.spatial_polygons, 271);
assert.equal(cityContract.official_urban_records, 249);
assert.equal(cityContract.safe_population_matches, 248);
assert.equal(screening.features.length, cityContract.spatial_polygons);

const buildingIds = new Set();
for (const feature of buildings.features) {
  const p = feature.properties;
  assert.ok(finite(p.objectid), 'building missing objectid');
  assert.ok(
    !buildingIds.has(p.objectid),
    `duplicate building objectid ${p.objectid}`,
  );
  buildingIds.add(p.objectid);
  assert.ok(
    finite(p.cell_id),
    `building ${p.objectid} missing planning cell`,
  );
  assert.ok(
    Number(p.population_proxy ?? 0) >= 0,
    `negative population proxy for ${p.objectid}`,
  );
  assert.ok(
    ['Alta', 'Media', 'Baja'].includes(p.hazard_max),
    `invalid hazard category for ${p.objectid}`,
  );
}

const cellIds = new Set();
const opportunityFields = [
  'rwh_opportunity',
  'drainage_corridor_proxy',
  'restoration_opportunity',
];
const obsoleteFields = [
  'rwh_suitability',
  'drainage_suitability',
  'restoration_suitability',
];

for (const feature of cells.features) {
  const p = feature.properties;
  const cellId = Number(p.cell_id);
  assert.ok(Number.isFinite(cellId), 'planning cell missing numeric ID');
  assert.ok(
    !cellIds.has(cellId),
    `duplicate planning cell ID ${cellId}`,
  );
  cellIds.add(cellId);

  assert.ok(Number(p.buildings ?? 0) >= 0);
  assert.ok(Number(p.population_proxy ?? 0) >= 0);
  assert.ok(Number(p.households_proxy ?? 0) >= 0);

  for (const field of opportunityFields) {
    const value = Number(p[field]);
    assert.ok(
      Number.isFinite(value),
      `${field} missing/non-numeric in cell ${cellId}`,
    );
    assert.ok(
      value >= 0 && value <= 1,
      `${field} outside [0,1] in cell ${cellId}: ${value}`,
    );
  }

  for (const field of obsoleteFields) {
    assert.ok(
      !(field in p),
      `obsolete risk-weighted field ${field} remains`,
    );
  }
}

for (const feature of buildings.features) {
  assert.ok(
    cellIds.has(Number(feature.properties.cell_id)),
    `building ${feature.properties.objectid} references unknown planning cell`,
  );
}

assert.equal(
  sumBy(cells.features, 'buildings'),
  summary.buildings,
);
assert.equal(
  sumBy(cells.features, 'high_hazard_buildings'),
  summary.high_hazard_buildings,
);
assert.equal(
  sumBy(cells.features, 'stratum1_buildings'),
  summary.stratum_1_buildings,
);
approxEqual(
  sumBy(cells.features, 'population_proxy'),
  summary.population_proxy,
  1,
  'cell population proxy does not reconcile',
);
approxEqual(
  sumBy(cells.features, 'households_proxy'),
  summary.households_proxy,
  1,
  'cell household proxy does not reconcile',
);

const populationMatched = screening.features.filter(
  (feature) => finite(feature.properties.population_2026),
);
assert.equal(
  populationMatched.length,
  248,
  'City screen should safely match 248 of the 249 official urban population records to the current polygon export',
);

const lensSpecs = [
  ['priority_exposure', 'rank_exposure'],
  ['priority_balanced', 'rank_balanced'],
  ['priority_equity', 'rank_equity'],
];

for (const feature of populationMatched) {
  const p = feature.properties;
  assert.ok(Number(p.population_2026) > 0);
  assert.ok(finite(p.imcv_ampi_2023));
  assert.ok(finite(p.hazard_weighted_population_proxy_2026));
  assert.ok(
    Number(p.hazard_weighted_population_proxy_2026) >= 0,
  );

  for (const [scoreField, rankField] of lensSpecs) {
    const score = Number(p[scoreField]);
    const rank = Number(p[rankField]);
    assert.ok(
      score >= 0 && score <= 1,
      `${scoreField} outside [0,1] for ${p.BARRIO}`,
    );
    assert.ok(
      Number.isInteger(rank) &&
      rank >= 1 &&
      rank <= populationMatched.length,
      `invalid ${rankField} for ${p.BARRIO}`,
    );
  }
}

for (const [scoreField, rankField] of lensSpecs) {
  const ordered = [...populationMatched].sort(
    (a, b) =>
      Number(b.properties[scoreField]) -
      Number(a.properties[scoreField]),
  );
  const ranks = ordered.map(
    (feature) => Number(feature.properties[rankField]),
  );
  assert.equal(Math.min(...ranks), 1);
  assert.ok(
    Math.max(...ranks) <= populationMatched.length,
    `${rankField} exceeds matched-barrio count`,
  );
  for (let index = 1; index < ranks.length; index += 1) {
    assert.ok(
      ranks[index] >= ranks[index - 1],
      `${rankField} is inconsistent with descending ${scoreField}`,
    );
  }
}

const llanaditas = screening.features.filter((feature) =>
  String(feature.properties.BARRIO ?? '')
    .toUpperCase()
    .includes('LLANADITAS'),
);
assert.equal(
  llanaditas.length,
  1,
  'Llanaditas should resolve uniquely',
);
const ll = llanaditas[0].properties;
assert.equal(Number(ll.population_2026), 10416);
assert.equal(Number(ll.rank_hazard_only), 9);
assert.equal(Number(ll.rank_exposure), 7);
assert.equal(Number(ll.rank_balanced), 13);
assert.equal(Number(ll.rank_equity), 22);

assert.ok(
  Array.isArray(evidence.layers) &&
  evidence.layers.length >= 8,
);
assert.equal(evidence.schema, 'ourea-evidence-registry');
assert.equal(evidence.schema_version, 1);
const evidenceIds = new Set(
  evidence.layers.map((item) => item.id),
);
for (const required of [
  'terrain',
  'hazard',
  'buildings',
  'population',
  'access',
  'climate',
  'intervention_effects',
  'cost',
]) {
  assert.ok(
    evidenceIds.has(required),
    `missing evidence status for ${required}`,
  );
}

const guardrails = JSON.parse(
  await readFile(
    join(root, 'src', 'config', 'scientificGuardrails.json'),
    'utf8',
  ),
);
assert.ok(
  guardrails.items.some((item) => item.includes('not landslide probability')),
);
assert.ok(
  guardrails.items.some((item) => item.includes('not COP')),
);
assert.ok(
  guardrails.items.some((item) => item.includes('not a prediction of social acceptance')),
);

assert.equal(climate.schema, 'ourea-climate-context');
assert.equal(climate.source_version, 'v3.0');
assert.equal(climate.climatology_period.label, '1991-2020');
assert.ok(Array.isArray(climate.scenario_presets));
assert.deepEqual(
  climate.scenario_presets.map((item) => item.id),
  ['typical_wet', 'high_rainfall', 'extreme_observed'],
);
for (const preset of climate.scenario_presets) {
  assert.ok(Number.isFinite(preset.precipitation_mm));
  assert.equal(preset.accumulation_window_days, 15);
  assert.ok(preset.source_name.includes('CHIRPS'));
}
assert.ok(climate.daily_percentiles.p50 != null);
assert.ok(climate.rolling_accumulation_percentiles['15'].percentiles.p90 != null);
assert.ok(
  climate.limitations.some((item) => item.includes('does not issue real-time forecasts')),
);
assert.ok(
  climate.limitations.some((item) => item.toLowerCase().includes('not landslide probability')),
);
assert.ok(!JSON.stringify(climate).toLowerCase().includes('predicts landslide'));

assert.ok(
  !(
    'development_parameters' in
    registry.interventions.rainwater_harvesting
  ),
);
assert.equal(
  registry.parameter_source,
  'frontend/src/config/modelParameters.json',
);

const frontierBudgets = model.optimizer.frontierBudgets;
assert.deepEqual(
  [...frontierBudgets].sort((a, b) => a - b),
  frontierBudgets,
);
assert.equal(
  new Set(frontierBudgets).size,
  frontierBudgets.length,
);
assert.ok(
  Number(model.optimizer.frontierMonteCarloRuns) > 0 &&
  Number(model.optimizer.frontierScenarioSamples) > 0,
);

const profiles = model.optimizer.objectiveProfiles;
assert.deepEqual(
  Object.keys(profiles).sort(),
  ['access', 'balanced', 'equity', 'low_regret'].sort(),
);
for (const [name, profile] of Object.entries(profiles)) {
  assert.ok(
    Number(profile.equityWeight) >= 0,
    `negative equity weight: ${name}`,
  );
  assert.ok(
    Number(profile.accessWeight) >= 0,
    `negative access weight: ${name}`,
  );
  assert.ok(
    Number(profile.downsidePenalty) >= 0,
    `negative downside penalty: ${name}`,
  );
}

const pareto = model.optimizer.paretoGrid;
assert.ok(pareto.equityWeights.length >= 2);
assert.ok(pareto.accessWeights.length >= 2);
assert.ok(Number(pareto.optimizerScenarioSamples) > 0);
assert.ok(Number(pareto.monteCarloRuns) > 0);

async function countPngs(directory) {
  let count = 0;
  for (const entry of await readdir(
    directory,
    { withFileTypes: true },
  )) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      count += await countPngs(path);
    } else if (entry.name.endsWith('.png')) {
      count += 1;
    }
  }
  return count;
}

const terrainCount = await countPngs(
  join(root, 'public', 'terrain'),
);
assert.ok(
  terrainCount >= 50,
  `terrain tile pyramid unexpectedly small: ${terrainCount}`,
);

const alignment = JSON.parse(
  await readFile(join(root, 'public', 'data', 'plan_alignment.json'), 'utf8'),
);
const costContext = await json('cost_context.json');
assert.equal(costContext.schema, 'ourea-cost-context');
assert.equal(costContext.fx.date, '2026-08-28');
assert.equal(costContext.fx.cop_per_usd, 3144.28);
assert.equal(costContext.interventions.rwh.usd_per_system.base, 780);
assert.equal(costContext.interventions.drainage.length_m.base, 60);
assert.equal(costContext.interventions.drainage.method, 'rom_package');
assert.ok(costContext.interventions.drainage.usd_per_package.base > 800000);
assert.ok(costContext.sources.every((item) => item.url && item.id && item.reader_label));
assert.equal(alignment.schema, 'ourea-plan-alignment');
assert.equal(alignment.schema_version, 2);
assert.equal(alignment.status, 'documentary-alignment-not-community-support');
assert.ok(Array.isArray(alignment.entries) && alignment.entries.length >= 5);
assert.match(String(alignment.guardrail), /not community endorsement/i);
assert.ok(
  alignment.entries.every(
    (entry) =>
      entry.plan_action
      && (entry.source_url || entry.source)
      && entry.source_title
      && entry.evidence_gap
      && Array.isArray(entry.supports)
      && Array.isArray(entry.does_not_establish),
  ),
);
assert.ok(alignment.entries.some((entry) => entry.id === 'granizal-2025-mechanism'));

console.log(
  `Ourea data validation passed: ${buildings.features.length} buildings, ` +
  `${cells.features.length} cells, ${screening.features.length} city polygons, ` +
  `${populationMatched.length} population-matched barrios, ${terrainCount} terrain tiles.`,
);
