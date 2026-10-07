#!/usr/bin/env node
/**
 * Cross-city selection benchmark using the shared JS engine.
 * Writes machine-readable JSON under data/derived/.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const frontendSrc = join(root, 'frontend', 'src');

async function loadDomain() {
  const benchmark = await import(pathToFileURL(join(frontendSrc, 'domain/benchmark.js')).href);
  const scenarioEngine = await import(
    pathToFileURL(join(frontendSrc, 'domain/scenarioEngine.js')).href
  );
  const climateScenarios = await import(
    pathToFileURL(join(frontendSrc, 'domain/climateScenarios.js')).href
  );
  return { ...benchmark, ...scenarioEngine, ...climateScenarios };
}

function loadJson(rel) {
  return JSON.parse(readFileSync(join(root, rel), 'utf8'));
}

async function runCase(caseId, paths, domain) {
  const buildings = loadJson(paths.buildings);
  const cells = loadJson(paths.cells);
  const climate = loadJson(paths.climate);
  const context = domain.createScenarioContext(buildings, cells);
  const scenario = domain.defaultScenarioFromClimate(climate, 10);
  const result = domain.compareSelectionStrategies({
    context,
    cellsGeoJson: cells,
    scenario,
    budgetCredits: 10,
    profile: 'balanced',
  });
  return {
    case_id: caseId,
    budgetCredits: 10,
    profile: 'balanced',
    p10Leader: result.p10Leader,
    note: result.note,
    strategies: result.strategies.map((s) => ({
      id: s.id,
      selectionMethod: s.selectionMethod,
      spentCredits: s.spentCredits,
      projectCount: s.projectCount,
      median: s.median,
      p10: s.p10,
      p90: s.p90,
      downsideRetention: s.downsideRetention,
      p10RegretVersusRobust: s.p10RegretVersusRobust,
      p10DeltaVersusRobust: s.p10DeltaVersusRobust,
      overlapWithRobust: s.overlapWithRobust,
    })),
  };
}

async function main() {
  const domain = await loadDomain();
  const medellin = await runCase(
    'medellin',
    {
      buildings: 'frontend/public/data/buildings.geojson',
      cells: 'frontend/public/data/planning_cells.geojson',
      climate: 'frontend/public/data/climate_context.json',
    },
    domain,
  );
  const nanjing = await runCase(
    'nanjing_xianlin',
    {
      buildings: 'frontend/public/data/nanjing/buildings.geojson',
      cells: 'frontend/public/data/nanjing/planning_cells.geojson',
      climate: 'frontend/public/data/nanjing/climate_context.json',
    },
    domain,
  );

  const payload = {
    schema: 'ourea-cross-city-benchmark',
    schema_version: 1,
    generated_at: new Date().toISOString(),
    engine: 'frontend/src/domain/benchmark.js + optimizer.js (shared)',
    nanjing_specific_optimizer: false,
    cases: [medellin, nanjing],
  };

  const outDir = join(root, 'data', 'derived');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'cross_city_benchmark.json');
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);
  for (const c of payload.cases) {
    console.log(c.case_id, 'p10Leader=', c.p10Leader);
    for (const s of c.strategies) {
      console.log(`  ${s.id}: p10=${s.p10.toFixed(2)} median=${s.median.toFixed(2)}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
