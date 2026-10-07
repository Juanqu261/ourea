import scientificGuardrails from '../config/scientificGuardrails.json' with { type: 'json' };
import nanjingGuardrails from '../config/nanjingScientificGuardrails.json' with { type: 'json' };
import { medellinCase } from '../config/cases/medellinCase.js';
import {
  optionalDataFilesForCase,
  requiredDataFilesForCase,
} from '../config/dataPaths.js';
import { CASE_IDS } from '../config/cases/caseTypes.js';

async function fetchJson(url, signal, { optional = false, optionalParse = 'throw' } = {}) {
  const response = await fetch(url, { signal });
  if (optional && response.status === 404) {
    return optionalParse === 'invalid' ? { __absent: true } : null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
  }

  const body = await response.text();
  try {
    return JSON.parse(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const spaFallback = /^\s*</.test(body);
    if (optional && (optionalParse === 'absent' || spaFallback)) {
      return spaFallback && optionalParse === 'invalid' ? { __absent: true } : null;
    }
    if (optional && optionalParse === 'invalid') {
      return { __invalid: true, error: message };
    }
    throw new Error(`Failed to parse ${url} as JSON: ${message}`);
  }
}

function guardrailsForCase(caseConfig) {
  const base = [...scientificGuardrails.items];
  if (caseConfig.id === CASE_IDS.NANJING) {
    return [...base, ...nanjingGuardrails.items];
  }
  return base;
}

export async function loadOureaData(signal, caseConfig = medellinCase) {
  const requiredFiles = requiredDataFilesForCase(caseConfig);
  const optionalFiles = optionalDataFilesForCase(caseConfig);

  const requiredEntries = await Promise.all(
    Object.entries(requiredFiles).map(async ([key, url]) => [
      key,
      await fetchJson(url, signal, { optional: false }),
    ]),
  );
  const required = Object.fromEntries(requiredEntries);

  let communityEvidence = null;
  if (optionalFiles.communityEvidence) {
    const loaded = await fetchJson(optionalFiles.communityEvidence, signal, {
      optional: true,
      optionalParse: 'invalid',
    });
    communityEvidence = loaded?.__absent ? null : loaded;
  }

  let retrospective = null;
  if (optionalFiles.retrospective) {
    retrospective = await fetchJson(optionalFiles.retrospective, signal, {
      optional: true,
      optionalParse: 'absent',
    });
  }

  let retrospectiveComparison = null;
  if (optionalFiles.retrospectiveComparison) {
    retrospectiveComparison = await fetchJson(optionalFiles.retrospectiveComparison, signal, {
      optional: true,
      optionalParse: 'absent',
    });
  }

  let dataManifest = null;
  if (optionalFiles.dataManifest) {
    dataManifest = await fetchJson(optionalFiles.dataManifest, signal, {
      optional: true,
      optionalParse: 'absent',
    });
  }

  let placeLabels = null;
  if (optionalFiles.placeLabels) {
    placeLabels = await fetchJson(optionalFiles.placeLabels, signal, {
      optional: true,
      optionalParse: 'absent',
    });
  }

  let contextWater = null;
  if (optionalFiles.contextWater) {
    contextWater = await fetchJson(optionalFiles.contextWater, signal, {
      optional: true,
      optionalParse: 'absent',
    });
  }

  let overviewMeta = null;
  if (optionalFiles.overviewMeta) {
    overviewMeta = await fetchJson(optionalFiles.overviewMeta, signal, {
      optional: true,
      optionalParse: 'absent',
    });
  }

  let buildingMassing = null;
  if (optionalFiles.buildingMassing) {
    buildingMassing = await fetchJson(optionalFiles.buildingMassing, signal, {
      optional: true,
      optionalParse: 'absent',
    });
  }

  let buildingMassingMeta = null;
  if (optionalFiles.buildingMassingMeta) {
    buildingMassingMeta = await fetchJson(optionalFiles.buildingMassingMeta, signal, {
      optional: true,
      optionalParse: 'absent',
    });
  }

  return {
    caseId: caseConfig.id,
    caseConfig,
    ...required,
    communityEvidence,
    retrospective,
    retrospectiveComparison,
    dataManifest,
    placeLabels,
    contextWater,
    overviewMeta,
    buildingMassing,
    buildingMassingMeta,
    evidence: {
      ...required.evidence,
      global_guardrails: guardrailsForCase(caseConfig),
      case_role: caseConfig.hierarchyLabel,
      case_id: caseConfig.id,
    },
  };
}
