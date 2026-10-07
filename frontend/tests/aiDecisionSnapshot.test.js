import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { actionFootprint } from '../src/domain/actionFootprint.js';
import { buildAiDecisionSnapshot, SNAPSHOT_FORBIDDEN_PATTERN, snapshotByteSize } from '../src/domain/aiDecisionSnapshot.js';
import { estimatePortfolioCost } from '../src/domain/costEstimate.js';
import { emptyCommunityAssessment } from '../src/domain/communitySafeguards.js';
import { GUIDED_CELLS, GUIDED_PLAN } from './fixtures/guidedPlan.js';

const costContext = JSON.parse(
  await readFile(fileURLToPath(new URL('../public/data/cost_context.json', import.meta.url)), 'utf8'),
);
const evidence = JSON.parse(
  await readFile(fileURLToPath(new URL('../public/data/evidence_status.json', import.meta.url)), 'utf8'),
);
const climate = JSON.parse(
  await readFile(fileURLToPath(new URL('../public/data/climate_context.json', import.meta.url)), 'utf8'),
);

const snapshot = buildAiDecisionSnapshot({
  language: 'en',
  portfolio: GUIDED_PLAN,
  profileId: 'balanced',
  scenario: { presetId: 'typical_wet', rainMm: 118.8 },
  climateContext: climate,
  monteCarlo: { runs: 40, p10: 8.2, median: 10, p90: 12 },
  metrics: { benefit: 10 },
  benchmark: {
    strategies: [
      { id: 'ourea_robust', p10: 8.2 },
      { id: 'hazard_only', p10: 6.1 },
      { id: 'deterministic_central', p10: 7.4 },
    ],
  },
  breakage: { scenarioCombinationsBelowThreshold: [1, 2], breaches: [1, 2] },
  costing: estimatePortfolioCost({ portfolio: GUIDED_PLAN, cells: GUIDED_CELLS, costContext }),
  actionFootprint: actionFootprint({ projects: GUIDED_PLAN, cells: GUIDED_CELLS, rainMm: 118.8 }),
  evidence,
  communityAssessment: emptyCommunityAssessment(GUIDED_PLAN),
  planAlignment: { entries: [{ id: 'x' }], status: 'documentary-alignment-not-community-support' },
});

test('AI snapshot is minimized and stays under the payload cap', () => {
  assert.equal(snapshot.interventions.length, 2);
  assert.equal(snapshot.cost.complete, true);
  assert.equal(snapshot.cost.currency, 'USD');
  assert.match(snapshot.action_footprint.label, /planning proxies/i);
  assert.ok(snapshotByteSize(snapshot) < 12288);
  assert.match(snapshot.snapshot_id, /^ourea-/);
  assert.equal(snapshot.readiness.construction_readiness, 'not_assessed_by_ourea');
});

test('AI snapshot never includes coordinates, geometries, notes, PII or secrets', () => {
  const serialized = JSON.stringify(snapshot);
  assert.equal(SNAPSHOT_FORBIDDEN_PATTERN.test(serialized), false);
  assert.equal(Object.hasOwn(snapshot, 'geometry'), false);
  assert.equal(Object.hasOwn(snapshot, 'notes'), false);
  assert.doesNotMatch(serialized, /planning credit/i);
});

test('fingerprint changes when the portfolio changes', () => {
  const other = buildAiDecisionSnapshot({
    language: 'en',
    portfolio: [GUIDED_PLAN[0]],
    profileId: 'balanced',
    scenario: { presetId: 'typical_wet', rainMm: 118.8 },
    climateContext: climate,
    monteCarlo: { runs: 40, p10: 8.2, median: 10, p90: 12 },
    metrics: { benefit: 10 },
    costing: estimatePortfolioCost({ portfolio: [GUIDED_PLAN[0]], cells: GUIDED_CELLS, costContext }),
    evidence,
    communityAssessment: emptyCommunityAssessment([GUIDED_PLAN[0]]),
  });
  assert.notEqual(other.snapshot_id, snapshot.snapshot_id);
});
