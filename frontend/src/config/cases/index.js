import { CASE_IDS } from './caseTypes.js';
import { medellinCase } from './medellinCase.js';
import { nanjingCase } from './nanjingCase.js';

const CASES = Object.freeze({
  [CASE_IDS.MEDELLIN]: medellinCase,
  [CASE_IDS.NANJING]: nanjingCase,
});

export function listCases() {
  return Object.freeze([medellinCase, nanjingCase]);
}

export function getCase(caseId) {
  const resolved = CASES[caseId] ?? null;
  if (!resolved) {
    throw new Error(`Unknown Ourea case id: ${caseId}`);
  }
  return resolved;
}

export function isPrimaryCase(caseConfig) {
  return caseConfig?.caseType === medellinCase.caseType;
}

export function caseObjectiveProfiles(caseConfig) {
  if (caseConfig?.objectiveProfiles) return caseConfig.objectiveProfiles;
  return null;
}

export function caseSupportsFeature(caseConfig, featureId) {
  return !(caseConfig?.unsupportedFeatures ?? []).includes(featureId);
}

export { CASE_IDS, medellinCase, nanjingCase };
