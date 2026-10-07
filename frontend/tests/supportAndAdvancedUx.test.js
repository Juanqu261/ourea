import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('supporting evidence cards use aligned header slots', () => {
  const jsx = readFileSync(join(root, 'src/flow/steps/SafeguardsStep.jsx'), 'utf8');
  const css = readFileSync(join(root, 'src/styles/flow.css'), 'utf8');
  assert.match(jsx, /support-card-head/);
  assert.match(jsx, /support-card-icon/);
  assert.match(jsx, /support-card-body/);
  assert.equal((jsx.match(/support-card-head/g) || []).length, 3);
  assert.match(css, /\.support-card-head \{[\s\S]*display:\s*flex/);
  assert.match(css, /\.support-card-icon \{[\s\S]*flex:\s*0 0 22px/);
  assert.match(css, /\.support-card-body \{[\s\S]*padding-left:\s*30px/);
  assert.doesNotMatch(css, /\.support-card > \.choice-icon \{[\s\S]*grid-row:\s*1 \/ span 2/);
});

test('advanced analysis uses clearer plan/consensus/benchmark structure', () => {
  const alt = readFileSync(join(root, 'src/components/AlternativePortfolios.jsx'), 'utf8');
  const css = readFileSync(join(root, 'src/styles/map.css'), 'utf8');
  const flow = readFileSync(join(root, 'src/styles/flow.css'), 'utf8');
  assert.match(alt, /advanced-section/);
  assert.match(alt, /policy-consensus-lead/);
  assert.match(alt, /alternative-method-note/);
  assert.match(alt, /is-best/);
  assert.match(css, /\.alternative-card\.is-best/);
  assert.match(css, /\.alternative-desc/);
  assert.doesNotMatch(css, /min-height:\s*44px/);
  assert.match(flow, /\.advanced-tabs/);
  assert.match(flow, /\.advanced-panel/);
});
