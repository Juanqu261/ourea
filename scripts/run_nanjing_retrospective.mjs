#!/usr/bin/env node
/**
 * Run Nanjing optimizer independently, then write retrospective comparison
 * against municipal evidence (never used as optimizer inputs).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const frontendSrc = join(root, 'frontend', 'src');

function loadJson(rel) {
  return JSON.parse(readFileSync(join(root, rel), 'utf8'));
}

async function main() {
  const { generateAlternativePortfolios } = await import(
    pathToFileURL(join(frontendSrc, 'domain/alternatives.js')).href
  );
  const { createScenarioContext } = await import(
    pathToFileURL(join(frontendSrc, 'domain/scenarioEngine.js')).href
  );
  const { defaultScenarioFromClimate } = await import(
    pathToFileURL(join(frontendSrc, 'domain/climateScenarios.js')).href
  );
  const { nanjingCase } = await import(
    pathToFileURL(join(frontendSrc, 'config/cases/nanjingCase.js')).href
  );

  const buildings = loadJson('frontend/public/data/nanjing/buildings.geojson');
  const cells = loadJson('frontend/public/data/nanjing/planning_cells.geojson');
  const climate = loadJson('frontend/public/data/nanjing/climate_context.json');
  const features = loadJson('data/derived/nanjing/planning_cell_features.json');
  const municipal = loadJson('frontend/public/data/nanjing/retrospective_validation.json');

  const context = createScenarioContext(buildings, cells);
  const scenario = defaultScenarioFromClimate(climate, 10);
  const options = generateAlternativePortfolios({
    context,
    cellsGeoJson: cells,
    scenario,
    budgetCredits: 10,
    profiles: nanjingCase.objectiveProfiles,
  });

  const recommended = [...options].sort(
    (a, b) => b.uncertainty.p10 - a.uncertainty.p10 || b.downsideRetention - a.downsideRetention,
  )[0];

  const selectedIds = new Set(recommended.plan.map((p) => Number(p.cell_id)));
  const typeCounts = recommended.plan.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] ?? 0) + 1;
    return acc;
  }, {});

  const selectedRows = features.rows.filter((r) => selectedIds.has(r.cell_id));
  const meanElevSelected = selectedRows.length
    ? selectedRows.reduce((s, r) => s + r.mean_elevation_m, 0) / selectedRows.length
    : null;
  const meanElevAll = features.rows.reduce((s, r) => s + r.mean_elevation_m, 0) / features.rows.length;
  const meanBuiltSelected = selectedRows.length
    ? selectedRows.reduce((s, r) => s + (r.built_up_fraction ?? 0), 0) / selectedRows.length
    : null;

  // South-high / north-low check on full AOI (terrain pattern), not municipal training.
  const southern = features.rows.filter((r) => r.centroid_lat < 32.11);
  const northern = features.rows.filter((r) => r.centroid_lat >= 32.11);
  const southElev = southern.reduce((s, r) => s + r.mean_elevation_m, 0) / Math.max(1, southern.length);
  const northElev = northern.reduce((s, r) => s + r.mean_elevation_m, 0) / Math.max(1, northern.length);
  const elevRange = Math.max(...features.rows.map((r) => r.mean_elevation_m))
    - Math.min(...features.rows.map((r) => r.mean_elevation_m));
  const bothMidElevation = southElev > 10 && southElev < 50 && northElev > 10 && northElev < 50;
  const terrainComparable = elevRange >= 40 && !bothMidElevation;
  const southHighNorthLow = southElev > northElev + 2;
  const terrainConclusion = !terrainComparable
    ? 'not comparable'
    : southHighNorthLow
      ? 'partially consistent'
      : 'inconsistent';

  const comparisons = [
    {
      official_project_location: 'Qixia District topography (south-high / north-low)',
      documented_intervention_type: 'terrain context (not a project)',
      ourea_corresponding_pattern: `AOI elev range=${elevRange.toFixed(1)} m; south mean=${southElev.toFixed(1)} m; north mean=${northElev.toFixed(1)} m (Skadi)`,
      spatial_consistency: terrainComparable
        ? (southHighNorthLow ? 'consistent_direction' : 'inconsistent_direction')
        : 'not_comparable',
      functional_consistency: 'terrain_context_only',
      inconsistency: terrainComparable
        ? (southHighNorthLow
          ? 'None material for screening-scale relative relief'
          : 'Skadi AOI subset does not reproduce south-high / north-low')
        : 'Screening AOI sits in mid-elevation Xianlin terrain; it does not span Qixia south hills (50–300 m) vs northern Yangtze plain (<10 m), so district-scale relief is not testable here',
      conclusion: terrainConclusion,
      evidence_id: 'qixia_official_topography',
      optimizer_input: false,
    },
    {
      official_project_location: 'Yuanhua Road / Xianyin North Road waterlogging remediation (2026)',
      documented_intervention_type: 'drainage conveyance / pipe works',
      ourea_corresponding_pattern: `Independent robust plan type mix: ${JSON.stringify(typeCounts)}; drainage count=${typeCounts.drainage ?? 0}`,
      spatial_consistency: 'not_comparable',
      functional_consistency: (typeCounts.drainage ?? 0) > 0 ? 'thematic_overlap_possible' : 'no_drainage_selected',
      inconsistency:
        'Exact road-segment geometries were not used; cannot claim spatial coincidence with Yuanhua/Xianyin works',
      conclusion: (typeCounts.drainage ?? 0) > 0 ? 'partially consistent' : 'not comparable',
      evidence_id: 'xianlin_yuanhua_xianyin_2026',
      optimizer_input: false,
    },
    {
      official_project_location: 'Jiuxiang River / Hengyang Lake 9,000 m³ detention storage',
      documented_intervention_type: 'detention / rainwater storage',
      ourea_corresponding_pattern: `RWH/storage actions in independent plan: ${typeCounts.rwh ?? 0}`,
      spatial_consistency: 'not_comparable',
      functional_consistency: (typeCounts.rwh ?? 0) > 0 ? 'thematic_overlap_possible' : 'no_storage_selected',
      inconsistency:
        'Ourea did not discover the 9,000 m³ facility; capacity targets were never optimizer constraints',
      conclusion: (typeCounts.rwh ?? 0) > 0 ? 'partially consistent' : 'not comparable',
      evidence_id: 'hengyang_jiuxiang_storage',
      optimizer_input: false,
    },
    {
      official_project_location: 'Nanjing municipal waterlogging / drainage policy (2026–2030)',
      documented_intervention_type: 'policy context',
      ourea_corresponding_pattern: 'Case framing = monsoon urban drainage / stormwater adaptation screening',
      spatial_consistency: 'not_comparable',
      functional_consistency: 'policy_context_aligned',
      inconsistency: 'Policy alignment is not validation of ranking accuracy',
      conclusion: 'partially consistent',
      evidence_id: 'nanjing_water_plan_2026_2030',
      optimizer_input: false,
    },
  ];

  const payload = {
    schema: 'ourea-retrospective-comparison',
    schema_version: 2,
    generated_at: new Date().toISOString(),
    method:
      'Ourea portfolios generated independently first. Municipal projects compared afterward only.',
    optimizer_input: false,
    disclaimer:
      'Retrospective qualitative sanity check. Not municipal endorsement, hydraulic validation, or spatial discovery.',
    independent_result: {
      profileId: recommended.profileId,
      p10: recommended.uncertainty.p10,
      median: recommended.uncertainty.median,
      plan: recommended.plan,
      type_counts: typeCounts,
      selected_cell_ids: [...selectedIds],
      mean_elevation_selected: meanElevSelected,
      mean_elevation_aoi: meanElevAll,
      mean_built_up_selected: meanBuiltSelected,
    },
    comparisons,
    municipal_source_count: municipal.projects.length,
  };

  const outApp = join(root, 'frontend/public/data/nanjing/retrospective_comparison.json');
  const outDerived = join(root, 'data/derived/nanjing/retrospective_comparison.json');
  mkdirSync(dirname(outDerived), { recursive: true });
  writeFileSync(outApp, `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(outDerived, `${JSON.stringify(payload, null, 2)}\n`);

  const md = [
    '# Nanjing retrospective qualitative sanity check',
    '',
    payload.disclaimer,
    '',
    `Independent profile: **${recommended.profileId}** · P10=${recommended.uncertainty.p10.toFixed(2)} · types=${JSON.stringify(typeCounts)}`,
    '',
    '| Official project/location | Documented type | Ourea pattern | Spatial | Functional | Conclusion |',
    '|---|---|---|---|---|---|',
    ...comparisons.map(
      (c) =>
        `| ${c.official_project_location} | ${c.documented_intervention_type} | ${c.ourea_corresponding_pattern.replaceAll('|', '/')} | ${c.spatial_consistency} | ${c.functional_consistency} | ${c.conclusion} |`,
    ),
    '',
    'All municipal rows have `optimizer_input: false`.',
    '',
  ];
  writeFileSync(join(root, 'docs/cicsic/nanjing-retrospective-validation.md'), `${md.join('\n')}\n`);
  writeFileSync(join(root, 'data/derived/nanjing/retrospective_comparison.md'), `${md.join('\n')}\n`);
  console.log(md.join('\n'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
