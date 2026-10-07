import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultScenarioFromClimate,
  matchPresetId,
  rainStepsFromClimate,
  scenarioFromPreset,
} from '../src/domain/climateScenarios.js';

const climate = {
  source_name: 'CHIRPS v3.0 Final',
  climatology_period: { label: '1991-2020' },
  scenario_presets: [
    {
      id: 'typical_wet',
      label: 'Typical wet conditions',
      accumulation_window_days: 15,
      precipitation_mm: 80,
      percentile: 75,
      antecedent_window_days: 30,
      antecedent_rainfall_percentile: 0.5,
      climatology_period: '1991-2020',
      source_name: 'CHIRPS v3.0 Final',
    },
    {
      id: 'high_rainfall',
      label: 'High rainfall context',
      accumulation_window_days: 15,
      precipitation_mm: 120,
      percentile: 90,
      antecedent_window_days: 30,
      antecedent_rainfall_percentile: 0.75,
      climatology_period: '1991-2020',
      source_name: 'CHIRPS v3.0 Final',
    },
    {
      id: 'extreme_observed',
      label: 'Extreme observed context',
      accumulation_window_days: 15,
      precipitation_mm: 180,
      percentile: 99,
      antecedent_window_days: 30,
      antecedent_rainfall_percentile: 0.9,
      climatology_period: '1991-2020',
      source_name: 'CHIRPS v3.0 Final',
    },
  ],
};

test('observational presets become planning scenarios without soil-wetness language', () => {
  const typical = defaultScenarioFromClimate(climate, 10);
  assert.equal(typical.presetId, 'typical_wet');
  assert.equal(typical.rainMm, 80);
  assert.equal(typical.antecedentWetness, 0.5);
  assert.equal(typical.climate.sourceName, 'CHIRPS v3.0 Final');
  assert.deepEqual(rainStepsFromClimate(climate), [80, 120, 180]);
  const high = scenarioFromPreset(climate.scenario_presets[1]);
  assert.equal(matchPresetId(climate, high), 'high_rainfall');
  assert.equal(matchPresetId(climate, { rainMm: 99, antecedentWetness: 0.1 }), 'explore');
  assert.ok(!JSON.stringify(climate.scenario_presets).toLowerCase().includes('soil'));
});
