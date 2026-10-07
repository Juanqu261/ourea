import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

test('Step 6 early-action card uses dark theme tokens, not light fallback', () => {
  const css = read('src/styles/flow.css');
  const blockStart = css.indexOf('.early-action {');
  assert.ok(blockStart >= 0);
  const block = css.slice(blockStart, css.indexOf('.early-action-grid', blockStart));
  assert.match(block, /background:\s*var\(--surface\)/);
  assert.doesNotMatch(block, /#f7f3ea|--panel/);
  assert.match(css, /\.mechanism-canvas[\s\S]*?background:\s*var\(--bg-secondary\)/);
  assert.doesNotMatch(css, /\.mechanism-canvas[\s\S]*?#ece4d6/);
});

test('hillside mechanism canvas draws with dark-sky palette', () => {
  const js = read('src/domain/hillsideMechanism.js');
  assert.match(js, /#1a2822|#1a2226/);
  assert.doesNotMatch(js, /#ece4d6|#f4efe4/);
  assert.match(js, /fillStyle = treat \? '#c5d5c4' : '#eee8dc'/);
});

test('map legend help is expandable inside legend, not a permanent floating banner', () => {
  const legend = read('src/components/MapLegend.jsx');
  assert.match(legend, /legend-help/);
  assert.match(legend, /data-testid="map-legend"/);
  assert.doesNotMatch(legend, /InfoTip/);
  const app = read('src/App.jsx');
  assert.match(app, /map-chrome-bottom-left|map-bottom-left/);
});

test('map chrome reserves bottom-left stack for legend', () => {
  const css = read('src/styles/map.css');
  assert.match(css, /\.map-chrome-bottom-left/);
  assert.match(css, /\.legend-help/);
});
