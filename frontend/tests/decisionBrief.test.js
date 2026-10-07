import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { analyzeCorridor, bundleDataset } from '../src/domain/cornareDecision.js';
import {
  BRIEF_FILENAME,
  DEMO_URL,
  REPO_URL,
  composeDecisionBrief,
  formatMillions,
  sacrificeView,
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

test('decision brief is a readable 4 or 5 page pitch PDF', async () => {
  const analysis = analyzeCorridor(dataset());
  const pdf = composeDecisionBrief(analysis, new Date('2026-10-07T12:00:00'));
  const bytes = new Uint8Array(await pdf.toBlob().arrayBuffer());
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString('latin1'), '%PDF-');
  const text = pdfText(bytes);
  const pageCount = (text.match(/\/Type \/Page /g) || []).length;
  assert.ok(pageCount === 4 || pageCount === 5, `page count ${pageCount}`);
  [
    'OUREA',
    'COP 5.000',
    'Portafolio',
    '70%',
    'SSP3-7.0',
    'Riesgo residual',
    'fingerprint',
    analysis.fingerprint,
    'El portafolio no cambia ante el cambio de escenario cuantificado.',
    'integrados en la secuencia de decisión',
    DEMO_URL,
    REPO_URL,
    'Robust Territorial Climate Adaptation Decision Brief',
    '(es-CO)',
  ].forEach((phrase) => assert.ok(text.includes(phrase), phrase));
  assert.equal(text.includes('0.933 0.910 0.863'), false);
  assert.equal(text.includes('6/6'), false);
  assert.equal(/correlaci[oó]n/i.test(text), false);
  assert.equal(text.includes('Portafolio óptimo'), false);
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
