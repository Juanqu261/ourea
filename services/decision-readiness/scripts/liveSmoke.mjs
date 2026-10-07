import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { generateAlternativePortfolios } from '../../../frontend/src/domain/alternatives.js';
import { compareSelectionStrategies } from '../../../frontend/src/domain/benchmark.js';
import { diagnosePortfolioBreaks } from '../../../frontend/src/domain/sensitivity.js';
import { createScenarioContext, evaluatePortfolio, monteCarloPortfolio } from '../../../frontend/src/domain/scenarioEngine.js';
import { defaultScenarioFromClimate, rainStepsFromClimate } from '../../../frontend/src/domain/climateScenarios.js';
import { emptyCommunityAssessment } from '../../../frontend/src/domain/communitySafeguards.js';
import { estimatePortfolioCost } from '../../../frontend/src/domain/costEstimate.js';
import { actionFootprint } from '../../../frontend/src/domain/actionFootprint.js';
import { buildAiDecisionSnapshot } from '../../../frontend/src/domain/aiDecisionSnapshot.js';
import { DEFAULT_SCENARIO, MODEL_PARAMETERS } from '../../../frontend/src/config/modelConfig.js';
import { SynthesisSchema } from '../lib/schema.js';
import { assertSynthesisClaims } from '../lib/liveSmokeClaims.js';
import { VALID_SNAPSHOT } from '../../../frontend/tests/fixtures/aiReview.js';

const frontendRoot = fileURLToPath(new URL('../../../frontend/', import.meta.url));
const dataDir = join(frontendRoot, 'public', 'data');
const apiUrl = process.env.OUREA_AI_API_URL
  || process.env.VITE_OUREA_AI_API_URL
  || 'https://ourea-decision-readiness.vercel.app/api/decision-readiness';
const origin = process.env.SMOKE_ORIGIN || 'https://ybedoyab.github.io';

async function load(name) {
  return JSON.parse(await readFile(join(dataDir, name), 'utf8'));
}

async function post(label, snapshot) {
  const started = Date.now();
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
    },
    body: JSON.stringify({ snapshot }),
  });
  const text = await response.text();
  const ms = Date.now() - started;
  if (text.includes('sk-') || /OPENAI_API_KEY/.test(text)) {
    throw new Error(`${label}: response contained a secret marker`);
  }
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${label}: non-JSON ${response.status} ${text.slice(0, 180)}`);
  }
  return { label, status: response.status, ms, body, requestId: body.request_id ?? body.error?.request_id ?? null };
}

function assertSchema(label, synthesis, snapshot) {
  const parsed = SynthesisSchema.safeParse(synthesis);
  if (!parsed.success) {
    throw new Error(`${label}: schema mismatch ${parsed.error.issues.slice(0, 4).map((item) => item.message).join('; ')}`);
  }
  assertSynthesisClaims(label, parsed.data, snapshot);
}

const buildings = await load('buildings.geojson');
const cells = await load('planning_cells.geojson');
const climate = await load('climate_context.json');
const evidence = await load('evidence_status.json');
const costContext = await load('cost_context.json');
const planAlignment = await load('plan_alignment.json');
const context = createScenarioContext(buildings, cells);
const demo = defaultScenarioFromClimate(climate, DEFAULT_SCENARIO.budgetCredits);
const demoScenario = {
  rainMm: demo.rainMm,
  antecedentWetness: demo.antecedentWetness,
  planningYear: 1,
  presetId: demo.presetId,
  climate: demo.climate,
};

const options = generateAlternativePortfolios({
  context,
  cellsGeoJson: cells,
  scenario: demoScenario,
  budgetCredits: DEFAULT_SCENARIO.budgetCredits,
});
const recommended = [...options].sort(
  (a, b) => b.uncertainty.p10 - a.uncertainty.p10 || b.downsideRetention - a.downsideRetention,
)[0];
const comparison = compareSelectionStrategies({
  context,
  cellsGeoJson: cells,
  scenario: demoScenario,
  budgetCredits: DEFAULT_SCENARIO.budgetCredits,
  profile: recommended.profileId,
});
const robust = comparison.strategies.find((item) => item.id === 'ourea_robust');
const breakage = diagnosePortfolioBreaks({
  context,
  cellsGeoJson: cells,
  plan: robust?.plan ?? recommended.plan,
  alternativePlan: comparison.strategies.find((item) => item.id === 'hazard_only')?.plan,
  scenario: demoScenario,
  budgetCredits: DEFAULT_SCENARIO.budgetCredits,
  profile: recommended.profileId,
  climateRainSteps: rainStepsFromClimate(climate),
});

function snapshotFor(portfolio) {
  return buildAiDecisionSnapshot({
    language: 'en',
    portfolio,
    profileId: recommended.profileId ?? 'balanced',
    scenario: demoScenario,
    climateContext: climate,
    monteCarlo: monteCarloPortfolio({
      context,
      projects: portfolio,
      scenario: demoScenario,
      seed: MODEL_PARAMETERS.scenarioUncertainty.comparisonSeed,
    }),
    metrics: evaluatePortfolio({ context, projects: portfolio, scenario: demoScenario }),
    benchmark: comparison,
    breakage,
    costing: estimatePortfolioCost({ portfolio, cells, costContext }),
    actionFootprint: actionFootprint({ projects: portfolio, cells, rainMm: demoScenario.rainMm }),
    evidence,
    communityAssessment: emptyCommunityAssessment(portfolio),
    planAlignment,
    recommendationStale: false,
  });
}

const cases = [
  ['fixture', VALID_SNAPSHOT],
  ['published-example', snapshotFor(recommended.plan)],
];

process.stdout.write(`live-smoke endpoint=${apiUrl} origin=${origin}\n`);
process.stdout.write('Cost note: about US$0.02 per generation at gpt-5.6-terra short-context rates; this script posts two snapshots.\n');

for (const [label, snapshot] of cases) {
  let result = await post(label, snapshot);
  if (result.status !== 200 && label === 'published-example') {
    await new Promise((resolve) => setTimeout(resolve, 20000));
    result = await post(label, snapshot);
  }
  process.stdout.write(`${JSON.stringify({
    label: result.label,
    status: result.status,
    ms: result.ms,
    requestId: result.requestId,
    code: result.body.error?.code ?? null,
    headline: result.body.synthesis?.headline ?? null,
  })}\n`);
  if (result.status !== 200) {
    throw new Error(`${label} rejected with ${result.status} ${result.body.error?.code ?? ''} ${result.requestId ?? ''}`);
  }
  assertSchema(label, result.body.synthesis, snapshot);
}

process.stdout.write('live-smoke passed\n');
