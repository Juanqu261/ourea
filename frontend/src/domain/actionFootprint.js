import { capturedRainwaterVolumeM3 } from './interventionModel.js';
import { numeric } from './numeric.js';

function uniqueCellIds(projects) {
  const ids = new Set();
  for (const project of projects ?? []) {
    const cellId = numeric(project.cell_id);
    if (cellId != null) ids.add(cellId);
  }
  return [...ids];
}

export function actionFootprint({ projects = [], cells, rainMm = 0 } = {}) {
  const cellById = new Map(
    (cells?.features ?? []).map((feature) => [
      numeric(feature.properties?.cell_id),
      feature.properties,
    ]),
  );
  const targetedIds = uniqueCellIds(projects);
  let buildings = 0;
  let highHazard = 0;
  let population = 0;

  for (const cellId of targetedIds) {
    const cell = cellById.get(cellId);
    if (!cell) continue;
    buildings += Math.max(0, numeric(cell.buildings) ?? 0);
    highHazard += Math.max(0, numeric(cell.high_hazard_buildings) ?? 0);
    population += Math.max(0, numeric(cell.population_proxy) ?? 0);
  }

  const families = [...new Set(
    (projects ?? [])
      .map((project) => project.type)
      .filter(Boolean),
  )];

  return {
    planning_cells_targeted: targetedIds.length,
    cadastral_buildings_in_targeted_cells: buildings,
    high_hazard_buildings_in_targeted_cells: highHazard,
    population_proxy_in_targeted_cells: population,
    intervention_families: families,
    rwh_captured_volume_m3: cells
      ? capturedRainwaterVolumeM3(cells, projects, rainMm)
      : 0,
  };
}
