import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { buildingStressGeoJson, createScenarioContext } from '../src/domain/scenarioEngine.js';
import { scenarioFromPreset, observationalPresets } from '../src/domain/climateScenarios.js';
import {
  massingDisplayStress,
  screeningConditionClass,
  stressByCellId,
} from '../src/domain/nanjingMassingStress.js';
import { nanjingCase } from '../src/config/cases/nanjingCase.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadJson(rel) {
  return JSON.parse(readFileSync(join(root, rel), 'utf8'));
}

function cloneBuildings(buildings) {
  return {
    type: 'FeatureCollection',
    features: buildings.features.map((feature, index) => ({
      ...feature,
      id: index + 1,
      properties: { ...feature.properties },
    })),
  };
}

function stressSnapshot(buildingsGeoJson) {
  return buildingsGeoJson.features.map((f) => ({
    cell_id: Number(f.properties.cell_id),
    scenario_stress: Number(f.properties.scenario_stress),
  }));
}

test('Nanjing condition presets recompute exposure-proxy scenario_stress', () => {
  const buildings = loadJson('public/data/nanjing/buildings.geojson');
  const cells = loadJson('public/data/nanjing/planning_cells.geojson');
  const climate = loadJson('public/data/nanjing/climate_context.json');
  const context = createScenarioContext(buildings, cells);
  const presets = observationalPresets(climate);
  const typical = presets.find((p) => p.id === 'typical_wet');
  const extreme = presets.find((p) => p.id === 'extreme_observed');
  assert.ok(typical && extreme);

  const typicalScenario = scenarioFromPreset(typical, { planningYear: 1 });
  const extremeScenario = scenarioFromPreset(extreme, { planningYear: 1 });

  const typicalFc = buildingStressGeoJson({
    context,
    projects: [],
    scenario: typicalScenario,
    originalGeoJson: cloneBuildings(buildings),
  });
  const extremeFc = buildingStressGeoJson({
    context,
    projects: [],
    scenario: extremeScenario,
    originalGeoJson: cloneBuildings(buildings),
  });

  const typicalSnap = stressSnapshot(typicalFc);
  const extremeSnap = stressSnapshot(extremeFc);
  assert.equal(typicalSnap.length, 80);
  assert.ok(extremeSnap.every((row, i) => row.scenario_stress >= typicalSnap[i].scenario_stress - 1e-9));
  assert.ok(
    extremeSnap.some((row, i) => row.scenario_stress > typicalSnap[i].scenario_stress + 1e-6),
    'at least one cell must intensify under Extreme vs Typical',
  );
});

test('Nanjing plan reduces residual stress only on targeted cells', () => {
  const buildings = loadJson('public/data/nanjing/buildings.geojson');
  const cells = loadJson('public/data/nanjing/planning_cells.geojson');
  const climate = loadJson('public/data/nanjing/climate_context.json');
  const context = createScenarioContext(buildings, cells);
  const typical = observationalPresets(climate).find((p) => p.id === 'typical_wet');
  const scenario = scenarioFromPreset(typical, { planningYear: 1 });

  const targetCell = Number(cells.features[0].properties.cell_id);
  const otherCell = Number(cells.features[1].properties.cell_id);

  const baseline = buildingStressGeoJson({
    context,
    projects: [],
    scenario,
    originalGeoJson: cloneBuildings(buildings),
  });
  const withPlan = buildingStressGeoJson({
    context,
    projects: [{ cell_id: targetCell, type: 'rwh' }],
    scenario,
    originalGeoJson: cloneBuildings(buildings),
  });

  const baseByCell = Object.fromEntries(stressSnapshot(baseline).map((r) => [r.cell_id, r.scenario_stress]));
  const planByCell = Object.fromEntries(stressSnapshot(withPlan).map((r) => [r.cell_id, r.scenario_stress]));

  assert.ok(planByCell[targetCell] < baseByCell[targetCell]);
  assert.equal(planByCell[otherCell], baseByCell[otherCell]);

  // drainage and restoration also reduce when suitability > 0
  for (const type of nanjingCase.availableInterventionTypes) {
    const residual = buildingStressGeoJson({
      context,
      projects: [{ cell_id: targetCell, type }],
      scenario,
      originalGeoJson: cloneBuildings(buildings),
    });
    const row = residual.features.find((f) => Number(f.properties.cell_id) === targetCell);
    assert.ok(Number(row.properties.scenario_stress) <= baseByCell[targetCell] + 1e-12);
  }
});

