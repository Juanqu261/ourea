import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { analyzeCorridor, bundleDataset } from '../src/domain/cornareDecision.js';
import { computeLeaveOneOutImpact } from '../src/domain/portfolioSearch.js';
import { BRIEF_MAP_FILES, renderBriefMap } from '../src/cornare/briefMap.js';
import {
  BRIEF_FILENAME,
  DEMO_URL,
  REPO_URL,
  composeDecisionBrief,
  formatMillions,
  sacrificeView,
  selectionRationale,
} from '../src/cornare/decisionBrief.js';

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

function pdfText(bytes) {
  return Buffer.from(bytes).toString('latin1')
    .replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(Number.parseInt(oct, 8)));
}

function pdfLines(text) {
  const parts = [];
  const re = /\(((?:\\.|[^\\)])*)\)\s*Tj/g;
  let match;
  while ((match = re.exec(text))) parts.push(match[1].replace(/\\([()\\])/g, '$1'));
  return parts.join(' ');
}

function mapLayers() {
  const layers = {};
  BRIEF_MAP_FILES.forEach((file) => {
    layers[file] = read(file);
  });
  return layers;
}

test('the brief map uses the three municipal geometries', () => {
  const map = renderBriefMap(mapLayers(), { width: 640, height: 360 });
  assert.equal(map.bytes[0], 0xff);
  assert.equal(map.bytes[1], 0xd8);
  assert.equal(map.labels.length, 3);
  const byId = Object.fromEntries(map.labels.map((label) => [label.id, label]));
  assert.ok(byId.guarne.y < byId.rionegro.y);
  assert.ok(byId.marinilla.x > byId.rionegro.x);
  assert.ok(map.labels.every((label) => ['RIONEGRO', 'GUARNE', 'MARINILLA'].includes(label.name)));
});

test('leave-one-out keeps the recommended portfolio and reports a real gap', () => {
  const analysis = analyzeCorridor(dataset());
  const before = analysis.portfolio.ids.join(',');
  const impacts = computeLeaveOneOutImpact(analysis.prepared, analysis.parameters, analysis.portfolio);
  assert.equal(analysis.portfolio.ids.join(','), before);
  assert.equal(impacts.length, analysis.portfolio.measures.length);
  impacts.forEach((impact) => {
    assert.ok(impact.objectiveLoss >= 0);
    assert.equal(impact.bestWithoutMeasure.includes(impact.id), false);
  });
});

test('decision brief is a readable 5 or 6 page pitch PDF', async () => {
  const analysis = analyzeCorridor(dataset());
  const map = renderBriefMap(mapLayers(), { width: 800, height: 450 });
  const pdf = await composeDecisionBrief(analysis, new Date('2026-10-07T12:00:00'), { map });
  const bytes = new Uint8Array(await pdf.toBlob().arrayBuffer());
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString('latin1'), '%PDF-');
  assert.ok(bytes.includes(0xff) && bytes.includes(0xd8));
  const text = pdfText(bytes);
  const pageCount = (text.match(/\/Type \/Page /g) || []).length;
  assert.ok(pageCount === 5 || pageCount === 6, `page count ${pageCount}`);
  [
    'OUREA',
    'COP 5.000',
    'Portafolio',
    '70%',
    'SSP3-7.0',
    'Riesgo residual',
    'MODELO DETERMIN',
    '32.768',
    'x_i',
    '0,35',
    '2,8125',
    '0,0025',
    'POR QU',
    'El portafolio no cambia ante el cambio de escenario cuantificado.',
    'integrados en la secuencia de decisión',
    DEMO_URL,
    REPO_URL,
    'Robust Territorial Climate Adaptation Decision Brief',
    '(es-CO)',
  ].forEach((phrase) => assert.ok(text.includes(phrase), phrase));
  [
    'Decision fingerprint',
    analysis.fingerprint,
    'paquete no trae',
    'red h',
    'No usa teselas remotas',
  ].forEach((phrase) => assert.equal(text.includes(phrase), false, phrase));
  assert.equal(text.includes('0.933 0.910 0.863'), false);
  assert.equal(text.includes('6/6'), false);
  assert.equal(/correlaci[oó]n/i.test(text), false);
  assert.equal(text.includes('Portafolio óptimo'), false);
  analysis.portfolio.measures.forEach((measure) => {
    const rationale = selectionRationale(
      measure,
      analysis,
      computeLeaveOneOutImpact(analysis.prepared, analysis.parameters, analysis.portfolio)
        .find((item) => item.id === measure.id),
    );
    assert.equal(rationale.includes('Por qué entra'), false);
    assert.ok(rationale.includes('Aporte') || rationale.includes('Rol'));
  });
  const lines = pdfLines(text);
  analysis.portfolio.measures.forEach((measure) => {
    const name = measure.name.replace(/[\u2013\u2014\u2212]/g, '-');
    assert.ok(lines.includes(name), name);
  });
  const sacrifice = sacrificeView(analysis);
  assert.ok(sacrifice.nearest);
  assert.ok(text.includes(sacrifice.nearest.gapDisplay));
  assert.ok(text.includes(sacrifice.nearest.name.replace(/[–—−]/g, '-')));
  assert.ok(text.includes(`COP ${formatMillions(analysis.parameters.budget_million_cop)}`));
  assert.equal(BRIEF_FILENAME, 'ourea-cornare-decision-brief.pdf');
});
