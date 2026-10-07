import { assetUrl } from './assetUrl.js';
import { medellinCase } from './cases/medellinCase.js';

/** @deprecated Prefer case.dataPaths — kept for Medellín-default tests. */
export const REQUIRED_DATA_FILES = Object.freeze({
  buildings: medellinCase.dataPaths.buildings,
  roads: medellinCase.dataPaths.roads,
  hazard: medellinCase.dataPaths.hazard,
  cells: medellinCase.dataPaths.cells,
  summary: medellinCase.dataPaths.summary,
  screening: medellinCase.dataPaths.screening,
  evidence: medellinCase.dataPaths.evidence,
  climateContext: medellinCase.dataPaths.climateContext,
  planAlignment: medellinCase.dataPaths.planAlignment,
  costContext: medellinCase.dataPaths.costContext,
});

export const OPTIONAL_DATA_FILES = Object.freeze({
  communityEvidence: medellinCase.dataPaths.communityEvidence,
});

export function requiredDataFilesForCase(caseConfig) {
  const paths = caseConfig.dataPaths;
  return Object.freeze({
    buildings: paths.buildings,
    roads: paths.roads,
    hazard: paths.hazard,
    cells: paths.cells,
    summary: paths.summary,
    screening: paths.screening,
    evidence: paths.evidence,
    climateContext: paths.climateContext,
    planAlignment: paths.planAlignment,
    costContext: paths.costContext,
  });
}

export function optionalDataFilesForCase(caseConfig) {
  const out = {};
  if (caseConfig.dataPaths.communityEvidence) {
    out.communityEvidence = caseConfig.dataPaths.communityEvidence;
  }
  if (caseConfig.dataPaths.retrospective) {
    out.retrospective = caseConfig.dataPaths.retrospective;
  }
  if (caseConfig.dataPaths.retrospectiveComparison) {
    out.retrospectiveComparison = caseConfig.dataPaths.retrospectiveComparison;
  }
  if (caseConfig.dataPaths.dataManifest) {
    out.dataManifest = caseConfig.dataPaths.dataManifest;
  }
  if (caseConfig.dataPaths.placeLabels) {
    out.placeLabels = caseConfig.dataPaths.placeLabels;
  }
  if (caseConfig.dataPaths.contextWater) {
    out.contextWater = caseConfig.dataPaths.contextWater;
  }
  if (caseConfig.dataPaths.overviewMeta) {
    out.overviewMeta = caseConfig.dataPaths.overviewMeta;
  }
  if (caseConfig.dataPaths.buildingMassing) {
    out.buildingMassing = caseConfig.dataPaths.buildingMassing;
  }
  if (caseConfig.dataPaths.buildingMassingMeta) {
    out.buildingMassingMeta = caseConfig.dataPaths.buildingMassingMeta;
  }
  return Object.freeze(out);
}

export { assetUrl };
