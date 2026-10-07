import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { analyzeCorridor, bundleDataset } from '../src/domain/cornareDecision.js';
import { comparisonCards } from '../src/domain/comparison.js';
import { decisionHinges } from '../src/domain/decisionHinge.js';
import { EVIDENCE_LABELS } from '../src/domain/evidence.js';
import { ROBUSTNESS_MEANING } from '../src/domain/robustness.js';
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
    'bio_psa',
    'food_agro',
    'health',
    'risk_knowledge',
    'water_eff',
  ]);
  assert.equal(first.portfolio.cost, 5000);
  assert.equal(first.lenses.naturaleza.ids.includes('hab_green'), true);
  assert.equal(first.lenses.naturaleza.ids.includes('bio_psa'), false);
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
  assert.equal(after.portfolio.ids.join(','), 'bio_pa,bio_psa,food_agro,health,risk_knowledge,water_eff');
});

test('institutional weights sum to 1 and cobenefit stays outside that objective', () => {
  const parameters = read('decision_model.json');
  const weights = parameters.weights.vulnerability + parameters.weights.recurrence + parameters.weights.workshops;
  assert.equal(Math.round(weights * 1000) / 1000, 1);
  const analysis = analyzeCorridor(dataset());
  analysis.portfolio.institucional.parts.forEach((part) => {
    assert.equal(part.cobenefitApplied, false);
    const recurrence = part.recurrenceWithheld ? 0 : part.recurrence;
    const expected = part.vulnerability + recurrence + part.urgency;
    assert.ok(Math.abs(part.contribution - expected) < 1e-6);
  });
  assert.equal(analysis.matrix.cobenefitInInstitutionalScore, false);
});

test('the decision matrix lists every measure without treating missing evidence as zero', () => {
  const analysis = analyzeCorridor(dataset());
  const catalogue = read('interventions.json');
  assert.equal(analysis.matrix.rows.length, 15);
  const selected = analysis.matrix.rows.filter((row) => row.decision === 'SELECTED');
  assert.deepEqual(selected.map((row) => row.id).sort(), analysis.portfolio.ids);
  const cost = analysis.matrix.rows.reduce((sum, row) => sum + row.cost, 0);
  assert.equal(cost, catalogue.interventions.reduce((sum, item) => sum + item.cost_million_cop, 0));
  analysis.matrix.rows.forEach((row) => {
    assert.equal(typeof row.standaloneVerifiedScore, 'number');
    assert.equal(Number.isFinite(row.standaloneVerifiedScore), true);
    assert.equal(row.verifiedScore, row.standaloneVerifiedScore);
    const observedRecurrence = row.recurrence.withheld ? 0 : row.recurrence.observed;
    assert.ok(Math.abs(row.standaloneVerifiedScore - (row.vulnerabilityComponent + observedRecurrence)) < 1e-6);
    assert.equal(row.workshop.display, 'Por integrar');
    assert.equal(row.workshop.observed, null);
    assert.notEqual(row.workshop.display, '0');
    assert.notEqual(row.workshop.observed, 0);
    if (row.recurrence.withheld) {
      assert.equal(row.recurrence.display, 'Por integrar');
      assert.equal(row.recurrence.observed, null);
    }
    assert.equal(row.cobenefit.appliedToInstitutionalScore, false);
    const text = row.explanation.join(' ');
    assert.equal(text.includes('% menos riesgo'), false);
    if (row.decision !== 'SELECTED') assert.ok(row.explanation.length > 0);
  });
  const marginal = selected.reduce((sum, row) => sum + row.portfolioMarginalScore, 0);
  assert.ok(Math.abs(marginal - analysis.portfolio.institucional.objective) < 1e-6);
  assert.equal(selected.every((row) => typeof row.portfolioMarginalScore === 'number'), true);
  assert.equal(analysis.matrix.rows.filter((row) => row.decision !== 'SELECTED').every((row) => row.portfolioMarginalScore == null), true);
  assert.equal(selected.some((row) => row.standaloneVerifiedScore > row.portfolioMarginalScore + 1e-6), true);
  const green = analysis.matrix.rows.find((row) => row.id === 'hab_green');
  assert.equal(green.decision, 'CLOSE ALTERNATIVE');
  assert.ok(Math.abs(green.bestContainingPortfolioGap - 0.0025) < 1e-6);
  assert.equal(analysis.sensitivity.status, 'SENSITIVE_TO_MISSING_EVIDENCE');
});

