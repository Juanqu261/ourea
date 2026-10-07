import assert from 'node:assert/strict';
import test from 'node:test';
import { flowReducer, initialFlowState } from '../src/flow/flowReducer.js';
import {
  canAdvance,
  canEnterStep,
  isStepComplete,
  mapScopeForFlow,
} from '../src/flow/flowGuards.js';

function apply(state, action) {
  return flowReducer(state, action);
}

test('guided mode starts on the area step', () => {
  assert.equal(initialFlowState.mode, 'guided');
  assert.equal(initialFlowState.step, 'area');
  assert.equal(mapScopeForFlow(initialFlowState), 'city');
  assert.equal(canEnterStep(initialFlowState, 'review'), false);
});

test('SELECT_AREA opens conditions and keeps later steps locked', () => {
  const next = apply(initialFlowState, { type: 'SELECT_AREA', areaId: 'llanaditas' });
  assert.equal(next.step, 'conditions');
  assert.equal(next.areaId, 'llanaditas');
  assert.equal(mapScopeForFlow(next), 'sandbox');
  assert.equal(canEnterStep(next, 'area'), true);
  assert.equal(canEnterStep(next, 'conditions'), true);
  assert.equal(canEnterStep(next, 'priorities'), false);
});

test('cannot jump to a step that has not been reached', () => {
  const skipped = apply(initialFlowState, { type: 'GO_TO_COMPLETED_STEP', step: 'review' });
  assert.equal(skipped.step, 'area');
});

test('changing climate after a recommendation marks it stale', () => {
  let state = initialFlowState;
  state = apply(state, { type: 'SELECT_AREA', areaId: 'llanaditas' });
  state = apply(state, { type: 'CONFIRM_CONDITIONS' });
  state = apply(state, { type: 'CONFIRM_PRIORITY', profileId: 'balanced' });
  state = apply(state, { type: 'GENERATION_COMPLETED', profileId: 'balanced' });
  assert.equal(state.step, 'review');
  assert.equal(state.recommendationStale, false);
  state = apply(state, { type: 'SET_CONDITIONS' });
  assert.equal(state.recommendationStale, true);
});

test('changing priority after a recommendation marks it stale', () => {
  let state = apply(initialFlowState, { type: 'SELECT_AREA', areaId: 'llanaditas' });
  state = apply(state, { type: 'CONFIRM_CONDITIONS' });
  state = apply(state, { type: 'CONFIRM_PRIORITY', profileId: 'balanced' });
  state = apply(state, { type: 'GENERATION_COMPLETED', profileId: 'balanced' });
  state = apply(state, { type: 'SET_PRIORITY', profileId: 'equity' });
  assert.equal(state.recommendationStale, true);
  assert.equal(state.profileId, 'equity');
});

test('explore mode does not use the city map', () => {
  const next = apply(initialFlowState, { type: 'ENTER_EXPLORE_MODE' });
  assert.equal(next.mode, 'explore');
  assert.equal(mapScopeForFlow(next), 'sandbox');
  const back = apply(next, { type: 'RETURN_TO_GUIDED_MODE' });
  assert.equal(back.mode, 'guided');
});

test('area is complete when any areaId is set', () => {
  assert.equal(isStepComplete('area', initialFlowState, {}), false);
  assert.equal(isStepComplete('area', { ...initialFlowState, areaId: 'llanaditas' }, {}), true);
  assert.equal(isStepComplete('area', { ...initialFlowState, areaId: 'xianlin' }, {}), true);
  assert.equal(
    canAdvance(
      { ...initialFlowState, step: 'conditions' },
      { scenario: { rainMm: 80 }, budgetCredits: 10 },
    ),
    true,
  );
});

test('RESET returns to the first step', () => {
  let state = apply(initialFlowState, { type: 'SELECT_AREA', areaId: 'llanaditas' });
  state = apply(state, { type: 'RESET' });
  assert.equal(state.step, 'area');
  assert.equal(state.areaId, null);
  assert.equal(state.mode, 'guided');
});

test('HYDRATE_SESSION opens Llanaditas at safeguards with later steps unlocked', () => {
  const next = apply(initialFlowState, {
    type: 'HYDRATE_SESSION',
    areaId: 'llanaditas',
    profileId: 'balanced',
    step: 'safeguards',
  });
  assert.equal(next.areaId, 'llanaditas');
  assert.equal(next.step, 'safeguards');
  assert.equal(next.maxReached, 'safeguards');
  assert.equal(next.portfolioMode, 'recommended');
  assert.equal(mapScopeForFlow(next), 'sandbox');
  assert.equal(canEnterStep(next, 'review'), true);
  assert.match(next.announcement, /planning cell/i);
});
