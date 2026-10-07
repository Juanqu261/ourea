import { STEP_IDS, stepIndex } from './flowReducer.js';

export function canEnterStep(state, stepId) {
  return stepIndex(stepId) <= stepIndex(state.maxReached);
}

export function isStepComplete(stepId, state, workspace) {
  switch (stepId) {
    case 'area':
      return Boolean(state.areaId);
    case 'conditions':
      return Number.isFinite(Number(workspace?.scenario?.rainMm))
        && Number(workspace?.budgetCredits) >= 4;
    case 'priorities':
      return Boolean(state.profileId);
    case 'portfolio':
      if (state.portfolioMode === 'manual') return (workspace?.userPlan?.length ?? 0) > 0;
      return (workspace?.aiPlan?.length ?? 0) > 0;
    case 'review':
      return (workspace?.activePlan?.length ?? 0) > 0 && !state.recommendationStale;
    case 'safeguards':
      return (workspace?.activePlan?.length ?? 0) > 0;
    default:
      return false;
  }
}

export function canAdvance(state, workspace) {
  return isStepComplete(state.step, state, workspace);
}

export function nextStepId(stepId) {
  return STEP_IDS[stepIndex(stepId) + 1] ?? null;
}

export function previousStepId(stepId) {
  return STEP_IDS[stepIndex(stepId) - 1] ?? null;
}

export function mapScopeForFlow(state) {
  if (state.mode === 'explore') return 'sandbox';
  return state.step === 'area' ? 'city' : 'sandbox';
}