test('comparison keeps the institutional score apart from each lens objective', () => {
  const analysis = analyzeCorridor(dataset());
  const cards = comparisonCards(analysis);
  const recommended = cards.find((card) => card.id === 'recommended');
  const nature = cards.find((card) => card.id === 'cobenefit');
  const regret = cards.find((card) => card.id === 'regret');
  assert.equal(recommended.lens, null);
  assert.equal(recommended.institutional, analysis.portfolio.institucional.objective);
  assert.ok(nature.lens.value > nature.institutional);
  assert.match(nature.lens.label, /naturaleza/i);
  assert.match(nature.lens.note, /no es el puntaje institucional/i);
  assert.equal(regret.lens.label.includes('Índice de bajo arrepentimiento'), true);
  assert.equal(regret.lens.note.includes('no un puntaje de vulnerabilidad'), true);
  assert.notEqual(regret.lens.value, regret.institutional);
  analysis.portfolio.institucional.parts.forEach((part) => assert.equal(part.cobenefitApplied, false));
  assert.ok(analysis.lenses.naturaleza.withCobenefit.objective > analysis.lenses.naturaleza.institucional.objective);
});

test('the reversal threshold is the verified gap and is not a workshop percentage', () => {
  const analysis = analyzeCorridor(dataset());
  const hinge = analysis.hinges[0];
  assert.equal(hinge.id, 'hab_green');
  assert.ok(Math.abs(hinge.gap - 0.0025) < 1e-6);
  assert.equal(hinge.minimumWeightedDifference, hinge.gap);
  assert.ok(Math.abs(hinge.rangeFraction - (0.0025 / 0.15)) < 1e-6);
  assert.equal(hinge.band, 'VERY_SENSITIVE');
  assert.equal(hinge.gapDisplay, '0,0025');
  assert.match(hinge.sentence, /1,7% del rango total posible del componente participativo/);
  assert.doesNotMatch(hinge.sentence, /taller|workshop percentage|% of workshops/i);
  assert.match(hinge.assignment, /no se asigna la brecha/i);
  assert.ok(hinge.criteria.some((criterion) => criterion.id === 'workshop'));
  assert.ok(hinge.criteria.some((criterion) => criterion.id === 'withheld_recurrence'));
  const again = decisionHinges({
    rejected: analysis.rejected,
    prepared: analysis.prepared,
    recommendedIds: analysis.portfolio.ids,
    participatoryRange: 0.15,
  });
  assert.deepEqual(again, analysis.hinges);
});

test('scenario coverage qualifies robustness and recommendation language stays conditional', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const analysis = analyzeCorridor(dataset());
  assert.equal(analysis.stress.sameSet, true);
  assert.equal(analysis.stress.evidencedDimensions.length, 1);
  assert.equal(analysis.portfolio.ids.join(','), 'bio_pa,bio_psa,food_agro,health,risk_knowledge,water_eff');
  assert.equal(/Portafolio retenido/.test(app), false);
  assert.equal(/6\s*\/\s*6/.test(app), false);
  assert.match(app, /El portafolio no cambia ante el cambio cuantificado/);
  assert.match(app, /1 señal cuantificada/);
  assert.match(app, /Integración de escenario requerida/);
  assert.match(app, /ROBUSTNESS_MEANING/);
  assert.match(app, /data-testid="stress-meaning"/);
  assert.equal(ROBUSTNESS_MEANING.includes('Mayormente robusta significa que el conjunto permanece estable'), true);
  assert.equal(ROBUSTNESS_MEANING.includes('no significa que todas las dimensiones tengan series SSP3-7.0'), true);
  assert.equal(/Portafolio óptimo/.test(app), false);
  assert.match(app, /Portafolio recomendado con evidencia verificada/);
  assert.match(app, /Mejor conjunto bajo la evidencia institucional actualmente integrada/);
  assert.match(app, /Con la evidencia institucional verificada, Ourea asigna los COP 5\.000 M a seis medidas/);
});

test('the NbS screen stays qualitative and cites each criterion', () => {
  const analysis = analyzeCorridor(dataset());
  assert.ok(analysis.nbsScreen.length > 0);
  analysis.nbsScreen.forEach((item) => {
    assert.match(item.standard, /No es una certificación/);
    assert.equal(/certificad/i.test(item.standard), false);
    assert.equal(item.criteria.length, 8);
    item.criteria.forEach((criterion) => {
      assert.ok(criterion.source);
      assert.ok(['Con soporte', 'Parcial', 'Por validar'].includes(criterion.statusLabel));
    });
  });
});