test('massing inherits live cell stress and keeps scale classes comparable', () => {
  const buildings = loadJson('public/data/nanjing/buildings.geojson');
  const cells = loadJson('public/data/nanjing/planning_cells.geojson');
  const massing = loadJson('public/data/nanjing/building_massing.geojson');
  const climate = loadJson('public/data/nanjing/climate_context.json');
  const context = createScenarioContext(buildings, cells);
  const typical = observationalPresets(climate).find((p) => p.id === 'typical_wet');
  const extreme = observationalPresets(climate).find((p) => p.id === 'extreme_observed');

  const typicalFc = buildingStressGeoJson({
    context,
    projects: [],
    scenario: scenarioFromPreset(typical, { planningYear: 1 }),
    originalGeoJson: cloneBuildings(buildings),
  });
  const extremeFc = buildingStressGeoJson({
    context,
    projects: [],
    scenario: scenarioFromPreset(extreme, { planningYear: 1 }),
    originalGeoJson: cloneBuildings(buildings),
  });

  const typicalByCell = stressByCellId(typicalFc);
  const extremeByCell = stressByCellId(extremeFc);
  const sample = massing.features.find((f) => Number.isFinite(Number(f.properties.source_cell_id)));
  assert.ok(sample);
  const t = massingDisplayStress(sample, typicalByCell);
  const e = massingDisplayStress(sample, extremeByCell);
  assert.ok(e >= t - 1e-12);
  assert.ok(['lower', 'medium', 'higher'].includes(screeningConditionClass(t, { nanjingStops: true })));
  assert.ok(['lower', 'medium', 'higher'].includes(screeningConditionClass(e, { nanjingStops: true })));
  // Calibrated Nanjing stops must separate compressed absolute stress bands.
  assert.equal(screeningConditionClass(0.22, { nanjingStops: true }), 'lower');
  assert.equal(screeningConditionClass(0.31, { nanjingStops: true }), 'medium');
  assert.equal(screeningConditionClass(0.40, { nanjingStops: true }), 'higher');
  assert.equal(screeningConditionClass(0.40), 'lower'); // Medellín stops keep 0.40 in lower

  const targetCell = Number(sample.properties.source_cell_id);
  const planned = buildingStressGeoJson({
    context,
    projects: [{ cell_id: targetCell, type: 'rwh' }],
    scenario: scenarioFromPreset(typical, { planningYear: 1 }),
    originalGeoJson: cloneBuildings(buildings),
  });
  const plannedByCell = stressByCellId(planned);
  assert.ok(massingDisplayStress(sample, plannedByCell) <= t + 1e-12);
});

test('condition then plan invalidation recomputes residual against new scenario', () => {
  const buildings = loadJson('public/data/nanjing/buildings.geojson');
  const cells = loadJson('public/data/nanjing/planning_cells.geojson');
  const climate = loadJson('public/data/nanjing/climate_context.json');
  const context = createScenarioContext(buildings, cells);
  const typical = observationalPresets(climate).find((p) => p.id === 'typical_wet');
  const extreme = observationalPresets(climate).find((p) => p.id === 'extreme_observed');
  const targetCell = Number(cells.features[3].properties.cell_id);
  const plan = [{ cell_id: targetCell, type: 'drainage' }];

  const typicalPlan = buildingStressGeoJson({
    context,
    projects: plan,
    scenario: scenarioFromPreset(typical, { planningYear: 1 }),
    originalGeoJson: cloneBuildings(buildings),
  });
  const extremePlan = buildingStressGeoJson({
    context,
    projects: plan,
    scenario: scenarioFromPreset(extreme, { planningYear: 1 }),
    originalGeoJson: cloneBuildings(buildings),
  });

  const t = Number(typicalPlan.features.find((f) => Number(f.properties.cell_id) === targetCell).properties.scenario_stress);
  const e = Number(extremePlan.features.find((f) => Number(f.properties.cell_id) === targetCell).properties.scenario_stress);
  assert.ok(e >= t - 1e-9);
});
