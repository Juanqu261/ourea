import {
  COMMUNITY_COPY,
  COMMUNITY_PRIVACY_WARNING,
  communityRecordKey,
  isDocumentedReview,
  isPartialCommunityRecord,
  normalizeCommunityRecord,
  parseCommunityEvidenceFile,
  UNOBSERVED_COMMUNITY_RECORD,
} from '../config/communityEvidence.js';

function projectKey(project) {
  return `${Number(project.cell_id)}:${project.type}`;
}

function recordAppliesToActivePlan(record, activeKeys) {
  const key = communityRecordKey(record);
  if (activeKeys.has(key)) return true;
  if (record.intervention_type) return false;
  const prefix = `${Number(record.cell_id)}:`;
  return [...activeKeys].some((item) => item.startsWith(prefix));
}

function activatedSafeguards(record) {
  if (!record) return [];
  const flags = [];
  if (record.livelihood_disruption === 'high') flags.push('livelihood_disruption');
  if (record.displacement_risk === 'possible' || record.displacement_risk === 'required') {
    flags.push('displacement_risk');
  }
  if (
    record.accessibility_concern === 'possible'
    || record.accessibility_concern === 'confirmed'
  ) {
    flags.push('accessibility_concern');
  }
  if (record.community_position === 'oppose') flags.push('community_opposition');
  if (record.maintenance_capacity === 'low') flags.push('maintenance_capacity');
  return flags;
}

function mergeRecords(fileRecords, sessionRecords) {
  const byKey = new Map();
  for (const record of fileRecords) {
    byKey.set(communityRecordKey(record), record);
  }
  for (const record of sessionRecords) {
    byKey.set(communityRecordKey(record), record);
  }
  return byKey;
}

function resolveCommunityRecord(project, recordMap) {
  const exact = recordMap.get(projectKey(project));
  if (exact) return exact;
  const cellOnly = recordMap.get(`${Number(project.cell_id)}:`);
  if (cellOnly) return cellOnly;
  return {
    ...UNOBSERVED_COMMUNITY_RECORD,
    cell_id: Number(project.cell_id),
    intervention_type: project.type,
    origin: 'unobserved',
  };
}

function validationLabel(status) {
  if (status === 'requires_deliberation') return COMMUNITY_COPY.requiresDeliberation;
  if (status === 'community_reviewed') return COMMUNITY_COPY.reviewed;
  if (status === 'incomplete') return COMMUNITY_COPY.incompleteStatus;
  if (status === 'invalid') return COMMUNITY_COPY.invalidStatus;
  return COMMUNITY_COPY.technicallyOnly;
}

export function assessCommunitySafeguards({
  projects = [],
  communityFile = null,
  sessionRecords = [],
  catalog = {},
} = {}) {
  const parsed = parseCommunityEvidenceFile(communityFile, catalog);
  const fileRecords = parsed.template || parsed.status === 'invalid' ? [] : parsed.records;
  const normalizedSession = sessionRecords
    .map((item) =>
      normalizeCommunityRecord(item, { fallbackOrigin: 'participatory_session' }),
    )
    .filter(Boolean);
  const recordMap = mergeRecords(fileRecords, normalizedSession);
  const activeKeys = new Set((projects ?? []).map(projectKey));

  const portfolio = (projects ?? []).map((project) => {
    const record = resolveCommunityRecord(project, recordMap);
    const safeguards = activatedSafeguards(record);
    return {
      cell_id: Number(project.cell_id),
      type: project.type,
      record,
      documented: isDocumentedReview(record),
      partial: isPartialCommunityRecord(record),
      safeguards,
    };
  });

  const notAssessed = portfolio.filter((item) => !item.documented && !item.partial);
  const incomplete = portfolio.filter((item) => item.partial);
  const safeguards = [...new Set(portfolio.flatMap((item) => item.safeguards))];
  const unresolvedConcerns = portfolio
    .filter((item) => item.safeguards.length)
    .map((item) => ({
      cell_id: item.cell_id,
      type: item.type,
      safeguards: item.safeguards,
      community_position: item.record.community_position,
      origin: item.record.origin,
    }));

  let validationStatus = 'not_assessed';
  if (parsed.status === 'invalid') {
    validationStatus = 'invalid';
  } else if (!portfolio.length) {
    validationStatus = 'not_assessed';
  } else if (safeguards.length) {
    validationStatus = 'requires_deliberation';
  } else if (portfolio.every((item) => item.documented)) {
    validationStatus = 'community_reviewed';
  } else if (incomplete.length) {
    validationStatus = 'incomplete';
  } else {
    validationStatus = 'not_assessed';
  }

  return {
    file_status: parsed.status,
    file_errors: parsed.errors,
    template_ignored: parsed.template,
    validation_status: validationStatus,
    validation_label: validationLabel(validationStatus),
    project_count: portfolio.length,
    not_assessed_count: notAssessed.length,
    incomplete_count: incomplete.length,
    documented_count: portfolio.filter((item) => item.documented).length,
    not_assessed_projects: notAssessed.map((item) => ({
      cell_id: item.cell_id,
      type: item.type,
    })),
    safeguards_activated: safeguards,
    unresolved_concerns: unresolvedConcerns,
    records: portfolio.map((item) => item.record),
    participatory_records: normalizedSession.filter((record) =>
      recordAppliesToActivePlan(record, activeKeys),
    ),
    session_history: normalizedSession,
    privacy_warning: COMMUNITY_PRIVACY_WARNING,
    guardrail: COMMUNITY_COPY.notAPrediction,
  };
}

export function emptyCommunityAssessment(projects = []) {
  return assessCommunitySafeguards({ projects, communityFile: null, sessionRecords: [] });
}
