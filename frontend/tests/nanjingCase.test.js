/**
 * Nanjing / case-adapter unit tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASE_IDS, getCase, listCases, medellinCase, nanjingCase } from '../src/config/cases/index.js';
import nanjingGuardrails from '../src/config/nanjingScientificGuardrails.json' with { type: 'json' };
import { compareSelectionStrategies } from '../src/domain/benchmark.js';
import { createScenarioContext } from '../src/domain/scenarioEngine.js';
import { generateAlternativePortfolios } from '../src/domain/alternatives.js';
import { defaultScenarioFromClimate } from '../src/domain/climateScenarios.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadJson(rel) {
  return JSON.parse(readFileSync(join(root, rel), 'utf8'));
}

test('case registry exposes Medellín primary and Nanjing portability', () => {
  const cases = listCases();
  assert.equal(cases.length, 2);
  assert.equal(getCase(CASE_IDS.MEDELLIN).caseType, 'primary_proving_ground');
  assert.equal(getCase(CASE_IDS.NANJING).caseType, 'portability_demonstration');
  assert.equal(nanjingCase.usesEquityLens, false);
  assert.ok(nanjingCase.unsupportedFeatures.includes('equity_lens'));
});

test('Nanjing data manifest records provenance and forbids retrospective as optimizer inputs', () => {
  const manifest = loadJson('public/data/nanjing/data_manifest.json');
  assert.equal(manifest.case_id, 'nanjing_xianlin_portability');
  assert.ok(Array.isArray(manifest.datasets));
  assert.ok(manifest.datasets.length >= 3);
  for (const id of manifest.forbidden_as_optimizer_inputs) {
    assert.ok(typeof id === 'string');
  }
  const retrospective = loadJson('public/data/nanjing/retrospective_validation.json');
  assert.equal(retrospective.optimizer_input, false);
  for (const project of retrospective.projects) {
    assert.equal(project.optimizer_input, false);
  }
});

test('Nanjing case copy avoids Medellín-only Step 1 wording', async () => {
  const { nanjingCase: nj } = await import('../src/config/cases/nanjingCase.js');
  assert.match(nj.stepAreaInstruction, /Xianlin/i);
  assert.doesNotMatch(
    nj.stepAreaInstruction,
    /Llanaditas|barrio|IMCV|Moravia|stratum/i,
  );
  assert.equal(nj.screeningMode, 'overview');
  assert.match(nj.legendCityNote, /screening sectors/i);
  assert.match(nj.legendSandboxBaselineNote, /Baseline/i);
  assert.match(nj.legendSandboxResidualNote, /After plan|residual/i);
  assert.ok(nj.dataPaths.buildingMassing);
  assert.ok(nj.boundingArea.mapViews.sandbox.pitch >= 35);
});

test('shared flow copy no longer hard-codes COP on Conditions step', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const file = path.join(process.cwd(), 'src/flow/steps/ConditionsStep.jsx');
  const text = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(text, /They are not COP/);
  assert.match(text, /not local currency|relative budget/i);
});

test('mapService uses keyless Esri basemap, not watermarked CARTO CDN', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const file = path.join(process.cwd(), 'src/services/mapService.js');
  const text = fs.readFileSync(file, 'utf8');
  const tilesMatch = text.match(/const BASEMAP_TILES = \[([\s\S]*?)\];/);
  assert.ok(tilesMatch, 'BASEMAP_TILES must be defined');
  assert.doesNotMatch(tilesMatch[1], /cartocdn/i);
  assert.doesNotMatch(tilesMatch[1], /tile\.openstreetmap\.org/);
  assert.match(tilesMatch[1], /server\.arcgisonline\.com/);
});

test('mapService uses live scenario_stress with Nanjing-calibrated color stops', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const text = fs.readFileSync(path.join(process.cwd(), 'src/services/mapService.js'), 'utf8');
  assert.match(text, /massingDisplayStress|stressByCellId/);
  assert.match(text, /feature-state', 'scenario_stress'/);
  assert.doesNotMatch(text, /fill-extrusion-color':\s*\[[\s\S]*height_source/);
  assert.doesNotMatch(text, /fill-extrusion-color':\s*\[[\s\S]*visual_priority_score/);
  assert.match(text, /#4f9b68/);
  assert.match(text, /#d7433c/);
  // Nanjing case-calibrated stops (compressed absolute stress domain)
  assert.match(text, /0\.28, '#c4a14b'/);
  assert.match(text, /0\.36, '#d66f45'/);
});

test('Nanjing population provenance is estimate language, not census', () => {
  const summary = loadJson('public/data/nanjing/summary.json');
  assert.match(String(summary.population_label), /estimate/i);
  assert.match(String(summary.note), /not census counts/i);
  const cells = loadJson('public/data/nanjing/planning_cells.geojson');
  for (const feature of cells.features.slice(0, 5)) {
    assert.equal(feature.properties.stratum1_buildings, 0);
    assert.match(String(feature.properties.note), /screening proxy/i);
  }
});

test('Nanjing artifacts do not embed Medellín coordinates or barrio names', () => {
  const cells = loadJson('public/data/nanjing/planning_cells.geojson');
  const blob = JSON.stringify(cells);
  assert.doesNotMatch(blob, /Llanaditas/i);
  assert.doesNotMatch(blob, /-75\.5/);
  const [west, south, east, north] = nanjingCase.boundingArea.sandboxBbox;
  const sample = cells.features[0].geometry.coordinates[0][0];
  assert.ok(sample[0] >= west && sample[0] <= east);
  assert.ok(sample[1] >= south && sample[1] <= north);
});

test('Nanjing guardrails forbid hydraulic / endorsement claims', () => {
  const text = nanjingGuardrails.items.join(' ').toLowerCase();
  assert.match(text, /portability demonstration/);
  assert.match(text, /hydraulic flood/);
  assert.match(text, /adaptation-screening/);
  for (const pattern of nanjingGuardrails.forbidden_claim_patterns) {
    assert.ok(pattern.length > 3);
  }
});

test('shared optimizer runs Nanjing profiles without a separate engine', () => {
  const buildings = loadJson('public/data/nanjing/buildings.geojson');
  const cells = loadJson('public/data/nanjing/planning_cells.geojson');
  const climate = loadJson('public/data/nanjing/climate_context.json');
  const context = createScenarioContext(buildings, cells);
  const scenario = defaultScenarioFromClimate(climate, 10);
  const options = generateAlternativePortfolios({
    context,
    cellsGeoJson: cells,
    scenario,
    budgetCredits: 10,
    profiles: nanjingCase.objectiveProfiles,
  });
  assert.equal(options.length, 4);
  assert.ok(options.every((option) => option.plan.length >= 0));
  assert.ok(options.some((option) => option.profileId === 'runoff_reduction'));
  assert.ok(!options.some((option) => option.profileId === 'equity'));
});

test('cross-city benchmark baselines share schema for Medellín and Nanjing', () => {
  const buildings = loadJson('public/data/buildings.geojson');
  const cells = loadJson('public/data/planning_cells.geojson');
  const climate = loadJson('public/data/climate_context.json');
  const context = createScenarioContext(buildings, cells);
  const scenario = defaultScenarioFromClimate(climate, 10);
  const med = compareSelectionStrategies({
    context,
    cellsGeoJson: cells,
    scenario,
    budgetCredits: 10,
    profile: 'balanced',
  });
  assert.ok(med.strategies.some((s) => s.id === 'random_feasible'));
  assert.ok(med.strategies.some((s) => s.id === 'greedy_opportunity'));
  assert.ok(med.strategies.some((s) => s.id === 'ourea_robust'));

  const nBuildings = loadJson('public/data/nanjing/buildings.geojson');
  const nCells = loadJson('public/data/nanjing/planning_cells.geojson');
  const nClimate = loadJson('public/data/nanjing/climate_context.json');
  const nContext = createScenarioContext(nBuildings, nCells);
  const nScenario = defaultScenarioFromClimate(nClimate, 10);
  const nj = compareSelectionStrategies({
    context: nContext,
    cellsGeoJson: nCells,
    scenario: nScenario,
    budgetCredits: 10,
    profile: { id: 'balanced', ...nanjingCase.objectiveProfiles.balanced },
  });
  assert.deepEqual(
    med.strategies.map((s) => s.id),
    nj.strategies.map((s) => s.id),
  );
});

test('Medellín case remains primary proving ground configuration', () => {
  assert.equal(medellinCase.hierarchyLabel, 'Primary proving ground');
  assert.equal(medellinCase.areaId, 'llanaditas');
  assert.ok(medellinCase.usesEquityLens);
});
