import { BRIEF_FILENAME, composeDecisionBrief } from './decisionBrief.js';

export function downloadPitchPdf(analysis) {
  const blob = composeDecisionBrief(analysis).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = BRIEF_FILENAME;
  link.click();
  URL.revokeObjectURL(url);
}

// `auditBundle` (products.js) lets QA run `python -m services.decision_ai.audit <export.json>`.
export function downloadDecisionJson(analysis, auditBundle = null) {
  const payload = {
    fingerprint: analysis.fingerprint,
    budget_million_cop: analysis.parameters.budget_million_cop,
    used_million_cop: analysis.portfolio.cost,
    remaining_million_cop: analysis.portfolio.remaining,
    measures: analysis.portfolio.measures.map((measure) => ({
      id: measure.id,
      name: measure.name,
      localization: measure.place.localization,
      trigger: measure.place.trigger,
      cost_million_cop: measure.cost,
      dimension_id: measure.dimensionId,
      nbs_class: measure.nbsClass,
      order: measure.implementationOrder,
      priority_contribution: measure.part.contribution,
    })),
    stress_status: analysis.stress.status,
    findings: analysis.findings,
    residual: analysis.residual.rows,
    ...(auditBundle ? { audit_bundle: auditBundle } : {}),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ourea-cornare-decision.json';
  link.click();
  URL.revokeObjectURL(url);
}
