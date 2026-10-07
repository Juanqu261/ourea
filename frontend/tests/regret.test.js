import test from 'node:test';
import assert from 'node:assert/strict';
import { regret, signedDelta } from '../src/domain/regret.js';

test('regret is a non-negative shortfall versus the reference', () => {
  assert.equal(regret(10, 7), 3);
  assert.equal(regret(10, 10), 0);
  assert.equal(regret(10, 12), 0);
});

test('signed delta keeps the sign when a comparator beats the reference', () => {
  assert.equal(signedDelta(10, 7), -3);
  assert.equal(signedDelta(10, 12), 2);
  assert.equal(signedDelta(10, 10), 0);
});
