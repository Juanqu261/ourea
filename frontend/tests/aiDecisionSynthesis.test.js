import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDecisionSynthesis } from '../src/domain/aiDecisionSynthesis.js';
import { requestDecisionReview } from '../src/services/decisionReviewClient.js';
import { VALID_SYNTHESIS } from './fixtures/aiReview.js';

test('structured synthesis is accepted', () => {
  const parsed = parseDecisionSynthesis(VALID_SYNTHESIS);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.headline, VALID_SYNTHESIS.headline);
});

test('invalid synthesis is rejected', () => {
  assert.equal(parseDecisionSynthesis({ ...VALID_SYNTHESIS, headline: '' }).ok, false);
  assert.equal(parseDecisionSynthesis({ ...VALID_SYNTHESIS, next_actions: [] }).ok, false);
  assert.equal(parseDecisionSynthesis({
    ...VALID_SYNTHESIS,
    next_actions: [{ order: 1, action: 'Go', owner: 'Someone else', timing: 'Now' }],
  }).ok, false);
});

test('client maps timeout, 429 and 500 without leaking bodies', async () => {
  const snapshot = { schema_version: 1, snapshot_id: 'ourea-test' };
  const original = globalThis.fetch;
  const cases = [
    [408, 'timeout'],
    [429, 'busy'],
    [500, 'unavailable'],
  ];
  for (const [status, code] of cases) {
    globalThis.fetch = async () => ({
      ok: false,
      status,
      json: async () => ({ stack: 'secret', error: { message: 'sk-testleak' } }),
    });
    const result = await requestDecisionReview({
      apiUrl: 'https://example.test/api/decision-readiness',
      snapshot,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, code);
    assert.equal(JSON.stringify(result).includes('sk-testleak'), false);
    assert.equal(JSON.stringify(result).includes('stack'), false);
  }
  globalThis.fetch = original;
});

test('client accepts a valid synthesis envelope', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ synthesis: VALID_SYNTHESIS, generated_at: '2026-08-28T00:00:00Z' }),
  });
  const result = await requestDecisionReview({
    apiUrl: 'https://example.test/api/decision-readiness',
    snapshot: { schema_version: 1, snapshot_id: 'ourea-test' },
  });
  globalThis.fetch = original;
  assert.equal(result.ok, true);
  assert.equal(result.synthesis.headline, VALID_SYNTHESIS.headline);
});
