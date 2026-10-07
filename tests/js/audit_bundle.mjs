// Prints the export's audit bundle (frontend/src/cornare/products.js) as JSON. Used by tests/test_ai_audit.py.
import { readFileSync, existsSync } from 'node:fs';
import { analyzeCorridor, bundleDataset } from '../../frontend/src/domain/cornareDecision.js';
import { buildProducts } from '../../frontend/src/cornare/products.js';

const path = (name) => new URL(`../../frontend/public/data/cornare/${name}`, import.meta.url);
const read = (name) => JSON.parse(readFileSync(path(name), 'utf8'));

const analysis = analyzeCorridor(bundleDataset({
  interventions: read('interventions.json'),
  metrics: read('dimension_metrics.json'),
  history: read('adaptation_history.json'),
  parameters: read('decision_model.json'),
  gaps: read('information_gaps.json'),
  mea: read('mea_indicators.json'),
  profiles: read('municipality_profiles.json'),
}));
const engine = { robustness: existsSync(path('robustness.json')) ? read('robustness.json') : null };
console.log(JSON.stringify(buildProducts(analysis, { engine })));
