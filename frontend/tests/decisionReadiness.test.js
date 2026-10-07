import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { emptyCommunityAssessment } from '../src/domain/communitySafeguards.js';
import { estimatePortfolioCost } from '../src/domain/costEstimate.js';
import { assessDecisionReadiness, CONSTRUCTION_READINESS, READINESS_STATUS } from '../src/domain/decisionReadiness.js';
import { GUIDED_CELLS, GUIDED_PLAN, RESTORATION_PLAN } from './fixtures/guidedPlan.js';

const costContext = JSON.parse(
  await readFile(fileURLToPath(new URL('../public/data/cost_context.json', import.meta.url)), 'utf8'),
);
const evidence = JSON.parse(
  await readFile(fileURLToPath(new URL('../public/data/evidence_status.json', import.meta.url)), 'utf8'),
);
const climate = JSON.parse(
  await readFile(fileURLToPath(new URL('../public/data/climate_context.json', import.meta.url)), 'utf8'),
);
const alignment = JSON.parse(
  await readFile(fileURLToPath(new URL('../public/data/plan_alignment.json', import.meta.url)), 'utf8'),
);

const monteCarlo = { runs: 40, p10: 8.2, median: 10, p90: 12 };
const metrics = { benefit: 10 };
const benchmark = { strategies: [{ id: 'ourea_robust', p10: 8 }, { id: 'hazard_only', p10: 6 }, { id: 'deterministic_central', p10: 7 }] };
const breakage = { scenarioCombinationsBelowThreshold: [{ rainMm: 1 }], breaches: [{ rainMm: 1 }] };

function base(overrides = {}) {
  return {
    portfolio: GUIDED_PLAN,
    recommendationStale: false,
    metrics,
    monteCarlo,
    benchmark,
    breakage,
    climateContext: climate,
    costing: estimatePortfolioCost({ portfolio: GUIDED_PLAN, cells: GUIDED_CELLS, costContext }),
    evidence,
    communityAssessment: emptyCommunityAssessment(GUIDED_PLAN),
    planAlignment: alignment,
    profileId: 'balanced',
    scenario: { presetId: 'typical_wet', rainMm: 118.8, planningYear: 3, antecedentWetness: 0.5 },
    ...overrides,
  };
}

test('guided portfolio with not-assessed community is ready for field validation', () => {
  const result = assessDecisionReadiness(base());
  assert.equal(result.construction_readiness, CONSTRUCTION_READINESS);
  assert.equal(result.status, READINESS_STATUS.READY);
  assert.equal(result.gates.find((gate) => gate.id === 'community_review').status, 'pending');
  assert.equal(result.gates.find((gate) => gate.id === 'drainage_survey').status, 'pending');
  assert.equal(result.gates.find((gate) => gate.id === 'thirty_percent_design').status, 'pending');
  assert.match(result.next_decision, /site validation/i);
  assert.ok(result.deterministic_fingerprint.startsWith('ourea-'));
});

test('community not assessed is a pending gate, not a negative conclusion', () => {
  const gate = assessDecisionReadiness(base()).gates.find((item) => item.id === 'community_review');
  assert.equal(gate.status, 'pending');
  assert.match(gate.reason, /not support, opposition or low social risk/i);
});

test('community requires deliberation is proceed with conditions', () => {
  const result = assessDecisionReadiness(base({
    communityAssessment: { validation_status: 'requires_deliberation', file_status: 'ok' },
  }));
  assert.equal(result.status, READINESS_STATUS.CONDITIONS);
  assert.equal(result.gates.find((gate) => gate.id === 'community_review').status, 'conditional');
});

test('invalid community file blocks readiness', () => {
  const result = assessDecisionReadiness(base({
    communityAssessment: { validation_status: 'invalid', file_status: 'invalid' },
  }));
  assert.equal(result.status, READINESS_STATUS.EVIDENCE);
  assert.equal(result.gates.find((gate) => gate.id === 'community_review').status, 'blocked');
});

test('invalid evidence registry is a blocked gate', () => {
  const result = assessDecisionReadiness(base({ evidence: { schema: 'x', layers: [] } }));
  assert.equal(result.status, READINESS_STATUS.EVIDENCE);
  assert.equal(result.gates.find((gate) => gate.id === 'evidence_registry').status, 'blocked');
});

test('unpriced or missing USD envelope is blocked', () => {
  const missing = assessDecisionReadiness(base({ costing: null }));
  assert.equal(missing.status, READINESS_STATUS.EVIDENCE);
  const unpriced = assessDecisionReadiness(base({
    costing: { complete: false, unpriced: ['mystery'], display: null },
  }));
  assert.equal(unpriced.gates.find((gate) => gate.id === 'usd_envelope').status, 'blocked');
});

test('stale portfolio is blocked', () => {
  const result = assessDecisionReadiness(base({ recommendationStale: true }));
  assert.equal(result.status, READINESS_STATUS.EVIDENCE);
  assert.equal(result.gates.find((gate) => gate.id === 'portfolio').status, 'blocked');
});

test('restoration low evidence confidence is conditional', () => {
  const result = assessDecisionReadiness(base({
    portfolio: RESTORATION_PLAN,
    costing: estimatePortfolioCost({ portfolio: RESTORATION_PLAN, cells: GUIDED_CELLS, costContext }),
    communityAssessment: emptyCommunityAssessment(RESTORATION_PLAN),
  }));
  assert.equal(result.status, READINESS_STATUS.CONDITIONS);
  assert.equal(result.gates.find((gate) => gate.id === 'restoration_confidence').status, 'conditional');
});

test('low, base and high remain ordered in the costing used by readiness', () => {
  const costing = estimatePortfolioCost({ portfolio: GUIDED_PLAN, cells: GUIDED_CELLS, costContext });
  assert.equal(costing.display.total.low < costing.display.total.base, true);
  assert.equal(costing.display.total.base < costing.display.total.high, true);
});

test('feasibility matrix is deterministic and has no total score', () => {
  const result = assessDecisionReadiness(base());
  assert.equal(result.feasibility.length, 6);
  assert.equal(result.feasibility.find((row) => row.dimension === 'Social').status, 'Not assessed');
  assert.equal(result.feasibility.find((row) => row.dimension === 'Financial').status, 'Pre-feasibility');
  assert.equal(result.feasibility.find((row) => row.dimension === 'Environmental').status, 'Screening only');
  assert.equal('score' in result, false);
});
