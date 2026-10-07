import scientificGuardrails from '../config/scientificGuardrails.json' with { type: 'json' };
import contract from '../config/aiDecisionContract.json' with { type: 'json' };
import { PRIORITY_CARDS } from '../config/uiCopy.js';
import { assessDecisionReadiness } from './decisionReadiness.js';

const SNAPSHOT_GUARDRAILS = [
  scientificGuardrails.items[7],
  scientificGuardrails.items[8],
  scientificGuardrails.items[11],
  scientificGuardrails.items[12],
  scientificGuardrails.items[13],
];

function round1(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(1)) : null;
}

function footprintSummary(footprint) {
  if (!footprint) return null;
  return {
    planning_cells_targeted: Number(footprint.planning_cells_targeted) || 0,
    cadastral_buildings: Number(footprint.cadastral_buildings_in_targeted_cells) || 0,
    high_hazard_buildings: Number(footprint.high_hazard_buildings_in_targeted_cells) || 0,
    population_proxy: Number(footprint.population_proxy_in_targeted_cells) || 0,
    label: 'Targeted planning proxies, not people protected or avoided losses.',
  };
}

function benchmarkSummary(benchmark) {
  if (!benchmark?.strategies) return null;
  const robust = benchmark.strategies.find((item) => item.id === 'ourea_robust');
  const hazard = benchmark.strategies.find((item) => item.id === 'hazard_only');
  const deterministic = benchmark.strategies.find((item) => item.id === 'deterministic_central' || item.id === 'deterministic');
  if (!robust || !hazard || !deterministic) return null;
  return {
    robust_p10: round1(robust.p10),
    hazard_p10: round1(hazard.p10),
    deterministic_p10: round1(deterministic.p10),
    robust_holds_lower_tail: robust.p10 >= hazard.p10 && robust.p10 >= deterministic.p10,
  };
}

function breakageSummary(breakage) {
  if (!breakage) return null;
  const count = breakage.scenarioCombinationsBelowThreshold?.length ?? breakage.breaches?.length ?? 0;
  return {
    combinations_below_threshold: count,
    note: 'Counts are scenario combinations, not spatial grid cells and not a failure forecast.',
  };
}

function costSummary(costing) {
  if (!costing) {
    return { complete: false, confidence: 'pre-feasibility', unpriced: ['missing'] };
  }
  if (!costing.complete || !costing.display?.total) {
    return {
      complete: false,
      confidence: costing.confidence ?? 'pre-feasibility',
      unpriced: costing.unpriced ?? [],
    };
  }
  return {
    complete: true,
    currency: 'USD',
    low: costing.display.total.low,
    base: costing.display.total.base,
    high: costing.display.total.high,
    confidence: costing.confidence ?? 'pre-feasibility',
    main_driver: costing.costDriver ?? null,
    label: 'Pre-feasibility implementation envelope, not an offer, contract or engineering estimate.',
  };
}

function evidenceSummary(evidence) {
  if (!evidence?.layers) {
    return { valid: false, layer_count: 0 };
  }
  return {
    valid: true,
    layer_count: evidence.layers.length,
    statuses: [...new Set(evidence.layers.map((layer) => layer.status).filter(Boolean))],
  };
}

function communitySummary(community) {
  return {
    validation_status: community?.validation_status ?? 'not_assessed',
    not_assessed_count: community?.not_assessed_count ?? 0,
    documented_count: community?.documented_count ?? 0,
    incomplete_count: community?.incomplete_count ?? 0,
    safeguards_activated_count: community?.safeguards_activated?.length ?? 0,
    interpretation: 'not_assessed is not support, opposition or low social risk',
  };
}

export function buildAiDecisionSnapshot({
  language = 'en',
  portfolio = [],
  profileId = 'balanced',
  scenario = null,
  climateContext = null,
  monteCarlo = null,
  metrics = null,
  benchmark = null,
  breakage = null,
  costing = null,
  actionFootprint = null,
  evidence = null,
  communityAssessment = null,
  planAlignment = null,
  recommendationStale = false,
  readiness = null,
} = {}) {
  const projects = (Array.isArray(portfolio) ? portfolio : []).map((item) => ({
    cell_id: Number(item.cell_id),
    type: item.type,
  }));
  const assessed = readiness ?? assessDecisionReadiness({
    portfolio: projects,
    recommendationStale,
    metrics,
    monteCarlo,
    benchmark,
    breakage,
    climateContext,
    costing,
    evidence,
    communityAssessment,
    planAlignment,
    profileId,
    scenario,
  });

  const snapshot = {
    schema_version: contract.schema_version,
    snapshot_id: assessed.deterministic_fingerprint,
    language,
    profile: {
      id: profileId,
      label: PRIORITY_CARDS[profileId]?.name ?? profileId,
    },
    interventions: projects,
    rainfall: {
      preset_id: scenario?.presetId ?? scenario?.preset_id ?? null,
      source_name: climateContext?.source_name ?? null,
      climatology_period: climateContext?.climatology_period?.label ?? null,
      percentile: scenario?.climate?.percentile ?? null,
    },
    uncertainty: monteCarlo
      ? {
          runs: monteCarlo.runs ?? null,
          p10: round1(monteCarlo.p10),
          median: round1(monteCarlo.median),
          p90: round1(monteCarlo.p90),
          downside_retention: monteCarlo.median
            ? Number((monteCarlo.p10 / monteCarlo.median).toFixed(3))
            : null,
          label: 'Planning-benefit proxies under modeled wet futures, not people saved.',
        }
      : null,
    benchmark: benchmarkSummary(benchmark),
    breakage: breakageSummary(breakage),
    cost: costSummary(costing),
    action_footprint: footprintSummary(actionFootprint),
    evidence: evidenceSummary(evidence),
    community: communitySummary(communityAssessment),
    local_alignment: {
      entry_count: planAlignment?.entries?.length ?? 0,
      status: planAlignment?.status ?? null,
      interpretation: 'Documentary alignment, not community endorsement.',
    },
    readiness: {
      status: assessed.status,
      construction_readiness: assessed.construction_readiness,
      next_decision: assessed.next_decision,
      gates: assessed.gates.map((item) => (
        item.status === 'passed'
          ? {
              id: item.id,
              status: item.status,
              label: item.label,
              reason: 'Passed.',
              evidence_required: 'None.',
            }
          : {
              id: item.id,
              status: item.status,
              label: item.label,
              reason: item.reason,
              evidence_required: item.evidence_required,
            }
      )),
    },
    guardrails: SNAPSHOT_GUARDRAILS,
  };

  return Object.freeze(snapshot);
}

export function snapshotByteSize(snapshot) {
  return new TextEncoder().encode(JSON.stringify(snapshot)).length;
}

export const SNAPSHOT_FORBIDDEN_PATTERN = new RegExp([
  '"coordinates"',
  '"geometry"',
  '"lat"',
  '"lng"',
  '"latitude"',
  '"longitude"',
  'FeatureCollection',
  'session_history',
  'participatory_records',
  '"notes"',
  'sk-[A-Za-z0-9]{8,}',
].join('|'), 'i');
