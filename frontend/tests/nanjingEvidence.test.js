/**
 * Evidence-layer tests after WorldCover integration.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function loadJson(rel) {
  return JSON.parse(readFileSync(join(root, rel), 'utf8'));
}

test('WorldCover meta records official S3 key and windowed-read', () => {
  const wc = loadJson('data/derived/nanjing/worldcover_meta.json');
  assert.equal(wc.status, 'windowed-read');
  assert.ok(wc.tiles.some((t) => String(t.s3_key).includes('N30E117_Map.tif')));
  assert.ok(wc.tiles[0].checksum_sha256);
});

test('planning cell feature table documents columns and has no equity score', () => {
  const table = loadJson('data/derived/nanjing/planning_cell_features.json');
  assert.equal(table.cell_count, 80);
  assert.ok(table.column_documentation.population_estimate);
  assert.ok(table.column_documentation.runoff_pressure_proxy);
  for (const row of table.rows) {
    assert.equal(row.equity_score, null);
    assert.ok(row.population_estimate >= 0);
    assert.ok(row.built_up_fraction == null || (row.built_up_fraction >= 0 && row.built_up_fraction <= 1));
  }
});

test('spatial alignment QA passes and diagnostic figure exists', () => {
  const qa = loadJson('data/derived/nanjing/spatial_alignment_qa.json');
  assert.equal(qa.all_pass, true);
  assert.ok(existsSync(join(root, 'data/derived/nanjing/spatial_alignment_qa.png')));
});

test('competitive benchmark has four core strategies and reports unfavorable greedy Nanjing honestly', () => {
  const bench = loadJson('data/derived/competitive_benchmark.json');
  assert.equal(bench.nanjing_specific_optimizer, false);
  const nj = bench.cases.find((c) => c.case_id === 'nanjing_xianlin');
  const ids = nj.strategies.map((s) => s.id);
  assert.ok(ids.includes('random_feasible'));
  assert.ok(ids.includes('greedy_opportunity'));
  assert.ok(ids.includes('deterministic_central'));
  assert.ok(ids.includes('ourea_robust'));
  const greedy = nj.strategies.find((s) => s.id === 'greedy_opportunity');
  assert.ok(greedy.mean_p10 < nj.strategies.find((s) => s.id === 'ourea_robust').mean_p10);
});

test('red-team paired benchmark freezes primary robust vs deterministic claims', () => {
  const rt = loadJson('data/derived/cicsic_redteam_benchmark.json');
  assert.equal(rt.protocol.pairedEvaluation, true);
  assert.ok(rt.protocol.trials >= 100);
  assert.equal(rt.protocol.primaryBaseline, 'deterministic_central');
  const nj = rt.citySummaries.find((c) => c.city === 'nanjing_xianlin');
  const med = rt.citySummaries.find((c) => c.city === 'medellin');
  assert.ok(nj && med);
  assert.ok(
    nj.strategies.ourea_robust.p10.mean > nj.strategies.deterministic_central.p10.mean,
  );
  assert.ok(
    nj.strategies.greedy_opportunity.p10.mean < nj.strategies.ourea_robust.p10.mean,
  );
  assert.equal(nj.primaryComparison.robust_minus_deterministic.relative_unsafe, false);
});

test('retrospective comparison never marks municipal projects as optimizer inputs', () => {
  const retro = loadJson('frontend/public/data/nanjing/retrospective_comparison.json');
  assert.equal(retro.optimizer_input, false);
  assert.ok(retro.independent_result.plan.length > 0);
  for (const row of retro.comparisons) {
    assert.equal(row.optimizer_input, false);
  }
});

test('summary uses WorldPop and WorldCover after evidence rebuild', () => {
  const summary = loadJson('frontend/public/data/nanjing/summary.json');
  assert.match(summary.population_label, /WorldPop 2026/);
  assert.equal(summary.worldcover_used, true);
  assert.ok(summary.population_estimate > 40000);
});

test('Nanjing Step-1 screening is overview polygons, not the raw 80-cell grid', () => {
  const screening = loadJson('frontend/public/data/nanjing/screening.geojson');
  const cells = loadJson('frontend/public/data/nanjing/planning_cells.geojson');
  const meta = loadJson('frontend/public/data/nanjing/overview_meta.json');
  const coverage = loadJson('data/derived/nanjing/overview_coverage.json');
  assert.equal(cells.features.length, 80);
  assert.ok(screening.features.length < 60);
  assert.ok(screening.features.length >= 8);
  assert.equal(meta.planning_cells_unchanged, true);
  assert.equal(meta.planning_cell_count, 80);
  assert.ok(coverage.coverage_pct >= 99);
  assert.ok(meta.coverage.coverage_pct >= 99);
  assert.ok(meta.osm_named_count >= 5);
  assert.ok(meta.derived_sector_count >= 1);
  for (const feature of screening.features) {
    const cls = feature.properties.geometry_class;
    assert.ok(cls === 'osm_named_polygon' || cls === 'derived_screening_sector');
    assert.ok(Array.isArray(feature.properties.member_cell_ids));
    assert.ok(feature.properties.priority_balanced >= 0);
    assert.ok(feature.properties.priority_balanced <= 1);
    assert.equal(feature.properties.map_fill, true);
    assert.doesNotMatch(String(feature.properties.NAME ?? ''), /^Xianlin cell \d+$/);
    if (cls === 'derived_screening_sector') {
      assert.match(String(feature.properties.NAME), /^Screening Sector /);
      assert.doesNotMatch(String(feature.properties.NAME), /[\u4e00-\u9fff]/);
    }
  }
  const focus = screening.features.filter((f) => f.properties.is_focus_area);
  assert.ok(focus.length >= 1);
});

test('Nanjing overview maps member cells onto the unchanged planning-cell IDs', () => {
  const screening = loadJson('frontend/public/data/nanjing/screening.geojson');
  const cells = loadJson('frontend/public/data/nanjing/planning_cells.geojson');
  const cellIds = new Set(cells.features.map((f) => Number(f.properties.cell_id)));
  const assigned = new Set();
  for (const feature of screening.features) {
    for (const id of feature.properties.member_cell_ids) {
      assert.ok(cellIds.has(Number(id)));
      assigned.add(Number(id));
    }
  }
  assert.equal(assigned.size, 80);
});

test('Nanjing building massing is visualization-only and separate from optimizer buildings', () => {
  const exposure = loadJson('frontend/public/data/nanjing/buildings.geojson');
  const massing = loadJson('frontend/public/data/nanjing/building_massing.geojson');
  const meta = loadJson('frontend/public/data/nanjing/building_massing_meta.json');
  assert.equal(exposure.features.length, 80);
  assert.ok(exposure.features.every((f) => f.geometry.type === 'Point'));
  assert.ok(massing.features.length >= 1000);
  assert.ok(massing.features.every((f) => f.geometry.type === 'Polygon'));
  assert.equal(meta.optimizer_input, false);
  const sources = new Set();
  const classes = new Set();
  const scores = new Set();
  for (const feature of massing.features) {
    assert.equal(feature.properties.optimizer_input, false);
    assert.equal(feature.properties.visualization_only, true);
    assert.ok(Number(feature.properties.visual_height_m) > 0);
    assert.ok(Number.isFinite(Number(feature.properties.visual_priority_score)));
    assert.ok(feature.properties.visual_priority_score >= 0);
    assert.ok(feature.properties.visual_priority_score <= 1);
    assert.ok(['lower', 'medium', 'higher'].includes(feature.properties.priority_class));
    assert.ok(Number.isFinite(Number(feature.properties.source_cell_id)));
    sources.add(feature.properties.height_source);
    classes.add(feature.properties.priority_class);
    scores.add(Number(feature.properties.visual_priority_score));
    const [lon, lat] = feature.geometry.coordinates[0][0];
    assert.ok(lon >= 118.88 && lon <= 118.97);
    assert.ok(lat >= 32.075 && lat <= 32.145);
  }
  assert.ok(sources.has('fallback_visualization_proxy') || sources.has('level_derived_visualization') || sources.has('osm_reported_height'));
  assert.ok(classes.size >= 2, 'buildings must show more than one screening-intensity class');
  assert.ok(scores.size >= 10, 'building tones must vary across distinct priority scores');
  assert.equal(meta.color_logic.optimizer_input, false);
  assert.match(meta.color_logic.driver, /drainage_stress_proxy/);
});
