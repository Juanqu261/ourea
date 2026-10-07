import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../public/data/cornare');
const read = (name) => JSON.parse(readFileSync(join(root, name), 'utf8'));
const municipalities = new Set(['rionegro', 'guarne', 'marinilla']);
const errors = [];

function require(condition, message) {
  if (!condition) errors.push(message);
}

const interventions = read('interventions.json');
const metrics = read('dimension_metrics.json');
const history = read('adaptation_history.json');
const parameters = read('decision_model.json');
const gaps = read('information_gaps.json');
const ids = interventions.interventions.map((item) => item.id);
require(new Set(ids).size === ids.length, 'duplicate intervention ids');
require(parameters.budget_million_cop === 5000, 'budget');
const total = interventions.interventions.reduce((sum, item) => sum + item.cost_million_cop, 0);
require(total === 18900, `catalogue total ${total}`);
interventions.interventions.forEach((item) => {
  require(item.cost_million_cop > 0, item.id);
  require(!history.records.some((record) => record.matched_intervention_id === item.id && record.municipality_id && !municipalities.has(record.municipality_id)), item.id);
});
metrics.metrics.forEach((row) => {
  if (row.municipality_id) require(municipalities.has(row.municipality_id), row.id);
  for (const key of ['value', 'value_min', 'value_max']) {
    if (row[key] != null) require(row[key] >= 0 && row[key] <= 1, `${row.id} ${key}`);
  }
});
require(history.hazard_label_is_not_vulnerability_index === true, 'hazard label');
require(parameters.excluded_from_score.some((item) => item.includes('mitigation')), 'mitigation exclusion');
require(gaps.gaps.length > 0, 'gaps');
history.records.forEach((record) => require(municipalities.has(record.municipality_id), record.municipality_name));

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('CORNARE frontend data validated');
