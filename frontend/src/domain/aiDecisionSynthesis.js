import contract from '../config/aiDecisionContract.json' with { type: 'json' };

const AI_DECISION_CONTRACT = contract;

const OWNERS = new Set(AI_DECISION_CONTRACT.owners);
const LIMITS = AI_DECISION_CONTRACT.limits;

function clippedString(value, max) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > max) return null;
  return text;
}

function stringList(value, spec) {
  if (!Array.isArray(value) || value.length === 0 || value.length > spec.max) return null;
  const items = value.map((item) => clippedString(item, spec.item));
  if (items.some((item) => !item)) return null;
  return items;
}

export function parseDecisionSynthesis(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'invalid_payload' };
  }
  const headline = clippedString(payload.headline, LIMITS.headline);
  const rationale = stringList(payload.portfolio_rationale, LIMITS.portfolio_rationale);
  const questions = stringList(payload.field_visit_questions, LIMITS.field_visit_questions);
  const cannot = stringList(payload.cannot_conclude, LIMITS.cannot_conclude);
  if (!headline || !rationale || !questions || !cannot) {
    return { ok: false, error: 'invalid_synthesis' };
  }
  if (!Array.isArray(payload.gate_explanations) || payload.gate_explanations.length > LIMITS.gate_explanations.max) {
    return { ok: false, error: 'invalid_gates' };
  }
  const gates = [];
  for (const item of payload.gate_explanations) {
    const gate_id = clippedString(item?.gate_id, 64);
    const explanation = clippedString(item?.explanation, LIMITS.gate_explanations.explanation);
    const evidence_needed = clippedString(item?.evidence_needed, LIMITS.gate_explanations.evidence_needed);
    if (!gate_id || !explanation || !evidence_needed) {
      return { ok: false, error: 'invalid_gates' };
    }
    gates.push({ gate_id, explanation, evidence_needed });
  }
  if (!Array.isArray(payload.next_actions) || payload.next_actions.length === 0
    || payload.next_actions.length > LIMITS.next_actions.max) {
    return { ok: false, error: 'invalid_actions' };
  }
  const actions = [];
  for (const [index, item] of payload.next_actions.entries()) {
    const action = clippedString(item?.action, LIMITS.next_actions.action);
    const timing = clippedString(item?.timing, LIMITS.next_actions.timing);
    const owner = clippedString(item?.owner, 64);
    const order = Number(item?.order);
    if (!action || !timing || !OWNERS.has(owner) || order !== index + 1) {
      return { ok: false, error: 'invalid_actions' };
    }
    actions.push({ order, action, owner, timing });
  }
  const cost = payload.cost_interpretation;
  const robust = payload.robustness_interpretation;
  const main_driver = clippedString(cost?.main_driver, LIMITS.cost_field);
  const uncertainty = clippedString(cost?.uncertainty, LIMITS.cost_field);
  const survey_requirement = clippedString(cost?.survey_requirement, LIMITS.cost_field);
  const strength = clippedString(robust?.strength, LIMITS.robustness_field);
  const caveat = clippedString(robust?.caveat, LIMITS.robustness_field);
  if (!main_driver || !uncertainty || !survey_requirement || !strength || !caveat) {
    return { ok: false, error: 'invalid_interpretation' };
  }
  if (Number(payload.schema_version) !== 1) {
    return { ok: false, error: 'invalid_schema' };
  }
  return {
    ok: true,
    value: {
      schema_version: 1,
      headline,
      portfolio_rationale: rationale,
      gate_explanations: gates,
      field_visit_questions: questions,
      next_actions: actions,
      cost_interpretation: { main_driver, uncertainty, survey_requirement },
      robustness_interpretation: { strength, caveat },
      cannot_conclude: cannot,
    },
  };
}
