import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('spacing scale tokens exist', () => {
  const tokens = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');
  assert.match(tokens, /--space-xs:\s*4px/);
  assert.match(tokens, /--space-sm:\s*8px/);
  assert.match(tokens, /--space-md:\s*12px/);
  assert.match(tokens, /--space-lg:\s*16px/);
  assert.match(tokens, /--space-xl:\s*24px/);
  assert.match(tokens, /--space-section:/);
});

test('priority cards are content-driven without tall Details targets', () => {
  const css = readFileSync(join(root, 'src/styles/flow.css'), 'utf8');
  const how = css.slice(css.indexOf('.choice-how {'), css.indexOf('.priority-grid {'));
  assert.match(how, /min-height:\s*24px/);
  assert.doesNotMatch(how, /min-height:\s*44px/);
  const button = css.slice(css.indexOf('.choice-card-button {'), css.indexOf('.choice-card:hover'));
  assert.match(button, /min-height:\s*0/);
});

test('metric tiles no longer force a large min-height', () => {
  const css = readFileSync(join(root, 'src/styles/layout.css'), 'utf8');
  const block = css.slice(css.indexOf('.metric {'), css.indexOf('.metric span {'));
  assert.match(block, /min-height:\s*0/);
  assert.doesNotMatch(block, /min-height:\s*68px/);
});

test('ScenarioControls uses denser form-control rhythm', () => {
  const text = readFileSync(join(root, 'src/components/ScenarioControls.jsx'), 'utf8');
  assert.match(text, /className="scenario-controls"/);
  assert.match(text, /className="form-control"/);
});

test('Compare and Review steps use structured result stacks', () => {
  const compare = readFileSync(join(root, 'src/flow/steps/ReviewStep.jsx'), 'utf8');
  const review = readFileSync(join(root, 'src/flow/steps/SafeguardsStep.jsx'), 'utf8');
  assert.match(compare, /compare-stack/);
  assert.match(compare, /map-compare-block/);
  assert.match(compare, /scenario-compare/);
  assert.match(review, /review-stack/);
  assert.match(review, /support-card/);
  assert.match(review, /DEFAULT_CELL_ROWS = 3/);
  assert.match(review, /show-all-cells/);
});
