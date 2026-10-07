import { mkdirSync, writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { analyzeCorridor, bundleDataset } from '../src/domain/cornareDecision.js';
import { BRIEF_MAP_FILES, renderBriefMap } from '../src/cornare/briefMap.js';
import { composeDecisionBrief } from '../src/cornare/decisionBrief.js';

const read = (name) => JSON.parse(readFileSync(new URL(`../public/data/cornare/${name}`, import.meta.url), 'utf8'));
const analysis = analyzeCorridor(bundleDataset({
  interventions: read('interventions.json'),
  metrics: read('dimension_metrics.json'),
  history: read('adaptation_history.json'),
  parameters: read('decision_model.json'),
  gaps: read('information_gaps.json'),
  mea: read('mea_indicators.json'),
  profiles: read('municipality_profiles.json'),
}));
const layers = {};
BRIEF_MAP_FILES.forEach((file) => {
  layers[file] = read(file);
});
const map = renderBriefMap(layers);
const pdf = await composeDecisionBrief(analysis, new Date('2026-10-07T12:00:00'), { map });
const bytes = new Uint8Array(await pdf.toBlob().arrayBuffer());
mkdirSync(new URL('../test-results/brief/', import.meta.url), { recursive: true });
const target = new URL('../test-results/brief/ourea-cornare-decision-brief.pdf', import.meta.url);
writeFileSync(target, bytes);
console.log(`${bytes.length} ${target.pathname}`);
