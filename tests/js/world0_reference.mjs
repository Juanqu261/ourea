// Prints the JS engine's World 0 results as JSON. Used by tests/test_engine_parity.py.
import { readFileSync } from 'node:fs';
import { analyzeCorridor, bundleDataset } from '../../frontend/src/domain/cornareDecision.js';

const read = (name) => JSON.parse(readFileSync(new URL(`../../frontend/public/data/cornare/${name}`, import.meta.url), 'utf8'));

const analysis = analyzeCorridor(bundleDataset({
  interventions: read('interventions.json'),
  metrics: read('dimension_metrics.json'),
  history: read('adaptation_history.json'),
  parameters: read('decision_model.json'),
  gaps: read('information_gaps.json'),
  mea: read('mea_indicators.json'),
  profiles: read('municipality_profiles.json'),
}));

const summary = (candidate) => ({
  ids: candidate.ids,
  cost: candidate.cost,
  objective: candidate.institucional.objective,
});

console.log(JSON.stringify({
  institucional: summary(analysis.portfolio),
  grey: summary(analysis.baselines.grey),
  max_count: summary(analysis.baselines.max_count),
  lenses: Object.fromEntries(Object.entries(analysis.lenses).map(([id, item]) => [id, item.ids])),
  stress: { ...summary(analysis.stress.portfolio), status: analysis.stress.status },
  fingerprint: analysis.fingerprint,
  rejected: analysis.rejected.map(({ id, gap }) => ({ id, gap })),
  measures: analysis.prepared.map((measure) => ({
    id: measure.id,
    candidates: measure.placement.candidates.map((row) => row.municipalityId),
    tie_steps: measure.placement.tieSteps,
    class_score: measure.classScore,
    vuln: measure.vulnTerm,
    rec: measure.recurrence.withheld ? null : measure.recurrence.term,
    cob: measure.cobenefit.term,
    urgency: measure.urgencyTerm,
  })),
}));
