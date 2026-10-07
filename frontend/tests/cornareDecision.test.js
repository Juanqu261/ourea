import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { analyzeCorridor, bundleDataset } from '../src/domain/cornareDecision.js';
import { EVIDENCE_LABELS } from '../src/domain/evidence.js';
import { stressStatus } from '../src/domain/stressTest.js';
import { STEPS } from '../src/cornare/copy.js';

const read = (name) => JSON.parse(readFileSync(new URL(`../public/data/cornare/${name}`, import.meta.url), 'utf8'));

function dataset() {
  return bundleDataset({
    interventions: read('interventions.json'),
    metrics: read('dimension_metrics.json'),
    history: read('adaptation_history.json'),
    parameters: read('decision_model.json'),
    gaps: read('information_gaps.json'),
    mea: read('mea_indicators.json'),
    profiles: read('municipality_profiles.json'),
  });
}

test('catalogue costs are positive and sum to 18900 million', () => {
  const catalogue = read('interventions.json');
  const total = catalogue.interventions.reduce((sum, item) => sum + item.cost_million_cop, 0);
  assert.equal(total, 18900);
  assert.equal(catalogue.budget_million_cop, 5000);
  catalogue.interventions.forEach((item) => {
    assert.equal(typeof item.cost_million_cop, 'number');
    assert.ok(item.cost_million_cop > 0);
  });
});

test('institutional portfolio stays within COP 5000 million and is reproducible', () => {
  const first = analyzeCorridor(dataset());
  const second = analyzeCorridor(dataset());
  assert.deepEqual(first.portfolio.ids, second.portfolio.ids);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.ok(first.portfolio.cost <= 5000);
  assert.equal(first.portfolio.cost + first.portfolio.remaining, 5000);
  for (const portfolio of Object.values(first.lenses)) {
    assert.ok(portfolio.cost <= 5000);
  }
  for (const portfolio of Object.values(first.baselines)) {
    assert.ok(portfolio && portfolio.cost <= 5000);
  }
  assert.deepEqual(first.portfolio.ids, [
    'bio_pa',
    'food_agro',
    'hab_green',
    'health',
    'risk_knowledge',
    'water_eff',
  ]);
});

test('missing adaptation coverage is not scored as zero recurrence', () => {
  const analysis = analyzeCorridor(dataset());
  const water = analysis.portfolio.measures.find((measure) => measure.id === 'water_eff');
  assert.equal(water.place.localization, 'Marinilla');
  assert.equal(water.recurrence.withheld, true);
  assert.equal(water.recurrence.provenance, 'missing');
  const history = read('adaptation_history.json');
  const marinilla = history.coverage.find((row) => row.municipality_id === 'marinilla');
  assert.equal(marinilla.records, 1);
});

test('mitigation and emissions stay out of the adaptation score', () => {
  const parameters = read('decision_model.json');
  assert.equal(JSON.stringify(parameters.weights).includes('co2'), false);
  assert.ok(parameters.excluded_from_score.some((item) => item.includes('emission')));
  assert.ok(parameters.excluded_from_score.some((item) => item.includes('mitigation')));
});

test('vulnerability cells keep nulls and evidence classes', () => {
  const metrics = read('dimension_metrics.json').metrics;
  metrics.forEach((row) => {
    for (const key of ['value', 'value_min', 'value_max']) {
      if (row[key] == null) assert.equal(Object.hasOwn(row, key), true);
      else assert.ok(row[key] >= 0 && row[key] <= 1);
    }
    assert.ok(EVIDENCE_LABELS[row.provenance]);
  });
  const sensitivity = metrics.find((row) => row.id === 'rio-disaster-sensitivity');
  assert.equal(sensitivity.value, 0.4);
  assert.equal(sensitivity.classification, null);
});

test('SSP3-7.0 status uses only the documented shift', () => {
  const analysis = analyzeCorridor(dataset());
  assert.equal(analysis.stress.status, 'MAYORMENTE_ROBUSTA');
  assert.deepEqual(analysis.stress.entered, []);
  assert.deepEqual(analysis.stress.exited, []);
  assert.equal(stressStatus({
    referenceIds: ['a'],
    stressIds: ['a'],
    evidencedDimensions: ['disaster'],
    portfolioDimensions: ['disaster'],
  }), 'ROBUSTA');
  assert.equal(stressStatus({
    referenceIds: ['a'],
    stressIds: ['b'],
    evidencedDimensions: ['disaster'],
    portfolioDimensions: ['disaster'],
  }), 'REQUIERE_AJUSTE');
  assert.equal(stressStatus({
    referenceIds: ['a'],
    stressIds: ['a'],
    evidencedDimensions: [],
    portfolioDimensions: ['disaster'],
  }), 'EVIDENCIA_INSUFICIENTE');
});

test('information gaps stay explicit and the flow is in Spanish', () => {
  const gaps = read('information_gaps.json').gaps;
  assert.ok(gaps.some((gap) => gap.id === 'gap-company-water'));
  assert.ok(gaps.every((gap) => gap.missing_information && gap.how_to_collect_it));
  assert.deepEqual(STEPS.map((step) => step.id), [
    'territory',
    'priority',
    'portfolio',
    'horizon',
    'residual',
    'followup',
  ]);
  assert.equal(STEPS[0].label, 'Territorio');
  assert.equal(STEPS[5].label, 'Seguimiento');
});

test('public ficha status cannot change the institutional portfolio', () => {
  const before = analyzeCorridor(dataset());
  const fichas = read('measure_fichas.json');
  assert.equal(fichas.measures.every((item) => item.score_effect === 'none'), true);
  const after = analyzeCorridor(dataset());
  assert.deepEqual(after.portfolio.ids, before.portfolio.ids);
  assert.equal(after.fingerprint, before.fingerprint);
  assert.equal(after.portfolio.ids.join(','), 'bio_pa,food_agro,hab_green,health,risk_knowledge,water_eff');
});
