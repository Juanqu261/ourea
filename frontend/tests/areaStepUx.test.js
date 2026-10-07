import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('AreaStep defaults to five ranking rows with expand control', () => {
  const text = readFileSync(join(root, 'src/flow/steps/AreaStep.jsx'), 'utf8');
  assert.match(text, /DEFAULT_RANK_ROWS = 5/);
  assert.match(text, /show-full-ranking/);
  assert.match(text, /area-section-label/);
  assert.match(text, /Planning lens/);
  assert.match(text, /Top screening areas/);
  assert.match(text, /area-metric/);
  assert.match(text, /place-chip/);
  assert.doesNotMatch(text, /className="ux-details"/);
});

test('AreaStep ranking CSS uses separators instead of bordered cards', () => {
  const css = readFileSync(join(root, 'src/styles/city.css'), 'utf8');
  const start = css.indexOf('.screening-row {');
  const end = css.indexOf('.screening-row:hover', start);
  const block = css.slice(start, end);
  assert.match(block, /border-bottom:\s*1px solid/);
  assert.match(block, /border:\s*0/);
  assert.match(css, /-webkit-line-clamp:\s*2/);
  assert.doesNotMatch(block, /border:\s*1px solid var\(--border\)/);
});
