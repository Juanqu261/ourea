import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  COMMUNITY_FIELD_OPTIONS,
  isAllowedCommunityValue,
  isDocumentedReview,
  isPartialCommunityRecord,
  isValidIsoDate,
  normalizeCommunityRecord,
  parseCommunityEvidenceFile,
} from '../src/config/communityEvidence.js';
import {
  assessCommunitySafeguards,
  emptyCommunityAssessment,
} from '../src/domain/communitySafeguards.js';
import { buildDecisionPackage } from '../src/domain/decisionPackage.js';
import { optimizeRobustPortfolio } from '../src/domain/optimizer.js';
import { createScenarioContext } from '../src/domain/scenarioEngine.js';

const buildings = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        objectid: 1,
        cell_id: 1,
        hazard_max: 'Alta',
        slope_deg: 35,
        population_proxy: 10,
        estrato: 1,
      },
      geometry: null,
    },
    {
      type: 'Feature',
      properties: {
        objectid: 2,
        cell_id: 2,
        hazard_max: 'Media',
        slope_deg: 20,
        population_proxy: 5,
        estrato: 2,
      },
      geometry: null,
    },
  ],
};

const cells = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        cell_id: 1,
        buildings: 10,
        stratum1_buildings: 10,
        rwh_opportunity: 1,
        drainage_corridor_proxy: 0.8,
        restoration_opportunity: 0.5,
        roof_footprint_m2: 1000,
        vehicular_access_m: 200,
        pedestrian_access_m: 100,
      },
      geometry: null,
    },
    {
      type: 'Feature',
      properties: {
        cell_id: 2,
        buildings: 5,
        stratum1_buildings: 4,
        rwh_opportunity: 0.4,
        drainage_corridor_proxy: 0.7,
        restoration_opportunity: 0.9,
        roof_footprint_m2: 500,
        vehicular_access_m: 100,
        pedestrian_access_m: 150,
      },
      geometry: null,
    },
  ],
};

test('community evidence allows only documented categorical values', () => {
  for (const [field, options] of Object.entries(COMMUNITY_FIELD_OPTIONS)) {
    for (const option of options) {
      assert.equal(isAllowedCommunityValue(field, option), true);
    }
    assert.equal(isAllowedCommunityValue(field, 'invented'), false);
  }
});

test('absent community file is not assessed rather than support or low risk', () => {
  const assessment = emptyCommunityAssessment([{ cell_id: 1, type: 'rwh' }]);
  assert.equal(assessment.file_status, 'absent');
  assert.equal(assessment.validation_status, 'not_assessed');
  assert.equal(assessment.not_assessed_count, 1);
  assert.equal(assessment.records[0].community_position, 'unknown');
  assert.equal(assessment.records[0].livelihood_disruption, 'unknown');
  assert.equal(assessment.records[0].displacement_risk, 'unknown');
  assert.deepEqual(assessment.safeguards_activated, []);
});

test('shipped community sentinel has no records and stays not assessed', async () => {
  const payload = JSON.parse(
    await readFile(
      fileURLToPath(new URL('../public/data/community_evidence.json', import.meta.url)),
      'utf8',
    ),
  );
  const parsed = parseCommunityEvidenceFile(payload);
  assert.equal(parsed.status, 'absent');
  assert.deepEqual(parsed.records, []);
  const assessment = assessCommunitySafeguards({
    projects: [{ cell_id: 1, type: 'rwh' }],
    communityFile: payload,
  });
  assert.equal(assessment.file_status, 'absent');
  assert.equal(assessment.validation_status, 'not_assessed');
});

test('template community file is ignored as unobserved', () => {
  const assessment = assessCommunitySafeguards({
    projects: [{ cell_id: 1, type: 'rwh' }],
    communityFile: {
      schema: 'ourea-community-evidence',
      schema_version: 1,
      template: true,
      status: 'template-not-observed-data',
      records: [
        {
          cell_id: 1,
          intervention_type: 'rwh',
          consultation_status: 'validated',
          community_position: 'support',
          livelihood_disruption: 'low',
          maintenance_capacity: 'medium',
          displacement_risk: 'none',
          accessibility_concern: 'none',
          evidence_type: 'research',
          source: 'template row',
          as_of: '2026-01-01',
        },
      ],
    },
  });
  assert.equal(assessment.template_ignored, true);
  assert.equal(assessment.validation_status, 'not_assessed');
  assert.equal(assessment.documented_count, 0);
});

