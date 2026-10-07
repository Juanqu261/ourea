import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDecisionPackage } from '../src/domain/decisionPackage.js';

const climate = {
  schema_version: 1,
  source_name: 'CHIRPS v3.0 Final',
  source_version: 'v3.0',
  doi: 'https://doi.org/10.1038/s41597-026-07096-4',
  climatology_period: { label: '1991-2020' },
  spatial_resolution: '0.05 degrees',
  temporal_resolution: 'Daily Final',
  area: 'Llanaditas',
};

function baseArgs() {
  return {
    scenario: {
      rainMm: 80,
      antecedentWetness: 0.5,
      planningYear: 1,
      presetId: 'typical_wet',
      climate: {
        accumulationWindowDays: 15,
        percentile: 75,
        climatologyPeriod: '1991-2020',
        sourceName: 'CHIRPS v3.0 Final',
      },
    },
    budgetCredits: 10,
    view: 'ai',
    cityLens: 'balanced',
    selectedAiProfileId: 'balanced',
    projects: [{ cell_id: 35, type: 'rwh' }],
    metrics: {
      baselineExposure: 1,
      residualExposure: 0.8,
      benefit: 0.2,
      equityBenefit: 0.1,
      accessBenefit: 0.05,
      buildingsAboveThreshold: 1,
      populationAboveThreshold: 10,
    },
    baseline: {
      baselineExposure: 1,
      buildingsAboveThreshold: 2,
      populationAboveThreshold: 20,
    },
    monteCarlo: { runs: 10, p10: 1, median: 2, p90: 3, mean: 2 },
    summary: { buildings: 1588 },
    evidence: { schema_version: 1, layers: [] },
    community: {
      validation_status: 'incomplete',
      validation_label: 'Incomplete',
      file_status: 'absent',
      not_assessed_count: 1,
      incomplete_count: 0,
      documented_count: 0,
      not_assessed_projects: [],
      safeguards_activated: [],
      unresolved_concerns: [],
      records: [],
      participatory_records: [],
      session_history: [],
      privacy_warning: 'warning',
      template_ignored: true,
      guardrail: 'not a prediction',
    },
    planAlignment: { schema_version: 2, status: 'documentary', entries: [] },
    climateContext: climate,
  };
}

test('exported package includes climate provenance and a stable fingerprint', () => {
  const first = buildDecisionPackage(baseArgs());
  const second = buildDecisionPackage(baseArgs());
  assert.equal(first.schema, 'ourea-decision-package');
  assert.equal(first.schema_version, 2);
  assert.equal(first.climate_context.source_name, 'CHIRPS v3.0 Final');
  assert.equal(first.scenario.historical_percentile, 75);
  assert.equal(first.scenario.antecedent_rainfall_percentile, 0.5);
  assert.match(first.reproducible_id, /^ourea-/);
  assert.equal(first.reproducible_id, second.reproducible_id);
  assert.notEqual(first.generated_at, undefined);
  assert.equal(first.schema_versions.climate_context, 1);
  assert.equal(first.action_footprint.planning_cells_targeted, 1);
});
