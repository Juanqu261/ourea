export const COMMUNITY_SCHEMA = 'ourea-community-evidence';
export const COMMUNITY_SCHEMA_VERSION = 1;
export const INTERVENTION_TYPES = Object.freeze(['rwh', 'drainage', 'restoration']);
export const SUBSTANTIVE_FIELDS = Object.freeze([
  'community_position',
  'livelihood_disruption',
  'maintenance_capacity',
  'displacement_risk',
  'accessibility_concern',
]);

export const CONSULTATION_STATUS = Object.freeze([
  'not_assessed',
  'planned',
  'in_progress',
  'validated',
]);

export const COMMUNITY_POSITION = Object.freeze([
  'unknown',
  'support',
  'mixed',
  'oppose',
]);

export const IMPACT_LEVEL = Object.freeze([
  'unknown',
  'low',
  'medium',
  'high',
]);

export const DISPLACEMENT_RISK = Object.freeze([
  'unknown',
  'none',
  'possible',
  'required',
]);

export const ACCESSIBILITY_CONCERN = Object.freeze([
  'unknown',
  'none',
  'possible',
  'confirmed',
]);

export const EVIDENCE_TYPE = Object.freeze([
  'none',
  'participatory_input',
  'official_record',
  'field_observation',
  'research',
]);

export const COMMUNITY_FIELD_OPTIONS = Object.freeze({
  consultation_status: CONSULTATION_STATUS,
  community_position: COMMUNITY_POSITION,
  livelihood_disruption: IMPACT_LEVEL,
  maintenance_capacity: IMPACT_LEVEL,
  displacement_risk: DISPLACEMENT_RISK,
  accessibility_concern: ACCESSIBILITY_CONCERN,
  evidence_type: EVIDENCE_TYPE,
});

export const UNOBSERVED_COMMUNITY_RECORD = Object.freeze({
  consultation_status: 'not_assessed',
  community_position: 'unknown',
  livelihood_disruption: 'unknown',
  maintenance_capacity: 'unknown',
  displacement_risk: 'unknown',
  accessibility_concern: 'unknown',
  evidence_type: 'none',
  source: null,
  as_of: null,
  notes: null,
  process_reference: null,
});

export const COMMUNITY_COPY = Object.freeze({
  title: 'Community evidence & safeguards',
  heading: 'Technically robust does not mean community-validated.',
  incomplete:
    'No community review is asserted for these projects. Use this section to record evidence from a documented deliberation.',
  notAPrediction:
    'These records are evidence and safeguards. They are not a prediction of community acceptance.',
  participatoryLabel: 'Participatory scenario input',
  participatoryHint:
    'Values entered here are session notes from co-design, not official observations unless a source is attached.',
  missingFile:
    'This demonstration starts with no preloaded community records. Every selected project is explicitly marked not assessed.',
  invalidFile:
    'The community-evidence file is invalid. It is not treated as absent, support, or low risk.',
  requiresDeliberation: 'Requires deliberation',
  technicallyOnly: 'Technically evaluated only',
  notAssessed: 'Not assessed',
  incompleteStatus: 'Incomplete community evidence',
  reviewed: 'Community review recorded',
  invalidStatus: 'Invalid community evidence file',
  privacy:
    'Do not record names, phone numbers, identity documents, exact addresses or other personal data.',
});

export const COMMUNITY_PRIVACY_WARNING = COMMUNITY_COPY.privacy;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function communityRecordKey(record) {
  const cellId = Number(record?.cell_id);
  const type = String(record?.intervention_type ?? '');
  return `${cellId}:${type}`;
}

export function isAllowedCommunityValue(field, value) {
  const options = COMMUNITY_FIELD_OPTIONS[field];
  return Boolean(options?.includes(value));
}

export function isValidIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  );
}

export function isDocumentedReview(record) {
  if (!record || record.consultation_status !== 'validated') return false;
  if (!record.evidence_type || record.evidence_type === 'none') return false;
  if (!record.source) return false;
  if (!isValidIsoDate(record.as_of)) return false;
  return SUBSTANTIVE_FIELDS.every((field) => record[field] && record[field] !== 'unknown');
}

export function isPartialCommunityRecord(record) {
  if (!record) return false;
  if (record.consultation_status === 'planned' || record.consultation_status === 'in_progress') {
    return true;
  }
  return record.consultation_status === 'validated' && !isDocumentedReview(record);
}

