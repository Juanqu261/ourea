import assert from 'node:assert/strict';
import test from 'node:test';
import { VALID_SYNTHESIS } from '../../../frontend/tests/fixtures/aiReview.js';
import { assertSynthesisClaims, flaggedClaim, hasUsd } from '../lib/liveSmokeClaims.js';

test('cannot_conclude may name forbidden topics', () => {
  assert.equal(flaggedClaim({
    headline: 'Field validation next',
    cannot_conclude: ['People protected, lives saved, or losses avoided.'],
  }), null);
});

test('JSON-adjacent cannot_conclude does not flag neighboring fields', () => {
  assert.equal(flaggedClaim({
    cost_interpretation: { uncertainty: 'ce or engineering estimate.' },
    cannot_conclude: ['People protected, lives saved, or losses avoided.'],
  }), null);
});

test('negated robustness language is allowed', () => {
  assert.equal(flaggedClaim({
    headline: 'Proceed with conditions',
    robustness_interpretation: { caveat: 'These are planning proxies, not losses avoided.' },
  }), null);
});

test('an affirmative safety claim is flagged', () => {
  assert.match(flaggedClaim({
    headline: 'This package is ready for construction',
  }) ?? '', /ready for construction/i);
});

test('USD figures match digits or million form', () => {
  assert.equal(hasUsd('base US$0.73 million', 730000), true);
  assert.equal(hasUsd('US$730,000', 730000), true);
  assert.equal(hasUsd('no figures', 730000), false);
});

test('valid fixture synthesis passes claim checks', () => {
  assert.doesNotThrow(() => assertSynthesisClaims('fixture', VALID_SYNTHESIS, { cost: { complete: false } }));
});
