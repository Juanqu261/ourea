import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { emptyCommunityAssessment } from '../src/domain/communitySafeguards.js';
import { buildDecisionBrief } from '../src/domain/decisionBrief.js';
import { buildDecisionBriefPdf } from '../src/domain/decisionBriefPdf.js';
import { buildDecisionPackage } from '../src/domain/decisionPackage.js';
import { READINESS_STATUS } from '../src/domain/decisionReadiness.js';
import { VALID_SYNTHESIS } from './fixtures/aiReview.js';
import { GUIDED_CELLS, GUIDED_PLAN } from './fixtures/guidedPlan.js';

const costContext = JSON.parse(
  await readFile(fileURLToPath(new URL('../public/data/cost_context.json', import.meta.url)), 'utf8'),
);
const evidence = JSON.parse(
  await readFile(fileURLToPath(new URL('../public/data/evidence_status.json', import.meta.url)), 'utf8'),
);
const planAlignment = JSON.parse(
  await readFile(fileURLToPath(new URL('../public/data/plan_alignment.json', import.meta.url)), 'utf8'),
);
const climateContext = JSON.parse(
  await readFile(fileURLToPath(new URL('../public/data/climate_context.json', import.meta.url)), 'utf8'),
);

function pdfText(bytes) {
  return new TextDecoder('latin1').decode(bytes);
}

function packagePayload() {
  return buildDecisionPackage({
    scenario: {
      rainMm: 118.8,
      antecedentWetness: 0.5,
      planningYear: 3,
      presetId: 'typical_wet',
      climate: {
        accumulationWindowDays: 15,
        percentile: 75,
        climatologyPeriod: '1991-2020',
        sourceName: climateContext.source_name,
      },
    },
    budgetCredits: 10,
    view: 'ai',
    cityLens: 'balanced',
    selectedAiProfileId: 'balanced',
    projects: GUIDED_PLAN,
    metrics: {
      baselineExposure: 12,
      residualExposure: 4,
      benefit: 10,
      equityBenefit: 4,
      accessBenefit: 3,
      buildingsAboveThreshold: 20,
      populationAboveThreshold: 40,
    },
    baseline: {
      baselineExposure: 12,
      buildingsAboveThreshold: 40,
      populationAboveThreshold: 80,
    },
    monteCarlo: { runs: 40, p10: 8.2, median: 10, p90: 12, mean: 10 },
    summary: { buildings: 1588 },
    evidence,
    community: emptyCommunityAssessment(GUIDED_PLAN),
    benchmark: {
      strategies: [
        { id: 'ourea_robust', p10: 8.2 },
        { id: 'hazard_only', p10: 6 },
        { id: 'deterministic_central', p10: 7 },
      ],
    },
    breakage: { scenarioCombinationsBelowThreshold: [{ rainMm: 210 }], breaches: [{ rainMm: 210 }] },
    planAlignment,
    climateContext,
    cells: GUIDED_CELLS,
  });
}

test('buildDecisionPackage payload feeds buildDecisionBrief without unpublished extras', async () => {
  const payload = packagePayload();
  assert.equal(payload.evidence, undefined);
  assert.ok(payload.evidence_status?.layers?.length > 0);
  assert.ok(payload.selection_benchmark);
  assert.ok(payload.portfolio_breakage);
  assert.ok(payload.plan_alignment?.entries?.length > 0);

  const brief = buildDecisionBrief(payload, { cells: GUIDED_CELLS, costContext });
  assert.equal(brief.readiness.status, READINESS_STATUS.READY);
  assert.equal(brief.feasibility.find((row) => row.dimension === 'Environmental').status, 'Screening only');
  assert.equal(brief.feasibility.find((row) => row.dimension === 'Institutional').status, 'Documentary alignment');
  assert.equal(brief.readiness.gates.find((gate) => gate.id === 'benchmark').status, 'passed');
  assert.equal(brief.readiness.gates.find((gate) => gate.id === 'evidence_registry').status, 'passed');
  assert.match(brief.decisionRequested, /Authorize procurement of the scoped field-validation package/);

  const withAi = buildDecisionBrief(payload, {
    cells: GUIDED_CELLS,
    costContext,
    aiReview: {
      readiness: brief.readiness,
      synthesis: VALID_SYNTHESIS,
      generatedAt: '2026-08-28T12:00:00Z',
    },
  });
  const body = pdfText(new Uint8Array(await buildDecisionBriefPdf(withAi).arrayBuffer()));
  const pages = Number(body.match(/\/Type \/Pages \/Count (\d+)/)?.[1] ?? 0);
  assert.ok(pages >= 6 && pages <= 8, `pages=${pages}`);
  assert.match(body, /Ready for field validation/);
  assert.match(body, /Screening only/);
  assert.match(body, /Documentary alignment/);
  assert.match(body, /Cost and robustness interpretation/);
  assert.match(body, /What Ourea cannot conclude/);
  assert.doesNotMatch(body, /Environmental[\s\S]{0,80}Blocked/);
  assert.doesNotMatch(body, /planning credit/i);
  const sizes = [...body.matchAll(/(\d+(?:\.\d+)?) Tf/g)].map((item) => Number(item[1]));
  assert.ok(sizes.length > 0 && Math.min(...sizes) >= 9);
});
