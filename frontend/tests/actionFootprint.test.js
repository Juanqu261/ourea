import assert from 'node:assert/strict';
import test from 'node:test';
import { actionFootprint } from '../src/domain/actionFootprint.js';

const cells = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        cell_id: 1,
        buildings: 10,
        high_hazard_buildings: 8,
        population_proxy: 40,
        roof_footprint_m2: 1000,
      },
    },
    {
      type: 'Feature',
      properties: {
        cell_id: 2,
        buildings: 5,
        high_hazard_buildings: 4,
        population_proxy: 20,
        roof_footprint_m2: 400,
      },
    },
  ],
};

test('action footprint does not double-count buildings or people in the same cell', () => {
  const one = actionFootprint({
    projects: [{ cell_id: 1, type: 'rwh' }],
    cells,
    rainMm: 100,
  });
  const twoInSameCell = actionFootprint({
    projects: [
      { cell_id: 1, type: 'rwh' },
      { cell_id: 1, type: 'drainage' },
    ],
    cells,
    rainMm: 100,
  });
  assert.equal(one.planning_cells_targeted, 1);
  assert.equal(twoInSameCell.planning_cells_targeted, 1);
  assert.equal(one.cadastral_buildings_in_targeted_cells, 10);
  assert.equal(twoInSameCell.cadastral_buildings_in_targeted_cells, 10);
  assert.equal(one.population_proxy_in_targeted_cells, 40);
  assert.equal(twoInSameCell.population_proxy_in_targeted_cells, 40);
  assert.equal(one.high_hazard_buildings_in_targeted_cells, 8);
  assert.equal(twoInSameCell.high_hazard_buildings_in_targeted_cells, 8);
  assert.deepEqual(twoInSameCell.intervention_families, ['rwh', 'drainage']);
  assert.equal(one.rwh_captured_volume_m3, twoInSameCell.rwh_captured_volume_m3);
});

test('action footprint sums unique cells only', () => {
  const footprint = actionFootprint({
    projects: [
      { cell_id: 1, type: 'rwh' },
      { cell_id: 2, type: 'restoration' },
      { cell_id: 1, type: 'drainage' },
    ],
    cells,
    rainMm: 50,
  });
  assert.equal(footprint.planning_cells_targeted, 2);
  assert.equal(footprint.cadastral_buildings_in_targeted_cells, 15);
  assert.equal(footprint.high_hazard_buildings_in_targeted_cells, 12);
  assert.equal(footprint.population_proxy_in_targeted_cells, 60);
});
