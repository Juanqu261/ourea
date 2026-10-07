export const CITY_LENSES = Object.freeze({
  exposure: {
    label: 'Exposure',
    rankField: 'rank_exposure',
    scoreField: 'priority_exposure',
    question: 'Help more exposed people',
    description: 'More people where mapped hazard is higher.',
  },
  balanced: {
    label: 'Balanced',
    rankField: 'rank_balanced',
    scoreField: 'priority_balanced',
    question: 'Balance exposure and local vulnerability',
    description: 'Mixes exposure with socioeconomic vulnerability.',
  },
  equity: {
    label: 'Equity',
    rankField: 'rank_equity',
    scoreField: 'priority_equity',
    question: 'Give more weight to vulnerable communities',
    description: 'Raises weight on socioeconomic vulnerability.',
  },
});

export const INTERVENTION_COPY = Object.freeze({
  rwh: {
    mechanism: 'Capture rainfall before it becomes runoff.',
    evidence: 'Local household-system precedent; effect remains an explicit planning prior.',
  },
  drainage: {
    mechanism: 'Move excess water more safely.',
    evidence: 'Official drainage-corridor spatial proxy; effect remains an explicit planning prior.',
  },
  restoration: {
    mechanism: 'Increase soil and vegetation retention.',
    evidence: 'Spatial opportunity proxy; effect remains an explicit planning prior and matures over 3 years.',
  },
});

export const STABILITY_BANDS = Object.freeze({
  high: { min: 10 / 12, label: 'High stability' },
  moderate: { min: 6 / 12, label: 'Moderate stability' },
  sensitive: { min: 0, label: 'Sensitive' },
});

export const EVIDENCE_GROUPS = Object.freeze([
  {
    id: 'observed',
    label: 'Observed / official',
    ids: ['terrain', 'hazard', 'buildings', 'city_population_2026', 'city_imcv_2023', 'climate'],
  },
  {
    id: 'proxies',
    label: 'Planning proxies',
    ids: ['population', 'access', 'socioeconomic', 'city_priority_screen'],
  },
  {
    id: 'priors',
    label: 'Explicit model assumptions',
    ids: ['intervention_effects'],
  },
  {
    id: 'budget',
    label: 'Budget unit',
    ids: ['cost'],
  },
]);

export const LAYER_LABELS = Object.freeze({
  hazard: 'Hazard',
  cells: 'Cells',
  roads: 'Roads',
});

export function stabilityBand(frequency) {
  const value = Number(frequency) || 0;
  if (value >= STABILITY_BANDS.high.min) return 'high';
  if (value >= STABILITY_BANDS.moderate.min) return 'moderate';
  return 'sensitive';
}

export function frontierTakeaway(frontier) {
  if (!frontier || frontier.length < 3) return null;
  const sorted = [...frontier].sort((a, b) => a.budgetCredits - b.budgetCredits);
  const maxMedian = Math.max(...sorted.map((point) => Number(point.median) || 0));
  if (!(maxMedian > 0)) return null;

  const capture = sorted.find((point) => Number(point.median) >= 0.8 * maxMedian);
  const last = sorted[sorted.length - 1];
  if (!capture || capture.budgetCredits >= last.budgetCredits) return null;

  const leftover = (Number(last.median) - Number(capture.median)) / maxMedian;
  if (leftover > 0.25) return null;

  return `Most additional robust benefit is captured by ${capture.budgetCredits} planning credits in this ensemble.`;
}

export const PRIORITY_CARDS = Object.freeze({
  balanced: {
    name: 'Balanced',
    description: 'Best all-round mix of exposure, equity and access.',
    how: 'Keeps exposure reduction first, then adds modest equity and access weights.',
  },
  equity: {
    name: 'Equity-first',
    description: 'Prioritize vulnerable communities.',
    how: 'Increases decision weight on cells with high stratum-1 exposure.',
  },
  access: {
    name: 'Access-first',
    description: 'Prioritize hillside access interventions.',
    how: 'Increases decision weight on cells that support mapped hillside access.',
  },
  low_regret: {
    name: 'Low-regret',
    description: 'Strongest protection when assumptions worsen.',
    how: 'Penalizes lower-tail uncertainty so fewer, more defensible projects remain.',
  },
});

export const FLOW_STEPS = Object.freeze([
  {
    id: 'area',
    short: 'Where',
    title: 'Where should the city act?',
    instruction: 'Choose a screening lens, then analyze the focus area.',
  },
  {
    id: 'conditions',
    short: 'Conditions',
    title: 'What conditions should we plan for?',
    instruction: 'Choose the rainfall conditions Ourea should test your plan against.',
  },
  {
    id: 'priorities',
    short: 'Priorities',
    title: 'What matters most?',
    instruction: 'Pick what the plan should prioritize under the same data and budget.',
  },
  {
    id: 'portfolio',
    short: 'Plan',
    title: 'How do you want to build the plan?',
    instruction: 'Generate a robust plan, or place interventions yourself.',
  },
  {
    id: 'review',
    short: 'Compare',
    title: 'Does this plan hold up?',
    instruction: 'See how the plan performs — then compare Baseline vs With plan on the map.',
  },
  {
    id: 'safeguards',
    short: 'Review',
    title: 'What should happen next?',
    instruction: 'Check evidence and download a briefing for discussion.',
  },
]);

export const DECISION_ENGINE_COPY = Object.freeze({
  title: 'How Ourea searched',
  eligibleCandidates: 125,
  uncertaintyScenarios: 80,
  policyObjectives: 4,
  comparisonFutures: 220,
  explanation:
    'Ourea searches intervention-location combinations under budget constraints, reevaluates marginal benefit as projects overlap, penalizes downside and exposes alternative policy choices.',
  milpNote:
    'The browser search is independently cross-checked with a binary MILP. It is not claimed to find a global optimum.',
});

export const PRODUCT_INTRO = Object.freeze({
  tagline: 'Plan urban climate adaptation under uncertainty.',
  path: 'Find priority areas → test interventions → compare robust plans',
});