test('high livelihood or displacement concern marks requires deliberation', () => {
  const assessment = assessCommunitySafeguards({
    projects: [{ cell_id: 1, type: 'drainage' }],
    sessionRecords: [
      {
        cell_id: 1,
        intervention_type: 'drainage',
        consultation_status: 'in_progress',
        livelihood_disruption: 'high',
        displacement_risk: 'possible',
        origin: 'participatory_session',
      },
    ],
  });
  assert.equal(assessment.validation_status, 'requires_deliberation');
  assert.ok(assessment.safeguards_activated.includes('livelihood_disruption'));
  assert.ok(assessment.safeguards_activated.includes('displacement_risk'));
});

test('community records do not change optimizer selection', () => {
  const context = createScenarioContext(buildings, cells);
  const scenario = { rainMm: 95, antecedentWetness: 0.45, planningYear: 1 };
  const withoutCommunity = optimizeRobustPortfolio({
    context,
    cellsGeoJson: cells,
    scenario,
    budgetCredits: 4,
  });
  const withCommunity = optimizeRobustPortfolio({
    context,
    cellsGeoJson: cells,
    scenario,
    budgetCredits: 4,
  });
  assert.deepEqual(withoutCommunity.plan, withCommunity.plan);
  assert.equal(withoutCommunity.spentCredits, withCommunity.spentCredits);
});

test('decision package exports community safeguards when records are absent', () => {
  const payload = buildDecisionPackage({
    scenario: { rainMm: 95, antecedentWetness: 0.45, planningYear: 1 },
    budgetCredits: 10,
    view: 'none',
    cityLens: 'balanced',
    selectedAiProfileId: 'balanced',
    projects: [],
    metrics: null,
    baseline: null,
    monteCarlo: null,
    frontier: null,
    aiDiagnostics: null,
    alternatives: [],
    stability: null,
    pareto: null,
    summary: {},
    evidence: {},
  });
  assert.equal(payload.community_safeguards.validation_status, 'not_assessed');
  assert.equal(payload.community_safeguards.file_status, 'absent');
  assert.ok(payload.guardrails.some((item) => item.includes('Community evidence')));
});

test('invalid community categories fall back to not assessed / unknown', () => {
  const record = normalizeCommunityRecord({
    cell_id: 2,
    intervention_type: 'rwh',
    consultation_status: 'approved',
    community_position: 'enthusiastic',
    livelihood_disruption: 'extreme',
  });
  assert.equal(record.consultation_status, 'not_assessed');
  assert.equal(record.community_position, 'unknown');
  assert.equal(record.livelihood_disruption, 'unknown');
});

const documented = {
  cell_id: 1,
  intervention_type: 'rwh',
  consultation_status: 'validated',
  community_position: 'support',
  livelihood_disruption: 'low',
  maintenance_capacity: 'medium',
  displacement_risk: 'none',
  accessibility_concern: 'none',
  evidence_type: 'participatory_input',
  source: 'Co-design session notes',
  as_of: '2026-08-01',
  process_reference: 'pilot-protocol-1',
};

test('ISO dates reject impossible calendar values', () => {
  assert.equal(isValidIsoDate('2026-08-01'), true);
  assert.equal(isValidIsoDate('2026-13-01'), false);
  assert.equal(isValidIsoDate('2026-02-30'), false);
  assert.equal(isValidIsoDate('01/08/2026'), false);
});

test('planned consultation is incomplete and never a completed review', () => {
  const assessment = assessCommunitySafeguards({
    projects: [{ cell_id: 1, type: 'rwh' }],
    sessionRecords: [{ ...documented, consultation_status: 'planned' }],
  });
  assert.equal(isPartialCommunityRecord(assessment.records[0]), true);
  assert.equal(isDocumentedReview(assessment.records[0]), false);
  assert.equal(assessment.validation_status, 'incomplete');
  assert.equal(assessment.incomplete_count, 1);
  assert.equal(assessment.documented_count, 0);
});

test('in_progress consultation is incomplete even with complete fields', () => {
  const assessment = assessCommunitySafeguards({
    projects: [{ cell_id: 1, type: 'rwh' }],
    sessionRecords: [{ ...documented, consultation_status: 'in_progress' }],
  });
  assert.equal(assessment.validation_status, 'incomplete');
  assert.equal(isDocumentedReview(assessment.records[0]), false);
});

test('validated records with unknown substantives stay incomplete', () => {
  const assessment = assessCommunitySafeguards({
    projects: [{ cell_id: 1, type: 'rwh' }],
    sessionRecords: [{
      ...documented,
      livelihood_disruption: 'unknown',
      maintenance_capacity: 'unknown',
    }],
  });
  assert.equal(assessment.validation_status, 'incomplete');
});

