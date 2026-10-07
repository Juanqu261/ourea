import contract from './aiDecisionContract.json' with { type: 'json' };

export const AI_DECISION_CONTRACT = Object.freeze(contract);

export const AI_REVIEW_COPY = Object.freeze({
  title: 'AI decision review',
  purpose: 'Turn Ourea’s model results into a field-validation and decision-meeting brief.',
  interprets: 'This interprets the existing Ourea result. It does not approve construction or declare a site safe.',
  generate: 'Generate decision review',
  generating: 'Preparing the decision review…',
  regenerate: 'Regenerate',
  collapse: 'Collapse review',
  expand: 'Expand review',
  cancel: 'Cancel',
  assisted: 'AI-assisted synthesis',
  pdfSection: 'AI-assisted decision synthesis',
  unconfigured:
    'AI decision review is not configured. Ourea’s deterministic analysis and PDF remain available.',
  why: 'Why this portfolio',
  gates: 'Binding decision gates',
  questions: 'Questions for the field visit',
  next: 'Next actions',
  cost: 'Cost and robustness interpretation',
  costDriver: 'Main cost driver',
  costUncertainty: 'Cost uncertainty',
  surveyRequirement: 'Survey requirement',
  robustStrength: 'Robustness strength',
  robustCaveat: 'Robustness caveat',
  cannot: 'What Ourea cannot conclude',
  timeout: 'The decision review timed out. Deterministic analysis remains available.',
  busy: 'The review service is busy. Try again in a moment.',
  unavailable: 'The review service is unavailable. Deterministic analysis remains available.',
  rejected: 'The review request was invalid. Deterministic analysis remains available.',
  incomplete: 'The review was cut off before a complete brief. Try again. Deterministic analysis remains available.',
  schema: 'The review did not match the required brief schema. Try again. Deterministic analysis remains available.',
  refused: 'The model declined this review. Deterministic analysis remains available.',
  unreachable: 'The review service could not be reached. Deterministic analysis remains available.',
  cooldown: 'Wait a few seconds before generating again.',
});

export const READINESS_LABELS = Object.freeze({
  ready_for_field_validation: 'Ready for field validation',
  proceed_with_conditions: 'Proceed with conditions',
  needs_evidence_review: 'Needs evidence review',
});

export function resolveAiApiUrl() {
  if (typeof window !== 'undefined') {
    const fromWindow = String(window.__OUREA_AI_API_URL__ ?? '').trim();
    if (fromWindow) return fromWindow;
  }
  return String(import.meta.env?.VITE_OUREA_AI_API_URL ?? '').trim();
}
