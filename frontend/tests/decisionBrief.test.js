import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { plainPresetCaption, rainfallChip, rainfallHeadline } from '../src/config/climateCopy.js';
import { buildDecisionBrief } from '../src/domain/decisionBrief.js';
import { buildDecisionBriefPdf } from '../src/domain/decisionBriefPdf.js';
import { createPdf } from '../src/domain/pdfDocument.js';
import { googleEarthLookUrl, googleMapsSearchUrl } from '../src/domain/placeLinks.js';
import {
  cellSimulatorUrl,
  decodePlan,
  encodePlan,
  parseSessionHash,
  sessionHash,
} from '../src/domain/sessionLink.js';
import { GUIDED_CELLS, GUIDED_PLAN, RESTORATION_PLAN, SIX_PLAN, guidedPayload } from './fixtures/guidedPlan.js';

const costContext = JSON.parse(
  await readFile(fileURLToPath(new URL('../public/data/cost_context.json', import.meta.url)), 'utf8'),
);

function pdfText(bytes) {
  return new TextDecoder('latin1').decode(bytes);
}

function pdfVisible(body) {
  return [...body.matchAll(/\((?:\\.|[^\\)])*\) Tj/g)]
    .map((match) => match[0].slice(1, -4).replace(/\\([()\\])/g, '$1'))
    .join(' ');
}

async function pdfOf(brief) {
  return pdfText(new Uint8Array(await buildDecisionBriefPdf(brief).arrayBuffer()));
}

function pageCount(body) {
  const match = body.match(/\/Type \/Pages \/Count (\d+)/);
  return match ? Number(match[1]) : 0;
}

test('end-user rainfall copy does not mention CHIRPS', () => {
  const climate = { climatology_period: { label: '1991-2020' }, source_name: 'CHIRPS v3.0 Final' };
  assert.match(rainfallHeadline(climate), /Observed rainfall/);
  assert.doesNotMatch(rainfallHeadline(climate), /CHIRPS/i);
  assert.doesNotMatch(rainfallChip(climate, { presetId: 'typical_wet' }), /CHIRPS/i);
  assert.match(
    plainPresetCaption({ precipitation_mm: 118.8, accumulation_window_days: 15, percentile: 75 }),
    /Common wet period|119 mm/,
  );
});

test('decision brief stays in plain language and keeps a specialist annex', () => {
  const brief = buildDecisionBrief(guidedPayload(), { cells: GUIDED_CELLS, costContext });
  assert.match(brief.recommendation, /Recommend 2 interventions/);
  assert.doesNotMatch(brief.recommendation, /CHIRPS/i);
  assert.doesNotMatch(brief.recommendation, /planning credit/i);
  assert.doesNotMatch(brief.rainfall, /CHIRPS/i);
  assert.match(brief.pathway[0].title, /Ourea deployment/i);
  assert.match(brief.decision, /before fieldwork/i);
  assert.match(brief.decision, /after the field survey defines the scope/i);
  assert.doesNotMatch(brief.decision, /visit, survey, co-design, 30% design and BOQ\) is to be priced after survey/i);
  assert.match(brief.decision, /US\$/);
  assert.equal(brief.immediateAsk.status, 'unpriced_preparation');
  assert.equal(brief.immediateAsk.fieldwork.status, 'to_be_procured_before_fieldwork');
  assert.equal(brief.readiness.status, 'ready_for_field_validation');
  assert.equal(brief.feasibility.find((row) => row.dimension === 'Environmental').status, 'Screening only');
  assert.equal(brief.feasibility.find((row) => row.dimension === 'Institutional').status, 'Documentary alignment');
  assert.match(brief.technicalNote, /CHIRPS/);
  assert.match(brief.simulatorUrl, /ourea/);
  assert.equal(brief.costing.display.total.base, brief.costing.implementationEnvelope.base);
  assert.ok(brief.citations.length >= 1);
  assert.ok(brief.feasibility.some((row) => row.dimension === 'Financial'));
});

