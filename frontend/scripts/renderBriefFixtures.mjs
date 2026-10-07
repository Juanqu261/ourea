import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildDecisionBrief } from '../src/domain/decisionBrief.js';
import { buildDecisionBriefPdf } from '../src/domain/decisionBriefPdf.js';
import { VALID_SYNTHESIS } from '../tests/fixtures/aiReview.js';
import { GUIDED_CELLS, SIX_PLAN, guidedPayload } from '../tests/fixtures/guidedPlan.js';

const frontend = dirname(fileURLToPath(new URL('../', import.meta.url)));
const outDir = process.argv[2] || join(frontend, '..', '.cache', 'pdf-audit');
const costContext = JSON.parse(
  await readFile(new URL('../public/data/cost_context.json', import.meta.url), 'utf8'),
);

const longUrl = `https://www.medellin.gov.co/es/sala-de-prensa/noticias/${'obra-hidraulica-llanaditas-'.repeat(12)}documento.pdf?lang=es&ref=${'x'.repeat(40)}`;

function withExtraSources() {
  const extra = structuredClone(costContext);
  extra.sources = [
    ...(extra.sources ?? []),
    {
      id: 'long_url_fixture',
      reader_label: 'Alcaldía de Medellín - hydraulic works',
      title: 'Informe extraordinariamente largo de obras hidráulicas de prefactibilidad para corredores de drenaje en ladera urbana con tildes: Medellín, Comuna 8',
      source_date: null,
      access_date: '2026-08-28',
      source_type: 'municipal public-works report',
      url: longUrl,
      comparability_warning: 'Fixture for wrapping.',
      location: 'Medellín',
      quantity_basis: 'n/a',
      inflation_method: 'none',
      fx_method: 'none',
      inclusions: [],
      exclusions: [],
      evidence_tier: 'fixture',
    },
  ];
  extra.interventions.drainage.source_ids = [
    ...(extra.interventions.drainage.source_ids ?? []),
    'long_url_fixture',
  ];
  return extra;
}

async function save(name, payload, extras = {}) {
  const brief = buildDecisionBrief(payload, { cells: GUIDED_CELLS, costContext, ...extras });
  const bytes = new Uint8Array(await buildDecisionBriefPdf(brief).arrayBuffer());
  await writeFile(join(outDir, name), bytes);
  console.log(name, bytes.length);
}

await mkdir(outDir, { recursive: true });
await save('guided-rwh-drainage.pdf', guidedPayload());
await save('guided-with-ai.pdf', guidedPayload(), {
  aiReview: {
    readiness: { status: 'ready_for_field_validation' },
    synthesis: VALID_SYNTHESIS,
    generatedAt: '2026-08-28T12:00:00Z',
  },
});
await save(
  'restoration.pdf',
  guidedPayload({
    portfolio: [{ cell_id: 7, type: 'restoration' }],
    budget: { spent: 2, available: 10 },
  }),
);
await save(
  'six-interventions.pdf',
  guidedPayload({
    portfolio: SIX_PLAN,
    budget: { spent: 10, available: 10 },
    action_footprint: {
      planning_cells_targeted: 6,
      cadastral_buildings_in_targeted_cells: 111,
      high_hazard_buildings_in_targeted_cells: 85,
      population_proxy_in_targeted_cells: 196,
    },
  }),
);
await save('many-references.pdf', guidedPayload(), { costContext: withExtraSources() });
await save(
  'incomplete-cost.pdf',
  guidedPayload({
    portfolio: [{ cell_id: 12, type: 'unknown' }],
  }),
);
await save('mobile-originated.pdf', guidedPayload(), { siteImage: null });
