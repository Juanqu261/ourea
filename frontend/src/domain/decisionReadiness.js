import { PRIORITY_CARDS } from '../config/uiCopy.js';
import { decisionFingerprint } from './fingerprint.js';

export const READINESS_SCHEMA_VERSION = 1;
export const CONSTRUCTION_READINESS = 'not_assessed_by_ourea';

export const READINESS_STATUS = Object.freeze({
  READY: 'ready_for_field_validation',
  CONDITIONS: 'proceed_with_conditions',
  EVIDENCE: 'needs_evidence_review',
});

const EXPECTED_PENDING = new Set(['community_review', 'drainage_survey', 'thirty_percent_design']);

function gate({ id, status, label, reason, evidence_required }) {
  return { id, status, label, reason, evidence_required };
}

function hasFinite(value) {
  return Number.isFinite(Number(value));
}

function evidenceBlocked(evidence) {
  if (!evidence || typeof evidence !== 'object') return true;
  if (evidence.invalid === true) return true;
  if (!evidence.schema || !Array.isArray(evidence.layers) || evidence.layers.length === 0) {
    return true;
  }
  return false;
}

function communityGate(community) {
  const status = community?.validation_status ?? 'not_assessed';
  if (status === 'invalid' || community?.file_status === 'invalid') {
    return gate({
      id: 'community_review',
      status: 'blocked',
      label: 'Community review',
      reason: 'The community-evidence file is invalid. Treat this as a blocked evidence gate, not as opposition or support.',
      evidence_required: 'Replace the malformed community-evidence file with a valid schema before advancing.',
    });
  }
  if (status === 'requires_deliberation') {
    return gate({
      id: 'community_review',
      status: 'conditional',
      label: 'Community review',
      reason: 'Recorded community evidence requires deliberation before this package can be treated as socially ready.',
      evidence_required: 'Complete community deliberation on the flagged cells before a construction decision.',
    });
  }
  if (status === 'incomplete') {
    return gate({
      id: 'community_review',
      status: 'conditional',
      label: 'Community review',
      reason: 'Community review is incomplete. This is not support, opposition or low social risk.',
      evidence_required: 'Finish the documented community-review fields for every selected intervention.',
    });
  }
  if (status === 'community_reviewed') {
    return gate({
      id: 'community_review',
      status: 'passed',
      label: 'Community review',
      reason: 'Documented community review has been recorded for the selected interventions.',
      evidence_required: 'Keep the review available for the decision meeting.',
    });
  }
  return gate({
    id: 'community_review',
    status: 'pending',
    label: 'Community review',
    reason: 'Community review is not assessed. That is not support, opposition or low social risk.',
    evidence_required: 'Record community evidence during field validation before construction approval.',
  });
}

function nextDecision(status) {
  if (status === READINESS_STATUS.EVIDENCE) {
    return 'Do not advance this package until blocked evidence gates are repaired. Ourea’s deterministic analysis remains available.';
  }
  if (status === READINESS_STATUS.CONDITIONS) {
    return 'Resolve the listed conditions during field validation and deliberation, then return with a bill of quantities before construction approval.';
  }
  return 'Fund site validation and 30% design, then return with a bill of quantities before construction approval.';
}

function gateById(gates, id) {
  return (gates ?? []).find((item) => item.id === id) ?? null;
}

function dimensionStatus(gate, passedLabel, pendingLabel, blockedLabel) {
  if (!gate) return pendingLabel;
  if (gate.status === 'blocked') return blockedLabel ?? 'Blocked';
  if (gate.status === 'passed') return passedLabel;
  if (gate.status === 'conditional') return 'Conditional';
  return pendingLabel;
}

export function feasibilityMatrix(gates = []) {
  const drainage = gateById(gates, 'drainage_survey');
  const envelope = gateById(gates, 'usd_envelope');
  const community = gateById(gates, 'community_review');
  const alignment = gateById(gates, 'local_alignment');
  const design = gateById(gates, 'thirty_percent_design');
  const evidence = gateById(gates, 'evidence_registry');
  return [
    {
      dimension: 'Technical',
      status: dimensionStatus(drainage, 'Screening only', 'Conditional', 'Blocked'),
      evidence: drainage?.reason ?? 'Terrain and building model only.',
      nextGate: drainage?.evidence_required ?? 'Field and hydraulic survey',
      owner: 'Engineering team',
      gate_id: 'drainage_survey',
    },
    {
      dimension: 'Financial',
      status: envelope?.status === 'passed' ? 'Pre-feasibility' : dimensionStatus(envelope, 'Pre-feasibility', 'Incomplete', 'Not estimable'),
      evidence: envelope?.reason ?? 'Source-backed envelope pending.',
      nextGate: envelope?.evidence_required ?? 'BOQ and comparable bids',
      owner: 'Ourea team',
      gate_id: 'usd_envelope',
    },
    {
      dimension: 'Social',
      status: dimensionStatus(community, 'Recorded', 'Not assessed', 'Blocked'),
      evidence: community?.reason ?? 'No completed community review.',
      nextGate: community?.evidence_required ?? 'Co-design',
      owner: 'Community representatives',
      gate_id: 'community_review',
    },
    {
      dimension: 'Institutional',
      status: dimensionStatus(alignment, 'Documentary alignment', 'Not documented', 'Blocked'),
      evidence: alignment?.reason ?? 'Comuna 8 references pending.',
      nextGate: alignment?.evidence_required ?? 'Municipal sponsor',
      owner: 'Municipal planning',
      gate_id: 'local_alignment',
    },
    {
      dimension: 'Operational',
      status: dimensionStatus(design, 'Design ready', 'Conditional', 'Blocked'),
      evidence: design?.reason ?? 'Intervention logic only.',
      nextGate: design?.evidence_required ?? 'Maintenance owner and 30% design',
      owner: 'Engineering team',
      gate_id: 'thirty_percent_design',
    },
    {
      dimension: 'Environmental',
      status: evidence?.status === 'passed' ? 'Screening only' : dimensionStatus(evidence, 'Screening only', 'Incomplete', 'Blocked'),
      evidence: evidence?.reason ?? 'Existing evidence layers only.',
      nextGate: evidence?.evidence_required ?? 'Site assessment',
      owner: 'Municipal planning',
      gate_id: 'evidence_registry',
    },
  ];
}

