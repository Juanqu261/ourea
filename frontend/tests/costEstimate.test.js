import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  estimatePortfolioCost,
  formatUsd,
  formatUsdMillionRange,
  rwhParticipatingSystems,
  roundUsd,
} from '../src/domain/costEstimate.js';
import { GUIDED_CELLS, GUIDED_PLAN, RESTORATION_PLAN } from './fixtures/guidedPlan.js';

const costContext = JSON.parse(
  await readFile(fileURLToPath(new URL('../public/data/cost_context.json', import.meta.url)), 'utf8'),
);

test('RWH quantity follows the participation prior', () => {
  assert.equal(rwhParticipatingSystems(4, 0.25), 1);
  assert.equal(rwhParticipatingSystems(47, 0.25), 12);
  assert.equal(rwhParticipatingSystems(0, 0.25), 1);
});

test('guided RWH plus drainage uses ROM packages, not USD/m', () => {
  const estimate = estimatePortfolioCost({
    portfolio: GUIDED_PLAN,
    cells: GUIDED_CELLS,
    costContext,
  });
  assert.equal(estimate.complete, true);
  assert.equal(estimate.ordered, true);
  assert.equal(estimate.lines.find((line) => line.type === 'rwh').assumedQuantity, 1);
  const drainage = estimate.lines.find((line) => line.type === 'drainage');
  assert.equal(drainage.assumedQuantity, 1);
  assert.equal(drainage.method, 'rom_package');
  assert.match(drainage.quantityLabel, /selected planning-cell package/);
  assert.match(drainage.formula, /ROM package/);
  assert.equal(estimate.immediateAsk.status, 'unpriced_preparation');
  assert.match(estimate.immediateAsk.fieldwork.display, /before fieldwork/);
  assert.match(estimate.immediateAsk.afterSurvey.display, /after the field survey defines the scope/);
  assert.doesNotMatch(estimate.immediateAsk.fieldwork.display, /after survey/);
  assert.equal(estimate.display.design, undefined);
  const pkg = costContext.interventions.drainage.usd_per_package;
  assert.equal(drainage.low, pkg.low);
  assert.equal(drainage.base, pkg.base);
  assert.equal(drainage.high, pkg.high);
  assert.equal(estimate.display.total.low, roundUsd(pkg.low + 550));
  assert.equal(estimate.display.total.base, roundUsd(pkg.base + 780));
  assert.equal(estimate.display.total.high, roundUsd(pkg.high + 1200));
  assert.equal(estimate.lines.find((line) => line.type === 'rwh').display.base, 780);
  assert.ok(estimate.sourceIds.includes('rwh_santa_elena_1000l_2023_budget_ceiling'));
  assert.ok(estimate.sourceIds.some((id) => id.startsWith('drainage_scale_')));
  assert.ok(estimate.sensitivity.some((item) => item.id === 'drainage'));
  assert.equal(estimate.sensitivity.some((item) => item.id === 'trm'), false);
  assert.equal(formatUsd(550), 'US$550');
  assert.match(formatUsdMillionRange(estimate.display.total.low, estimate.display.total.high), /US\$/);
});

test('drainage ROM packages do not multiply USD/m by corridor length', () => {
  const estimate = estimatePortfolioCost({
    portfolio: [{ cell_id: 18, type: 'drainage' }],
    cells: GUIDED_CELLS,
    costContext,
  });
  const line = estimate.lines[0];
  const rates = costContext.interventions.drainage.comparator_usd_per_reported_m;
  const lengths = costContext.interventions.drainage.length_m;
  assert.notEqual(line.low, lengths.low * rates.low);
  assert.notEqual(line.base, lengths.base * rates.base);
  assert.equal(line.low, costContext.interventions.drainage.usd_per_package.low);
});

test('RWH quantity is dynamic with building count', () => {
  const one = estimatePortfolioCost({
    portfolio: [{ cell_id: 12, type: 'rwh' }],
    cells: GUIDED_CELLS,
    costContext,
  });
  const many = estimatePortfolioCost({
    portfolio: [{ cell_id: 18, type: 'rwh' }],
    cells: GUIDED_CELLS,
    costContext,
  });
  assert.equal(one.lines[0].assumedQuantity, 1);
  assert.equal(many.lines[0].assumedQuantity, 12);
  assert.equal(many.total.base > one.total.base, true);
});

test('restoration is a project-scale package, not a USD/m2 rate', () => {
  const estimate = estimatePortfolioCost({
    portfolio: RESTORATION_PLAN,
    cells: GUIDED_CELLS,
    costContext,
  });
  assert.equal(estimate.complete, true);
  assert.equal(estimate.lines[0].assumedQuantity, 1);
  assert.equal(estimate.display.total.base, 177000);
  assert.equal(estimate.lines[0].evidenceTier, 'low');
  assert.match(estimate.lines[0].quantityNote, /not a USD\/m/);
});

test('unpriced interventions refuse a total', () => {
  const estimate = estimatePortfolioCost({
    portfolio: [{ cell_id: 12, type: 'unknown' }],
    cells: GUIDED_CELLS,
    costContext,
  });
  assert.equal(estimate.complete, false);
  assert.equal(estimate.total, null);
  assert.ok(estimate.unpriced.includes('unknown'));
});

test('missing cost context refuses a total', () => {
  const estimate = estimatePortfolioCost({
    portfolio: GUIDED_PLAN,
    cells: GUIDED_CELLS,
    costContext: null,
  });
  assert.equal(estimate.complete, false);
  assert.equal(estimate.total, null);
});

test('one drainage cell is one ROM package without a consolidation warning', () => {
  const estimate = estimatePortfolioCost({
    portfolio: [{ cell_id: 18, type: 'drainage' }],
    cells: GUIDED_CELLS,
    costContext,
  });
  const pkg = costContext.interventions.drainage.usd_per_package;
  assert.equal(estimate.lines[0].assumedQuantity, 1);
  assert.equal(estimate.total.base, pkg.base);
  assert.equal(estimate.drainageConsolidationWarning, null);
  assert.match(estimate.lines[0].quantityLabel, /1 selected planning-cell package/);
});

test('several drainage cells keep separate ROM totals and warn about consolidation', () => {
  const adjacent = estimatePortfolioCost({
    portfolio: [{ cell_id: 1, type: 'drainage' }, { cell_id: 2, type: 'drainage' }],
    cells: GUIDED_CELLS,
    costContext,
  });
  const several = estimatePortfolioCost({
    portfolio: [{ cell_id: 18, type: 'drainage' }, { cell_id: 2, type: 'drainage' }],
    cells: GUIDED_CELLS,
    costContext,
  });
  const pkg = costContext.interventions.drainage.usd_per_package;
  assert.equal(adjacent.lines[0].assumedQuantity, 2);
  assert.equal(adjacent.total.base, pkg.base * 2);
  assert.equal(several.total.base, pkg.base * 2);
  assert.equal(adjacent.total.base, several.total.base);
  assert.match(adjacent.drainageConsolidationWarning, /connected corridor/);
  assert.match(several.drainageConsolidationWarning, /counts them separately/);
  assert.match(adjacent.lines[0].quantityLabel, /2 selected planning-cell packages; corridor consolidation not assessed/);
});

test('rounding is stable and presentation-only', () => {
  assert.equal(roundUsd(409228.6), 409000);
  const estimate = estimatePortfolioCost({
    portfolio: GUIDED_PLAN,
    cells: GUIDED_CELLS,
    costContext,
  });
  assert.notEqual(estimate.total.base, estimate.display.total.base);
});