test('decision brief names hillside cells and costing quantities', () => {
  const brief = buildDecisionBrief(guidedPayload(), { cells: GUIDED_CELLS, costContext });
  assert.match(brief.projects[0].place, /Llanaditas No\. 2/);
  assert.match(brief.projects[1].place, /Llanaditas No\. 2/);
  assert.equal(brief.projects[0].quantity, 1);
  assert.match(brief.projects[1].quantityLabel, /^1 selected planning-cell package$/);
  assert.match(brief.projects[0].mapsUrl, /maps\/search/);
  assert.match(brief.projects[1].earthUrl, /earth\.google\.com/);
});

test('drainage work orders stay at one package per cell while the cost line keeps N', async () => {
  const portfolio = [
    { cell_id: 1, type: 'drainage' },
    { cell_id: 18, type: 'drainage' },
    { cell_id: 2, type: 'drainage' },
  ];
  const brief = buildDecisionBrief(guidedPayload({ portfolio }), { cells: GUIDED_CELLS, costContext });
  const drainageOrders = brief.projects.filter((item) => item.type === 'drainage');
  const line = brief.costing.lines.find((item) => item.type === 'drainage');
  const pkg = costContext.interventions.drainage.usd_per_package;
  assert.equal(drainageOrders.length, 3);
  for (const order of drainageOrders) {
    assert.equal(order.quantity, 1);
    assert.equal(order.quantityLabel, '1 selected planning-cell package');
  }
  assert.equal(drainageOrders.reduce((sum, item) => sum + item.quantity, 0), line.assumedQuantity);
  assert.equal(line.assumedQuantity, 3);
  assert.equal(line.quantityLabel, '3 selected planning-cell packages; corridor consolidation not assessed.');
  assert.match(brief.drainageConsolidationWarning, /Adjacent selected cells may represent one connected corridor/);
  assert.equal(brief.costing.total.low, pkg.low * 3);
  assert.equal(brief.costing.total.base, pkg.base * 3);
  assert.equal(brief.costing.total.high, pkg.high * 3);
  const body = await pdfOf(brief);
  const visible = pdfVisible(body);
  assert.equal([...visible.matchAll(/1 selected planning-cell package(?!s)/g)].length, 3);
  assert.equal([...visible.matchAll(/3 selected planning-cell packages; corridor consolidation not assessed/g)].length, 1);
  assert.equal([...visible.matchAll(/Adjacent selected cells may represent one connected corridor/g)].length, 1);
  assert.ok(pageCount(body) >= 6 && pageCount(body) <= 8);
});