function rollup(gates) {
  if (gates.some((item) => item.status === 'blocked')) return READINESS_STATUS.EVIDENCE;
  const extra = gates.filter((item) => {
    if (item.status === 'passed') return false;
    if (item.status === 'pending' && EXPECTED_PENDING.has(item.id)) return false;
    return item.status === 'conditional' || item.status === 'pending';
  });
  if (extra.length) return READINESS_STATUS.CONDITIONS;
  return READINESS_STATUS.READY;
}

export function assessDecisionReadiness({
  portfolio = [],
  recommendationStale = false,
  metrics = null,
  monteCarlo = null,
  benchmark = null,
  breakage = null,
  climateContext = null,
  costing = null,
  evidence = null,
  communityAssessment = null,
  planAlignment = null,
  profileId = null,
  scenario = null,
} = {}) {
  const projects = Array.isArray(portfolio) ? portfolio : [];
  const gates = [];

  if (!projects.length) {
    gates.push(gate({
      id: 'portfolio',
      status: 'blocked',
      label: 'Active portfolio',
      reason: 'No interventions are in the active portfolio.',
      evidence_required: 'Select or generate a portfolio before requesting a decision review.',
    }));
  } else if (recommendationStale) {
    gates.push(gate({
      id: 'portfolio',
      status: 'blocked',
      label: 'Active portfolio',
      reason: 'The recommendation is stale after a scenario or priority change.',
      evidence_required: 'Refresh the recommendation before using it in a decision meeting.',
    }));
  } else {
    gates.push(gate({
      id: 'portfolio',
      status: 'passed',
      label: 'Active portfolio',
      reason: 'A current portfolio is available for comparison.',
      evidence_required: 'Keep the same portfolio if the meeting is about this recommendation.',
    }));
  }

  const hasUncertainty = Boolean(
    metrics
    && monteCarlo
    && hasFinite(monteCarlo.p10)
    && hasFinite(monteCarlo.median)
    && hasFinite(monteCarlo.p90),
  );
  gates.push(hasUncertainty
    ? gate({
        id: 'uncertainty',
        status: 'passed',
        label: 'Uncertainty distribution',
        reason: 'P10, median, P90 and downside retention are available for this portfolio.',
        evidence_required: 'Read the lower tail as a planning proxy, not as people protected.',
      })
    : gate({
        id: 'uncertainty',
        status: 'blocked',
        label: 'Uncertainty distribution',
        reason: 'Metrics or the uncertainty distribution are missing.',
        evidence_required: 'Recompute the portfolio evaluation before synthesizing a review.',
      }));

  gates.push(benchmark && breakage
    ? gate({
        id: 'benchmark',
        status: 'passed',
        label: 'Benchmark and breakage',
        reason: 'Hazard-only, one-scenario and robust comparisons are available, with breakage diagnostics.',
        evidence_required: 'Use these comparisons as decision context, not as a forecast of failure.',
      })
    : gate({
        id: 'benchmark',
        status: 'pending',
        label: 'Benchmark and breakage',
        reason: 'Benchmark or breakage diagnostics have not been computed for this portfolio.',
        evidence_required: 'Run advanced analysis so the meeting can see what would change the recommendation.',
      }));

  gates.push(climateContext?.source_name
    ? gate({
        id: 'climate',
        status: 'passed',
        label: 'Climate context',
        reason: 'An observational rainfall context is available to anchor the scenario.',
        evidence_required: 'Keep the rainfall context explicit; it is not a real-time forecast.',
      })
    : gate({
        id: 'climate',
        status: 'blocked',
        label: 'Climate context',
        reason: 'Climate context is missing.',
        evidence_required: 'Restore the published climate-context file before synthesizing a review.',
      }));

  if (!costing || costing.complete === false || !costing.display?.total) {
    gates.push(gate({
      id: 'usd_envelope',
      status: 'blocked',
      label: 'US$ implementation envelope',
      reason: costing?.unpriced?.length
        ? `No complete envelope: unpriced items are ${costing.unpriced.join(', ')}.`
        : 'A pre-feasibility US$ envelope is not available.',
      evidence_required: 'Every selected intervention needs an estimable cost scenario before quoting a total.',
    }));
  } else {
    gates.push(gate({
      id: 'usd_envelope',
      status: 'passed',
      label: 'US$ implementation envelope',
      reason: `A pre-feasibility envelope is available at ${costing.confidence ?? 'pre-feasibility'} confidence.`,
      evidence_required: 'Do not treat the envelope as an offer, contract or engineering estimate.',
    }));
  }

  gates.push(evidenceBlocked(evidence)
    ? gate({
        id: 'evidence_registry',
        status: 'blocked',
        label: 'Evidence registry',
        reason: 'The evidence registry is missing, empty or invalid.',
        evidence_required: 'Repair the evidence registry before using this package in a decision meeting.',
      })
    : gate({
        id: 'evidence_registry',
        status: 'passed',
        label: 'Evidence registry',
        reason: 'A versioned evidence registry is available.',
        evidence_required: 'Keep layer confidence visible beside each figure.',
      }));

  gates.push(communityGate(communityAssessment));

  const alignmentEntries = planAlignment?.entries ?? [];
  gates.push(alignmentEntries.length
    ? gate({
        id: 'local_alignment',
        status: 'passed',
        label: 'Local documentary alignment',
        reason: 'Published local planning references exist for the intervention families. This is not community endorsement.',
        evidence_required: 'Keep documentary alignment separate from community review.',
      })
    : gate({
        id: 'local_alignment',
        status: 'pending',
        label: 'Local documentary alignment',
        reason: 'Local documentary alignment is not available.',
        evidence_required: 'Attach published local planning references before treating alignment as documented.',
      }));

  const hasDrainage = projects.some((item) => item.type === 'drainage');
  gates.push(hasDrainage
    ? gate({
        id: 'drainage_survey',
        status: 'pending',
        label: 'Drainage survey',
        reason: 'Corridor length is a 40/60/80 m pre-feasibility scenario, not a surveyed alignment.',
        evidence_required: 'Survey drainage length to convert the envelope into a bill of quantities.',
      })
    : gate({
        id: 'drainage_survey',
        status: 'passed',
        label: 'Drainage survey',
        reason: 'No drainage corridor is in the active portfolio.',
        evidence_required: 'Reassess if a drainage intervention is later added.',
      }));

  const restoration = (costing?.lines ?? []).find((line) => line.type === 'restoration');
  if (restoration) {
    const tier = String(restoration.evidenceTier ?? '').toLowerCase();
    gates.push(tier.includes('low')
      ? gate({
          id: 'restoration_confidence',
          status: 'conditional',
          label: 'Restoration cost confidence',
          reason: 'Restoration is a project-scale package with low evidence confidence because installed area is unknown.',
          evidence_required: 'Do not convert this package into a USD/m² rate. Confirm scope during site validation.',
        })
      : gate({
          id: 'restoration_confidence',
          status: 'passed',
          label: 'Restoration cost confidence',
          reason: 'Restoration is included as a project-scale scenario, not a unit area rate.',
          evidence_required: 'Keep the package-scale warning beside the figure.',
        }));
  }

  gates.push(gate({
    id: 'thirty_percent_design',
    status: 'pending',
    label: '30% design',
    reason: 'Ourea does not assess construction readiness. A 30% design is required before a construction decision.',
    evidence_required: 'Commission 30% design after site validation and community review.',
  }));

  const status = rollup(gates);
  const fingerprint = decisionFingerprint({
    schema_version: READINESS_SCHEMA_VERSION,
    portfolio: projects.map((item) => ({ cell_id: Number(item.cell_id), type: item.type })),
    recommendationStale: Boolean(recommendationStale),
    profileId: profileId ?? null,
    scenario: scenario
      ? {
          presetId: scenario.presetId ?? scenario.preset_id ?? null,
          rainMm: scenario.rainMm ?? scenario.rain_mm ?? null,
          planningYear: scenario.planningYear ?? scenario.planning_year ?? null,
          antecedentWetness: scenario.antecedentWetness ?? scenario.antecedent_rainfall_percentile ?? null,
        }
      : null,
    cost: costing?.display?.total ?? { unpriced: costing?.unpriced ?? ['missing'] },
    evidence: evidenceBlocked(evidence) ? 'invalid' : evidence?.schema_version ?? null,
    community: communityAssessment?.validation_status ?? 'not_assessed',
    climate: climateContext?.source_version ?? climateContext?.source_name ?? null,
    benchmark: Boolean(benchmark && breakage),
    alignment: alignmentEntries.length,
    profileLabel: PRIORITY_CARDS[profileId]?.name ?? null,
  });

  return {
    schema_version: READINESS_SCHEMA_VERSION,
    status,
    construction_readiness: CONSTRUCTION_READINESS,
    gates,
    feasibility: feasibilityMatrix(gates),
    next_decision: nextDecision(status),
    deterministic_fingerprint: fingerprint,
  };
}