function collectErrors(payload, catalog) {
  const errors = [];
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
    errors.push('payload must be a JSON object');
    return errors;
  }
  if (payload.schema !== COMMUNITY_SCHEMA) {
    errors.push(`schema must be ${COMMUNITY_SCHEMA}`);
  }
  if (Number(payload.schema_version) !== COMMUNITY_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${COMMUNITY_SCHEMA_VERSION}`);
  }
  if (payload.status != null && !['loaded', 'absent', 'template-not-observed-data'].includes(payload.status)) {
    errors.push('status is not an allowed community-evidence status');
  }
  if (payload.records != null && !Array.isArray(payload.records)) {
    errors.push('records must be an array');
  }
  const records = Array.isArray(payload.records) ? payload.records : [];
  const knownCells = catalog?.cellIds;
  records.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      errors.push(`record ${index} is not an object`);
      return;
    }
    if (!Number.isInteger(Number(item.cell_id))) {
      errors.push(`record ${index} cell_id must be an integer`);
    } else if (knownCells && !knownCells.has(Number(item.cell_id))) {
      errors.push(`record ${index} cell_id ${item.cell_id} is not a known planning cell`);
    }
    if (
      item.intervention_type != null
      && item.intervention_type !== ''
      && !INTERVENTION_TYPES.includes(item.intervention_type)
    ) {
      errors.push(`record ${index} intervention_type is not in the intervention catalog`);
    }
    for (const field of Object.keys(COMMUNITY_FIELD_OPTIONS)) {
      if (item[field] != null && !isAllowedCommunityValue(field, item[field])) {
        errors.push(`record ${index} has an invalid ${field}`);
      }
    }
    if (item.as_of != null && item.as_of !== '' && !isValidIsoDate(item.as_of)) {
      errors.push(`record ${index} as_of must be an ISO date YYYY-MM-DD`);
    }
  });
  return errors;
}

export function normalizeCommunityRecord(raw, { fallbackOrigin = 'unobserved' } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const cellId = Number(raw.cell_id);
  if (!Number.isInteger(cellId)) return null;

  const interventionType =
    raw.intervention_type == null || raw.intervention_type === ''
      ? null
      : String(raw.intervention_type);

  const record = {
    cell_id: cellId,
    intervention_type: interventionType,
    consultation_status: isAllowedCommunityValue(
      'consultation_status',
      raw.consultation_status,
    )
      ? raw.consultation_status
      : UNOBSERVED_COMMUNITY_RECORD.consultation_status,
    community_position: isAllowedCommunityValue(
      'community_position',
      raw.community_position,
    )
      ? raw.community_position
      : UNOBSERVED_COMMUNITY_RECORD.community_position,
    livelihood_disruption: isAllowedCommunityValue(
      'livelihood_disruption',
      raw.livelihood_disruption,
    )
      ? raw.livelihood_disruption
      : UNOBSERVED_COMMUNITY_RECORD.livelihood_disruption,
    maintenance_capacity: isAllowedCommunityValue(
      'maintenance_capacity',
      raw.maintenance_capacity,
    )
      ? raw.maintenance_capacity
      : UNOBSERVED_COMMUNITY_RECORD.maintenance_capacity,
    displacement_risk: isAllowedCommunityValue(
      'displacement_risk',
      raw.displacement_risk,
    )
      ? raw.displacement_risk
      : UNOBSERVED_COMMUNITY_RECORD.displacement_risk,
    accessibility_concern: isAllowedCommunityValue(
      'accessibility_concern',
      raw.accessibility_concern,
    )
      ? raw.accessibility_concern
      : UNOBSERVED_COMMUNITY_RECORD.accessibility_concern,
    evidence_type: isAllowedCommunityValue('evidence_type', raw.evidence_type)
      ? raw.evidence_type
      : UNOBSERVED_COMMUNITY_RECORD.evidence_type,
    source: raw.source ? String(raw.source) : null,
    as_of: isValidIsoDate(raw.as_of) ? raw.as_of : null,
    notes: raw.notes ? String(raw.notes) : null,
    process_reference: raw.process_reference ? String(raw.process_reference) : null,
    origin: raw.origin ?? fallbackOrigin,
  };

  if (record.origin === 'participatory_session' && record.evidence_type === 'none') {
    record.evidence_type = 'participatory_input';
  }

  return record;
}

export function parseCommunityEvidenceFile(payload, catalog = {}) {
  if (payload == null || payload.__absent) {
    return {
      schema: COMMUNITY_SCHEMA,
      schema_version: COMMUNITY_SCHEMA_VERSION,
      status: 'absent',
      template: false,
      records: [],
      errors: [],
    };
  }

  if (payload.__invalid) {
    return {
      schema: COMMUNITY_SCHEMA,
      schema_version: COMMUNITY_SCHEMA_VERSION,
      status: 'invalid',
      template: false,
      records: [],
      errors: [payload.error ?? 'malformed community evidence JSON'],
    };
  }

  const errors = collectErrors(payload, catalog);
  if (errors.length) {
    return {
      schema: payload?.schema ?? COMMUNITY_SCHEMA,
      schema_version: Number(payload?.schema_version) || 0,
      status: 'invalid',
      template: false,
      records: [],
      errors,
    };
  }

  const records = (payload.records ?? [])
    .map((item) => normalizeCommunityRecord(item, { fallbackOrigin: 'file' }))
    .filter(Boolean);

  return {
    schema: COMMUNITY_SCHEMA,
    schema_version: COMMUNITY_SCHEMA_VERSION,
    status: payload.template ? 'template-not-observed-data' : (payload.status ?? 'loaded'),
    template: Boolean(payload.template),
    note: payload.note ?? null,
    records,
    errors: [],
  };
}