test('validated records without source, evidence type or as_of stay incomplete', () => {
  const missingSource = assessCommunitySafeguards({
    projects: [{ cell_id: 1, type: 'rwh' }],
    sessionRecords: [{ ...documented, source: null }],
  });
  const missingType = assessCommunitySafeguards({
    projects: [{ cell_id: 1, type: 'rwh' }],
    sessionRecords: [{ ...documented, origin: 'file', evidence_type: 'none' }],
  });
  const missingDate = assessCommunitySafeguards({
    projects: [{ cell_id: 1, type: 'rwh' }],
    sessionRecords: [{ ...documented, as_of: 'not-a-date' }],
  });
  assert.equal(missingSource.validation_status, 'incomplete');
  assert.equal(missingType.validation_status, 'incomplete');
  assert.equal(missingDate.validation_status, 'incomplete');
});

test('only documented validated records can be community reviewed', () => {
  const assessment = assessCommunitySafeguards({
    projects: [{ cell_id: 1, type: 'rwh' }],
    sessionRecords: [documented],
  });
  assert.equal(assessment.validation_status, 'community_reviewed');
  assert.equal(assessment.documented_count, 1);
  assert.equal(assessment.participatory_records.length, 1);
  assert.equal(assessment.participatory_records[0].process_reference, 'pilot-protocol-1');
});

test('documented review with unresolved safeguards requires deliberation', () => {
  const assessment = assessCommunitySafeguards({
    projects: [{ cell_id: 1, type: 'rwh' }],
    sessionRecords: [{ ...documented, livelihood_disruption: 'high' }],
  });
  assert.equal(assessment.validation_status, 'requires_deliberation');
  assert.equal(assessment.documented_count, 1);
});

test('malformed community files are invalid rather than absent', () => {
  const parsed = parseCommunityEvidenceFile({
    __invalid: true,
    error: 'Unexpected token',
  });
  assert.equal(parsed.status, 'invalid');
  const assessment = assessCommunitySafeguards({
    projects: [{ cell_id: 1, type: 'rwh' }],
    communityFile: { __invalid: true, error: 'Unexpected token' },
  });
  assert.equal(assessment.file_status, 'invalid');
  assert.equal(assessment.validation_status, 'invalid');
  assert.notEqual(assessment.file_status, 'absent');
  assert.ok(assessment.file_errors.length > 0);
});

test('wrong schema, unknown cell, unknown type and bad as_of fail strictly', () => {
  const catalog = { cellIds: new Set([1, 2]) };
  const schema = parseCommunityEvidenceFile({ schema: 'other', schema_version: 1, records: [] });
  const version = parseCommunityEvidenceFile({
    schema: 'ourea-community-evidence',
    schema_version: 2,
    records: [],
  });
  const unknownCell = parseCommunityEvidenceFile({
    schema: 'ourea-community-evidence',
    schema_version: 1,
    records: [{ cell_id: 99, intervention_type: 'rwh' }],
  }, catalog);
  const unknownType = parseCommunityEvidenceFile({
    schema: 'ourea-community-evidence',
    schema_version: 1,
    records: [{ cell_id: 1, intervention_type: 'wall' }],
  }, catalog);
  const badDate = parseCommunityEvidenceFile({
    schema: 'ourea-community-evidence',
    schema_version: 1,
    records: [{ cell_id: 1, intervention_type: 'rwh', as_of: '2026-13-40' }],
  }, catalog);
  assert.equal(schema.status, 'invalid');
  assert.equal(version.status, 'invalid');
  assert.equal(unknownCell.status, 'invalid');
  assert.equal(unknownType.status, 'invalid');
  assert.equal(badDate.status, 'invalid');
});

test('participatory export keeps only active-plan records and separate session history', () => {
  const assessment = assessCommunitySafeguards({
    projects: [{ cell_id: 1, type: 'rwh' }],
    sessionRecords: [
      documented,
      {
        cell_id: 2,
        intervention_type: 'drainage',
        consultation_status: 'in_progress',
        origin: 'participatory_session',
      },
    ],
  });
  assert.equal(assessment.participatory_records.length, 1);
  assert.equal(assessment.participatory_records[0].cell_id, 1);
  assert.equal(assessment.session_history.length, 2);
  const payload = buildDecisionPackage({
    scenario: { rainMm: 95, antecedentWetness: 0.45, planningYear: 1 },
    budgetCredits: 10,
    view: 'user',
    cityLens: 'balanced',
    selectedAiProfileId: 'balanced',
    projects: [{ cell_id: 1, type: 'rwh' }],
    metrics: null,
    baseline: null,
    monteCarlo: null,
    frontier: null,
    aiDiagnostics: null,
    alternatives: [],
    stability: null,
    pareto: null,
    summary: {},
    evidence: {},
    community: assessment,
  });
  assert.equal(payload.community_safeguards.participatory_records.length, 1);
  assert.equal(payload.community_safeguards.session_history.length, 2);
  assert.match(payload.community_safeguards.privacy_warning, /personal data/i);
  assert.match(payload.scenario.role, /observed-or-explored-rainfall-context/);
});
