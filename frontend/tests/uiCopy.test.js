import assert from 'node:assert/strict';
import test from 'node:test';
import { frontierTakeaway, stabilityBand } from '../src/config/uiCopy.js';

test('stability bands match the documented thresholds', () => {
  assert.equal(stabilityBand(1), 'high');
  assert.equal(stabilityBand(10 / 12), 'high');
  assert.equal(stabilityBand(6 / 12), 'moderate');
  assert.equal(stabilityBand(5 / 12), 'sensitive');
});

test('frontier takeaway only fires when most benefit is captured before the last budget', () => {
  const takeaway = frontierTakeaway([
    { budgetCredits: 4, median: 10 },
    { budgetCredits: 8, median: 40 },
    { budgetCredits: 12, median: 48 },
    { budgetCredits: 20, median: 50 },
  ]);
  assert.match(takeaway, /8 planning credits/);

  assert.equal(
    frontierTakeaway([
      { budgetCredits: 4, median: 10 },
      { budgetCredits: 20, median: 50 },
    ]),
    null,
  );
});
