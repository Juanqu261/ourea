import { FLOW_STEPS } from '../config/uiCopy.js';

export const STEP_IDS = Object.freeze(FLOW_STEPS.map((step) => step.id));

export const initialFlowState = Object.freeze({
  mode: 'guided',
  step: 'area',
  maxReached: 'area',
  areaId: null,
  cityLens: 'balanced',
  profileId: 'balanced',
  portfolioMode: null,
  drawer: null,
  modal: null,
  exploreTab: 'scenario',
  advancedTab: 'benchmark',
  announcement: 'Step 1 of 6. Where should the city act?',
  exampleBanner: false,
  recommendationStale: false,
  pendingGeneration: false,
  pendingKind: null,
  legendCollapsed: false,
  layersOpen: false,
  sheetExpanded: false,
  menuOpen: false,
  manualOpen: false,
});

export function stepIndex(stepId) {
  const index = STEP_IDS.indexOf(stepId);
  return index < 0 ? 0 : index;
}

export function stepMeta(stepId) {
  return FLOW_STEPS[stepIndex(stepId)] ?? FLOW_STEPS[0];
}

function announce(stepId, extra = '') {
  const meta = stepMeta(stepId);
  const index = stepIndex(stepId) + 1;
  return extra || `Step ${index} of 6. ${meta.title}`;
}

function withMax(state, stepId) {
  return stepIndex(stepId) > stepIndex(state.maxReached) ? stepId : state.maxReached;
}

function staleIfPastPortfolio(state) {
  if (stepIndex(state.maxReached) >= stepIndex('portfolio')) {
    return { ...state, recommendationStale: true };
  }
  return state;
}

export function flowReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE_SESSION': {
      const step = action.step && STEP_IDS.includes(action.step) ? action.step : 'safeguards';
      return {
        ...state,
        mode: 'guided',
        areaId: action.areaId ?? state.areaId ?? null,
        profileId: action.profileId ?? state.profileId,
        portfolioMode: action.portfolioMode ?? 'recommended',
        step,
        maxReached: withMax({ ...state, maxReached: 'safeguards' }, step),
        recommendationStale: false,
        drawer: null,
        modal: null,
        menuOpen: false,
        sheetExpanded: false,
        announcement: announce(step, 'Opened a planning cell from the briefing.'),
      };
    }

    case 'SELECT_AREA': {
      const next = staleIfPastPortfolio(state);
      return {
        ...next,
        areaId: action.areaId,
        step: 'conditions',
        maxReached: withMax(next, 'conditions'),
        announcement: announce('conditions'),
        drawer: null,
        exampleBanner: false,
        menuOpen: false,
        sheetExpanded: false,
      };
    }

    case 'SET_LENS':
      return { ...state, cityLens: action.cityLens };

    case 'SET_AREA':
      return { ...state, areaId: action.areaId };

    case 'SET_CONDITIONS':
      return staleIfPastPortfolio({ ...state, exampleBanner: false });

    case 'CONFIRM_CONDITIONS':
      return {
        ...state,
        step: 'priorities',
        maxReached: withMax(state, 'priorities'),
        announcement: announce('priorities'),
        drawer: null,
        sheetExpanded: false,
      };

    case 'SET_PRIORITY':
      return staleIfPastPortfolio({
        ...state,
        profileId: action.profileId,
        exampleBanner: false,
      });

    case 'CONFIRM_PRIORITY':
      return {
        ...state,
        profileId: action.profileId ?? state.profileId,
        step: 'portfolio',
        maxReached: withMax(state, 'portfolio'),
        announcement: announce('portfolio'),
        sheetExpanded: false,
      };

    case 'CHOOSE_PORTFOLIO_MODE':
      return {
        ...state,
        portfolioMode: action.mode,
        manualOpen: action.mode === 'manual',
      };

    case 'GENERATION_STARTED':
      return {
        ...state,
        portfolioMode: 'recommended',
        pendingGeneration: true,
        pendingKind: action.kind ?? 'generate',
        recommendationStale: false,
        announcement: 'Generating a recommendation under uncertainty…',
        manualOpen: false,
      };

    case 'GENERATION_COMPLETED':
      return {
        ...state,
        pendingGeneration: false,
        pendingKind: null,
        recommendationStale: false,
        areaId: state.areaId,
        profileId: action.profileId ?? state.profileId,
        step: 'review',
        maxReached: withMax(state, 'review'),
        announcement: action.message ?? 'Recommendation ready',
        exampleBanner: Boolean(action.example),
        sheetExpanded: false,
        drawer: null,
        manualOpen: false,
      };

    case 'GENERATION_FAILED':
      return {
        ...state,
        pendingGeneration: false,
        pendingKind: null,
        announcement: action.message ?? 'Recommendation failed',
      };

    case 'CONFIRM_MANUAL':
      return {
        ...state,
        portfolioMode: 'manual',
        step: 'review',
        maxReached: withMax(state, 'review'),
        announcement: announce('review'),
        sheetExpanded: false,
      };

    case 'CONFIRM_REVIEW':
      return {
        ...state,
        step: 'safeguards',
        maxReached: withMax(state, 'safeguards'),
        announcement: announce('safeguards'),
        sheetExpanded: false,
        drawer: null,
      };

    case 'GO_BACK': {
      const previous = STEP_IDS[stepIndex(state.step) - 1];
      if (!previous) return state;
      return {
        ...state,
        step: previous,
        announcement: announce(previous),
        drawer: null,
        modal: null,
        sheetExpanded: false,
      };
    }

    case 'GO_TO_COMPLETED_STEP': {
      if (stepIndex(action.step) > stepIndex(state.maxReached)) return state;
      return {
        ...state,
        step: action.step,
        mode: 'guided',
        announcement: announce(action.step),
        drawer: null,
        modal: null,
        menuOpen: false,
        sheetExpanded: false,
      };
    }

    case 'OPEN_DRAWER':
      return { ...state, drawer: action.drawer, menuOpen: false };

    case 'CLOSE_DRAWER':
      return { ...state, drawer: null };

    case 'OPEN_MODAL':
      return { ...state, modal: action.modal, menuOpen: false };

    case 'CLOSE_MODAL':
      return { ...state, modal: null };

    case 'SET_EXPLORE_TAB':
      return { ...state, exploreTab: action.tab };

    case 'SET_ADVANCED_TAB':
      return { ...state, advancedTab: action.tab };

    case 'ENTER_EXPLORE_MODE':
      return {
        ...state,
        mode: 'explore',
        drawer: null,
        modal: null,
        menuOpen: false,
        announcement: 'Explore freely. Scenario, Build, Compare and Evidence are in tabs.',
      };

    case 'RETURN_TO_GUIDED_MODE':
      return {
        ...state,
        mode: 'guided',
        menuOpen: false,
        announcement: announce(state.step),
      };

    case 'TOGGLE_MENU':
      return { ...state, menuOpen: !state.menuOpen };

    case 'CLOSE_MENU':
      return { ...state, menuOpen: false };

    case 'TOGGLE_LEGEND':
      return { ...state, legendCollapsed: !state.legendCollapsed };

    case 'TOGGLE_LAYERS':
      return { ...state, layersOpen: !state.layersOpen };

    case 'TOGGLE_SHEET':
      return { ...state, sheetExpanded: !state.sheetExpanded };

    case 'DISMISS_BANNER':
      return { ...state, exampleBanner: false };

    case 'MARK_STALE':
      return { ...state, recommendationStale: true };

    case 'ANNOUNCE':
      return { ...state, announcement: action.message };

    case 'RESET':
      return { ...initialFlowState };

    default:
      return state;
  }
}
