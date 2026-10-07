export const VALID_SYNTHESIS = Object.freeze({
  schema_version: 1,
  headline: 'Walk cells 12 and 18 before any construction decision.',
  portfolio_rationale: [
    'The robust portfolio keeps a stronger lower-tail planning benefit than hazard-only and one-scenario picks under the same budget.',
    'US$ figures are a pre-feasibility envelope; drainage length dominates uncertainty.',
  ],
  gate_explanations: [
    {
      gate_id: 'community_review',
      explanation: 'Community review is not assessed, which is not support or opposition.',
      evidence_needed: 'Record community evidence during the field visit.',
    },
    {
      gate_id: 'drainage_survey',
      explanation: 'Corridor length is still a 40/60/80 m scenario.',
      evidence_needed: 'Survey drainage length before a bill of quantities.',
    },
  ],
  field_visit_questions: [
    'Where does runoff actually concentrate on the walked slope?',
    'Which roofs can host a demonstration tank if residents agree?',
    'What access constraints would change a trench alignment?',
  ],
  next_actions: [
    {
      order: 1,
      action: 'Walk the selected cells with municipal and community counterparts.',
      owner: 'Ourea team',
      timing: 'This month',
    },
    {
      order: 2,
      action: 'Record community evidence before specifying trenches or tanks.',
      owner: 'Community representatives',
      timing: 'During site validation',
    },
    {
      order: 3,
      action: 'Survey drainage length and commission 30% design if the walk confirms the cells.',
      owner: 'Engineering team',
      timing: 'After community review',
    },
  ],
  cost_interpretation: {
    main_driver: 'Drainage scenario length dominates the US$ envelope.',
    uncertainty: 'The low/base/high range is pre-feasibility, not a contract price.',
    survey_requirement: 'A topographic and hydraulic survey converts 40/60/80 m assumptions into quantities.',
  },
  robustness_interpretation: {
    strength: 'Lower-tail planning benefit is compared under a shared budget and seed.',
    caveat: 'Robustness is not a landslide or structural-failure forecast.',
  },
  cannot_conclude: [
    'Ourea cannot say which house will fail or how many people are protected.',
    'Ourea cannot approve construction or declare the hillside safe.',
  ],
});

export const VALID_SNAPSHOT = Object.freeze({
  schema_version: 1,
  snapshot_id: 'ourea-testhash',
  language: 'en',
  profile: { id: 'balanced', label: 'Balanced' },
  interventions: [
    { cell_id: 12, type: 'rwh' },
    { cell_id: 18, type: 'drainage' },
  ],
  rainfall: {
    preset_id: 'typical_wet',
    source_name: 'CHIRPS v3.0 Final',
    climatology_period: '1991-2020',
    percentile: 75,
  },
  uncertainty: {
    runs: 40,
    p10: 8.2,
    median: 10,
    p90: 12,
    downside_retention: 0.82,
    label: 'Planning-benefit proxies under modeled wet futures, not people saved.',
  },
  benchmark: {
    robust_p10: 8.2,
    hazard_p10: 6.1,
    deterministic_p10: 7.4,
    robust_holds_lower_tail: true,
  },
  breakage: {
    combinations_below_threshold: 2,
    note: 'Counts are scenario combinations, not spatial grid cells and not a failure forecast.',
  },
  cost: {
    complete: true,
    currency: 'USD',
    low: 328000,
    base: 730000,
    high: 1390000,
    confidence: 'pre-feasibility',
    main_driver: 'Drainage corridor length.',
    label: 'Pre-feasibility implementation envelope, not an offer, contract or engineering estimate.',
  },
  action_footprint: {
    planning_cells_targeted: 2,
    cadastral_buildings: 51,
    high_hazard_buildings: 51,
    population_proxy: 34,
    label: 'Targeted planning proxies, not people protected or avoided losses.',
  },
  evidence: { valid: true, layer_count: 11, statuses: ['official'] },
  community: {
    validation_status: 'not_assessed',
    not_assessed_count: 2,
    documented_count: 0,
    incomplete_count: 0,
    safeguards_activated_count: 0,
    interpretation: 'not_assessed is not support, opposition or low social risk',
  },
  local_alignment: {
    entry_count: 3,
    status: 'documentary-alignment-not-community-support',
    interpretation: 'Documentary alignment, not community endorsement.',
  },
  readiness: {
    status: 'ready_for_field_validation',
    construction_readiness: 'not_assessed_by_ourea',
    next_decision: 'Fund site validation and 30% design, then return with a bill of quantities before construction approval.',
    gates: [
      {
        id: 'community_review',
        status: 'pending',
        label: 'Community review',
        reason: 'Community review is not assessed.',
        evidence_required: 'Record community evidence.',
      },
    ],
  },
  guardrails: [
    'USD figures in the decision brief are a pre-feasibility implementation envelope, not an offer, contract or engineering estimate.',
  ],
});