test('guided decision brief PDF is a 7-page document with metadata and USD', async () => {
  const brief = buildDecisionBrief(guidedPayload(), { cells: GUIDED_CELLS, costContext });
  const blob = buildDecisionBriefPdf(brief);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes.slice(0, 8)).startsWith('%PDF-1.'), true);
  const body = pdfText(bytes);
  const pages = pageCount(body);
  assert.ok(pages >= 6 && pages <= 8, `pages=${pages}`);
  assert.match(body, /\/Title \(Ourea decision brief - /);
  assert.match(body, /\/Author \(Ourea\)/);
  assert.match(body, /\/Subject/);
  assert.match(body, /\/Keywords/);
  assert.match(body, /\/CreationDate \(D:20260828150000Z\)/);
  assert.match(body, /\/Lang \(en-US\)/);
  assert.match(body, /Why this proving ground/);
  assert.match(body, /Setting/);
  assert.match(body, /City screening lens/);
  assert.match(body, /Rainfall context/);
  assert.match(body, /Policy priority/);
  assert.match(body, /Weeks 1/);
  assert.match(body, /Includes/);
  assert.match(body, /Excludes/);
  assert.doesNotMatch(body, /Full URLs are clickable/);
  assert.doesNotMatch(body, /clickable annotations/);
  assert.match(body, /Cost build-up/);
  assert.match(body, /Implementation pathway/);
  assert.doesNotMatch(body, /AI-assisted decision synthesis/);
  assert.doesNotMatch(body, /AI review not generated/);
  assert.match(body, /Why early action matters/);
  assert.match(body, /Decision requested/);
  assert.match(body, /Immediate decision-preparation/);
  assert.match(body, /Future implementation envelope/);
  assert.match(body, /before fieldwork/);
  assert.match(body, /after the field survey defines the scope/);
  assert.doesNotMatch(body, /To be priced after survey[.]/);
  assert.match(body, /Planning quantity/);
  assert.match(body, /Confidence/);
  assert.match(body, /selected planning-cell package/);
  assert.match(body, /US\$/);
  assert.match(body, /pre-feasibility/);
  assert.match(body, /2026-08-28/);
  assert.match(body, /3144\.28/);
  assert.match(body, /Ourea/);
  assert.match(body, /Maps/);
  assert.match(body, /Earth/);
  assert.match(body, /\/S \/URI/);
  assert.match(body, /ybedoyab\.github\.io\/ourea/);
  assert.match(body, /maps\/search/);
  assert.match(body, /earth\.google\.com/);
  assert.match(body, new RegExp(`Page ${pages} of ${pages}`));
  assert.doesNotMatch(body, /Page 9 of/);
  assert.doesNotMatch(body, /\(Contents\)/);
  assert.doesNotMatch(body, /\(credit/i);
  assert.doesNotMatch(body, /planning credit/i);
  assert.doesNotMatch(body, /houses fall/i);
  assert.doesNotMatch(body, /houses lean/i);
  assert.doesNotMatch(body, /collapse expected/i);
  assert.doesNotMatch(body, /failure year/i);
  assert.match(body, /not a site-specific collapse forecast/i);
  assert.doesNotMatch(body, /GIF/i);
  assert.doesNotMatch(body, /fx_banrep_trm/);
  assert.doesNotMatch(body.split('Specialist annex')[0], /CHIRPS/);
  for (const match of body.matchAll(/\/Rect \[([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)\]/g)) {
    const nums = match.slice(1).map(Number);
    assert.ok(nums.every((value) => value >= -0.01 && value <= 842));
    assert.ok(nums[0] >= 0 && nums[2] <= 595.28 + 0.05);
  }
  const sizes = [...body.matchAll(/(\d+(?:\.\d+)?) Tf/g)].map((item) => Number(item[1]));
  assert.ok(Math.min(...sizes) >= 9);
});

test('AI-assisted PDF section stays within eight pages and does not change USD totals', async () => {
  const { VALID_SYNTHESIS } = await import('./fixtures/aiReview.js');
  const brief = buildDecisionBrief(guidedPayload(), {
    cells: GUIDED_CELLS,
    costContext,
    aiReview: {
      readiness: { status: 'ready_for_field_validation' },
      synthesis: VALID_SYNTHESIS,
      generatedAt: '2026-08-28T12:00:00Z',
    },
  });
  const body = await pdfOf(brief);
  const pages = pageCount(body);
  assert.ok(pages >= 6 && pages <= 8);
  assert.match(body, /AI-assisted decision synthesis/);
  assert.match(body, /Ready for field validation/);
  assert.match(body, /Cost and robustness interpretation/);
  assert.match(body, /Main cost driver/);
  assert.match(body, /Robustness caveat/);
  assert.match(body, /What Ourea cannot conclude/);
  assert.doesNotMatch(body, /Environmental[\s\S]{0,40}Blocked/);
  assert.equal(brief.costing.display.total.base, brief.costing.implementationEnvelope.base);
  assert.doesNotMatch(body, /planning credit/i);
});

test('restoration portfolio PDF stays within eight pages and a USD envelope', async () => {
  const brief = buildDecisionBrief(guidedPayload({
    portfolio: RESTORATION_PLAN,
    budget: { spent: 2, available: 10 },
    action_footprint: {
      planning_cells_targeted: 1,
      cadastral_buildings_in_targeted_cells: 25,
      high_hazard_buildings_in_targeted_cells: 12,
      population_proxy_in_targeted_cells: 80,
    },
    community_safeguards: { validation_status: 'community_reviewed' },
  }), { cells: GUIDED_CELLS, costContext });
  const body = await pdfOf(brief);
  const pages = pageCount(body);
  assert.ok(pages >= 6 && pages <= 8);
  assert.match(body, /Restoration/);
  assert.match(body, /US\$/);
  assert.match(body, /project-scale/);
  assert.doesNotMatch(body, /planning credit/i);
  assert.doesNotMatch(body, /houses fall/i);
});

test('unpriced intervention does not invent a total', async () => {
  const brief = buildDecisionBrief(guidedPayload({
    portfolio: [{ cell_id: 12, type: 'unknown' }],
  }), { cells: GUIDED_CELLS, costContext });
  assert.equal(brief.costing.complete, false);
  assert.equal(brief.costing.total, null);
  const body = await pdfOf(brief);
  assert.match(body, /Not estimable|not estimable/);
});

test('pdf writer encodes Spanish letters, metadata and a catalog', async () => {
  const pdf = createPdf({
    info: {
      title: 'Ourea test',
      author: 'Ourea',
      subject: 'Metadata check',
      keywords: ['Ourea', 'test'],
      creationDate: '2026-08-28T15:00:00Z',
      lang: 'en-US',
    },
  });
  pdf.text('Medellín · 28 August 2026', 40, 80);
  const body = pdfText(new Uint8Array(await pdf.toBlob().arrayBuffer()));
  assert.match(body, /Medell\\355n/);
  assert.match(body, /\\267/);
  assert.match(body, /\/Title \(Ourea test\)/);
  assert.match(body, /\/Author \(Ourea\)/);
  assert.match(body, /\/Lang \(en-US\)/);
  assert.match(body, /\/Type \/Catalog/);
  assert.doesNotMatch(body, /Medell\?/);
});

test('session links encode a cell and the active plan', () => {
  const plan = GUIDED_PLAN;
  assert.equal(encodePlan(plan), '12:rwh,18:drainage');
  assert.deepEqual(decodePlan('12:rwh,18:drainage'), [...plan]);
  const parsed = parseSessionHash('#area=llanaditas&cell=35&plan=12:rwh,18:drainage');
  assert.equal(parsed.areaId, 'llanaditas');
  assert.equal(parsed.cellId, 35);
  assert.match(cellSimulatorUrl(35, 'https://ybedoyab.github.io/ourea/', plan), /ybedoyab\.github\.io\/ourea\//);
  assert.match(sessionHash({ cellId: 35, plan }), /area=llanaditas/);
});

test('place links point at Google Maps and Google Earth', () => {
  const maps = googleMapsSearchUrl(6.2542, -75.5408);
  const earth = googleEarthLookUrl(6.2542, -75.5408);
  assert.match(maps, /google\.com\/maps\/search/);
  assert.match(earth, /earth\.google\.com\/web/);
});

test('six-intervention and many-reference briefs stay within eight pages', async () => {
  const extra = structuredClone(costContext);
  extra.sources.push({
    id: 'long_url_fixture',
    reader_label: 'Alcaldía de Medellín - hydraulic works',
    title: 'Informe extraordinariamente largo de obras hidráulicas',
    source_date: null,
    access_date: '2026-08-28',
    source_type: 'municipal public-works report',
    url: `https://example.test/${'section/'.repeat(40)}doc.pdf`,
    comparability_warning: 'wrap',
    location: 'Medellín',
    quantity_basis: 'n/a',
    inflation_method: 'none',
    fx_method: 'none',
    inclusions: [],
    exclusions: [],
    evidence_tier: 'fixture',
  });
  extra.interventions.drainage.source_ids.push('long_url_fixture');
  const many = buildDecisionBrief(guidedPayload(), { cells: GUIDED_CELLS, costContext: extra });
  assert.ok(many.citations.length > 6);
  assert.equal(many.citations.find((item) => item.id === 'long_url_fixture').date, null);
  const manyBody = await pdfOf(many);
  assert.ok(pageCount(manyBody) <= 8);
  assert.match(manyBody, /date not stated/);
  assert.doesNotMatch(manyBody, /fx_banrep_trm/);
  const six = buildDecisionBrief(guidedPayload({ portfolio: SIX_PLAN }), { cells: GUIDED_CELLS, costContext });
  const sixBody = await pdfOf(six);
  assert.ok(pageCount(sixBody) <= 8);
  assert.match(sixBody, /Restoration/);
  assert.match(sixBody, /connected corridor/);
  assert.equal(six.projects.filter((item) => item.type === 'drainage').every((item) => item.quantity === 1 && item.quantityLabel === '1 selected planning-cell package'), true);
  assert.equal([...sixBody.matchAll(/Adjacent selected cells may represent one connected corridor/g)].length, 1);
  assert.doesNotMatch(sixBody, /TRM \(/);
});
