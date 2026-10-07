import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_SCENARIO,
  INTERVENTIONS,
  MODEL_LIMITS,
  MODEL_PARAMETERS,
  OBJECTIVE_PROFILES,
} from '../config/modelConfig.js';
import { caseObjectiveProfiles } from '../config/cases/index.js';
import { alternativeById, generateAlternativePortfolios } from '../domain/alternatives.js';
import { budgetRobustnessFrontier } from '../domain/frontier.js';
import { capturedRainwaterVolumeM3 } from '../domain/interventionModel.js';
import { fitPlanToBudget, planCostCredits } from '../domain/optimizer.js';
import { sampledParetoSet } from '../domain/pareto.js';
import { portfolioSelectionStability } from '../domain/stability.js';
import {
  createScenarioContext,
  evaluatePortfolio,
  monteCarloPortfolio,
} from '../domain/scenarioEngine.js';
import { assessCommunitySafeguards } from '../domain/communitySafeguards.js';
import { compareSelectionStrategies } from '../domain/benchmark.js';
import { diagnosePortfolioBreaks } from '../domain/sensitivity.js';
import { INTERVENTION_TYPES, normalizeCommunityRecord } from '../config/communityEvidence.js';
import {
  defaultScenarioFromClimate,
  rainStepsFromClimate,
  scenarioFromPreset,
} from '../domain/climateScenarios.js';

const EMPTY_PLAN = Object.freeze([]);
const DEFAULT_AI_PROFILE = 'balanced';

function profilesForData(data) {
  return caseObjectiveProfiles(data?.caseConfig) ?? OBJECTIVE_PROFILES;
}

function resolveProfile(data, profileId) {
  const profiles = profilesForData(data);
  const config = profiles[profileId] ?? profiles.balanced ?? OBJECTIVE_PROFILES.balanced;
  return { id: profileId, ...config };
}

export function usePortfolioWorkspace({ data, selectedCellId, selectedType }) {
  const [scenario, setScenario] = useState({
    rainMm: DEFAULT_SCENARIO.rainMm,
    antecedentWetness: DEFAULT_SCENARIO.antecedentWetness,
    planningYear: DEFAULT_SCENARIO.planningYear,
    presetId: 'typical_wet',
  });
  const [budgetCredits, setBudgetCredits] = useState(DEFAULT_SCENARIO.budgetCredits);
  const [userPlan, setUserPlan] = useState([]);
  const [alternatives, setAlternatives] = useState([]);
  const [alternativeBusy, setAlternativeBusy] = useState(false);
  const [alternativeError, setAlternativeError] = useState(null);
  const [selectedAiProfileId, setSelectedAiProfileId] = useState(DEFAULT_AI_PROFILE);
  const [aiPlan, setAiPlan] = useState([]);
  const [aiDiagnostics, setAiDiagnostics] = useState(null);
  const [view, setView] = useState('none');
  const [frontier, setFrontier] = useState(null);
  const [frontierBusy, setFrontierBusy] = useState(false);
  const [frontierError, setFrontierError] = useState(null);
  const [stability, setStability] = useState(null);
  const [stabilityBusy, setStabilityBusy] = useState(false);
  const [stabilityError, setStabilityError] = useState(null);
  const [pareto, setPareto] = useState(null);
  const [paretoBusy, setParetoBusy] = useState(false);
  const [paretoError, setParetoError] = useState(null);
  const [sessionCommunityRecords, setSessionCommunityRecords] = useState([]);
  const [benchmark, setBenchmark] = useState(null);
  const [breakage, setBreakage] = useState(null);
  const [benchmarkBusy, setBenchmarkBusy] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState(null);
  const restoringRef = useRef(false);

  const context = useMemo(
    () => (data ? createScenarioContext(data.buildings, data.cells) : null),
    [data],
  );

  useEffect(() => {
    if (!data?.climateContext) return;
    setScenario((current) => {
      if (current.climate) return current;
      const next = defaultScenarioFromClimate(data.climateContext, DEFAULT_SCENARIO.budgetCredits);
      return {
        rainMm: next.rainMm,
        antecedentWetness: next.antecedentWetness,
        planningYear: current.planningYear,
        presetId: next.presetId,
        climate: next.climate,
      };
    });
  }, [data]);

  const activePlan = useMemo(
    () => (view === 'user' ? userPlan : view === 'ai' ? aiPlan : EMPTY_PLAN),
    [view, userPlan, aiPlan],
  );

  const userCost = planCostCredits(userPlan);
  const aiCost = planCostCredits(aiPlan);

  const baseline = useMemo(
    () => (context ? evaluatePortfolio({ context, projects: EMPTY_PLAN, scenario }) : null),
    [context, scenario],
  );

  const metrics = useMemo(() => {
    if (!context) return null;
    if (!activePlan.length) return baseline;
    return evaluatePortfolio({ context, projects: activePlan, scenario });
  }, [context, activePlan, scenario, baseline]);

  const monteCarlo = useMemo(
    () =>
      context && activePlan.length
        ? monteCarloPortfolio({
            context,
            projects: activePlan,
            scenario,
            seed: MODEL_PARAMETERS.scenarioUncertainty.comparisonSeed,
          })
        : null,
    [context, activePlan, scenario],
  );

  const capturedVolumeM3 = useMemo(
    () => (data ? capturedRainwaterVolumeM3(data.cells, activePlan, scenario.rainMm) : 0),
    [data, activePlan, scenario.rainMm],
  );

  const canAddSelected = useMemo(() => {
    if (selectedCellId == null) return false;
    const cost = INTERVENTIONS[selectedType].costCredits;
    const duplicate = userPlan.some(
      (project) =>
        Number(project.cell_id) === Number(selectedCellId) && project.type === selectedType,
    );
    const cellProjectCount = userPlan.filter(
      (project) => Number(project.cell_id) === Number(selectedCellId),
    ).length;
    return (
      !duplicate
      && cellProjectCount < MODEL_LIMITS.maxProjectsPerCell
      && userCost + cost <= budgetCredits
    );
  }, [selectedCellId, selectedType, userPlan, userCost, budgetCredits]);

  const communityCatalog = useMemo(
    () => ({
      cellIds: new Set(
        (data?.cells?.features ?? []).map((feature) => Number(feature.properties.cell_id)),
      ),
      interventionTypes: INTERVENTION_TYPES,
    }),
    [data],
  );

  const communityAssessment = useMemo(
    () =>
      assessCommunitySafeguards({
        projects: activePlan,
        communityFile: data?.communityEvidence ?? null,
        sessionRecords: sessionCommunityRecords,
        catalog: communityCatalog,
      }),
    [activePlan, data, sessionCommunityRecords, communityCatalog],
  );

  function clearDerivedDecisionProducts() {
    setAlternatives([]);
    setAlternativeError(null);
    setAiPlan([]);
    setAiDiagnostics(null);
    setFrontier(null);
    setFrontierError(null);
    setStability(null);
    setStabilityError(null);
    setPareto(null);
    setParetoError(null);
    setBenchmark(null);
    setBreakage(null);
    setBenchmarkError(null);
    setView((current) => (current === 'ai' ? 'none' : current));
  }

  useEffect(() => {
    if (restoringRef.current) return;
    setUserPlan((plan) => fitPlanToBudget(plan, budgetCredits));
    clearDerivedDecisionProducts();
  }, [budgetCredits]);

  useEffect(() => {
    if (restoringRef.current) return;
    clearDerivedDecisionProducts();
  }, [scenario.rainMm, scenario.antecedentWetness, scenario.planningYear]);

  useEffect(() => {
    if (view === 'user' && !userPlan.length) setView('none');
    if (view === 'ai' && !aiPlan.length) setView('none');
  }, [view, userPlan.length, aiPlan.length]);

  function addSelectedIntervention() {
    if (!canAddSelected) return;
    setUserPlan((plan) => [...plan, { cell_id: Number(selectedCellId), type: selectedType }]);
    setView('user');
  }

  function removeUserProject(projectToRemove) {
    setUserPlan((plan) =>
      plan.filter(
        (project) =>
          !(
            Number(project.cell_id) === Number(projectToRemove.cell_id)
            && project.type === projectToRemove.type
          ),
      ),
    );
  }

  function clearUserPlan() {
    setUserPlan([]);
    if (view === 'user') setView('none');
  }

  function selectAlternative(profileId, options = alternatives) {
    const selected = alternativeById(options, profileId);
    if (!selected) return;
    setSelectedAiProfileId(profileId);
    setAiPlan(selected.plan);
    setAiDiagnostics(selected.diagnostics);
    setView(selected.plan.length ? 'ai' : 'none');
    setFrontier(null);
    setFrontierError(null);
    setStability(null);
    setStabilityError(null);
  }

  function generateAlternatives(preferredProfileId) {
    if (!context || !data || alternativeBusy) return;
    const targetProfile = preferredProfileId ?? selectedAiProfileId;
    setAlternativeBusy(true);
    setAlternativeError(null);
    setAiPlan([]);
    window.setTimeout(() => {
      const started = Date.now();
      try {
        const options = generateAlternativePortfolios({
          context,
          cellsGeoJson: data.cells,
          scenario,
          budgetCredits,
          profiles: profilesForData(data),
        });
        setAlternatives(options);
        const recommended = [...options].sort(
          (a, b) =>
            b.uncertainty.p10 - a.uncertainty.p10 || b.downsideRetention - a.downsideRetention,
        )[0];
        const profileId = alternativeById(options, targetProfile)
          ? targetProfile
          : (recommended?.profileId ?? DEFAULT_AI_PROFILE);
        selectAlternative(profileId, options);
      } catch (error) {
        setAlternativeError(error instanceof Error ? error.message : String(error));
      } finally {
        const remain = Math.max(0, 1800 - (Date.now() - started));
        window.setTimeout(() => setAlternativeBusy(false), remain);
      }
    }, 40);
  }

  function analyzeFrontier() {
    if (!context || !data || frontierBusy) return;
    setFrontierBusy(true);
    setFrontierError(null);
    window.setTimeout(() => {
      try {
        setFrontier(
          budgetRobustnessFrontier({
            context,
            cellsGeoJson: data.cells,
            scenario,
            profile: resolveProfile(data, selectedAiProfileId),
          }),
        );
      } catch (error) {
        setFrontierError(error instanceof Error ? error.message : String(error));
      } finally {
        setFrontierBusy(false);
      }
    }, 0);
  }

  function analyzeStability() {
    if (!context || !data || stabilityBusy) return;
    setStabilityBusy(true);
    setStabilityError(null);
    window.setTimeout(() => {
      try {
        setStability(
          portfolioSelectionStability({
            context,
            cellsGeoJson: data.cells,
            scenario,
            budgetCredits,
            profile: resolveProfile(data, selectedAiProfileId),
          }),
        );
      } catch (error) {
        setStabilityError(error instanceof Error ? error.message : String(error));
      } finally {
        setStabilityBusy(false);
      }
    }, 0);
  }

  function analyzePareto() {
    if (!context || !data || paretoBusy) return;
    setParetoBusy(true);
    setParetoError(null);
    window.setTimeout(() => {
      try {
        setPareto(
          sampledParetoSet({
            context,
            cellsGeoJson: data.cells,
            scenario,
            budgetCredits,
          }),
        );
      } catch (error) {
        setParetoError(error instanceof Error ? error.message : String(error));
      } finally {
        setParetoBusy(false);
      }
    }, 0);
  }

  function analyzeBenchmark() {
    if (!context || !data || benchmarkBusy) return;
    setBenchmarkBusy(true);
    setBenchmarkError(null);
    window.setTimeout(() => {
      try {
        const comparison = compareSelectionStrategies({
          context,
          cellsGeoJson: data.cells,
          scenario,
          budgetCredits,
          profile: resolveProfile(data, selectedAiProfileId),
        });
        setBenchmark(comparison);
        const robust = comparison.strategies.find((item) => item.id === 'ourea_robust');
        setBreakage(
          diagnosePortfolioBreaks({
            context,
            cellsGeoJson: data.cells,
            plan: activePlan.length ? activePlan : robust?.plan ?? [],
            alternativePlan: comparison.strategies.find((item) => item.id === 'hazard_only')?.plan,
            scenario,
            budgetCredits,
            profile: resolveProfile(data, selectedAiProfileId),
            climateRainSteps: rainStepsFromClimate(data.climateContext),
          }),
        );
      } catch (error) {
        setBenchmarkError(error instanceof Error ? error.message : String(error));
      } finally {
        setBenchmarkBusy(false);
      }
    }, 0);
  }

  function applyClimatePreset(preset) {
    setScenario((current) => scenarioFromPreset(preset, { planningYear: current.planningYear }));
  }

  function runGuidedDemo() {
    if (!context || !data?.climateContext || alternativeBusy || benchmarkBusy) return;
    const next = defaultScenarioFromClimate(data.climateContext, DEFAULT_SCENARIO.budgetCredits);
    const demoScenario = {
      rainMm: next.rainMm,
      antecedentWetness: next.antecedentWetness,
      planningYear: 1,
      presetId: next.presetId,
      climate: next.climate,
    };
    const demoBudget = DEFAULT_SCENARIO.budgetCredits;
    setBudgetCredits(demoBudget);
    setScenario(demoScenario);
    setUserPlan([]);
    setView('none');
    setAlternativeBusy(true);
    setAlternativeError(null);
    setBenchmarkBusy(true);
    setBenchmarkError(null);
    window.setTimeout(() => {
      try {
        const options = generateAlternativePortfolios({
          context,
          cellsGeoJson: data.cells,
          scenario: demoScenario,
          budgetCredits: demoBudget,
          profiles: profilesForData(data),
        });
        setAlternatives(options);
        const recommended = [...options].sort(
          (a, b) =>
            b.uncertainty.p10 - a.uncertainty.p10 || b.downsideRetention - a.downsideRetention,
        )[0];
        selectAlternative(recommended?.profileId ?? DEFAULT_AI_PROFILE, options);
        const demoProfile = resolveProfile(data, recommended?.profileId ?? DEFAULT_AI_PROFILE);
        const comparison = compareSelectionStrategies({
          context,
          cellsGeoJson: data.cells,
          scenario: demoScenario,
          budgetCredits: demoBudget,
          profile: demoProfile,
        });
        setBenchmark(comparison);
        const robust = comparison.strategies.find((item) => item.id === 'ourea_robust');
        setBreakage(
          diagnosePortfolioBreaks({
            context,
            cellsGeoJson: data.cells,
            plan: robust?.plan ?? [],
            alternativePlan: comparison.strategies.find((item) => item.id === 'hazard_only')?.plan,
            scenario: demoScenario,
            budgetCredits: demoBudget,
            profile: demoProfile,
            climateRainSteps: rainStepsFromClimate(data.climateContext),
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setAlternativeError(message);
        setBenchmarkError(message);
      } finally {
        setAlternativeBusy(false);
        setBenchmarkBusy(false);
      }
    }, 0);
  }

  function changeView(nextView) {
    if (nextView === 'ai' && !aiPlan.length) return;
    if (nextView === 'user' && !userPlan.length) return;
    setView(nextView);
  }

  function restoreSession(saved) {
    if (!saved?.plan?.length) return;
    restoringRef.current = true;
    if (Number.isFinite(Number(saved.budgetCredits))) {
      setBudgetCredits(Number(saved.budgetCredits));
    }
    if (saved.scenario) {
      setScenario((current) => ({
        ...current,
        ...saved.scenario,
      }));
    }
    if (saved.view === 'user') {
      setUserPlan(saved.plan);
      setView('user');
    } else {
      setAiPlan(saved.plan);
      setSelectedAiProfileId(saved.profileId ?? DEFAULT_AI_PROFILE);
      setView('ai');
    }
    window.setTimeout(() => {
      restoringRef.current = false;
    }, 0);
  }

  function resetWorkspace() {
    setUserPlan([]);
    setAlternatives([]);
    setAlternativeError(null);
    setSelectedAiProfileId(DEFAULT_AI_PROFILE);
    setAiPlan([]);
    setAiDiagnostics(null);
    setView('none');
    setFrontier(null);
    setFrontierError(null);
    setStability(null);
    setStabilityError(null);
    setPareto(null);
    setParetoError(null);
    setSessionCommunityRecords([]);
    setBenchmark(null);
    setBreakage(null);
    setBenchmarkError(null);
    setBudgetCredits(DEFAULT_SCENARIO.budgetCredits);
    if (data?.climateContext) {
      const next = defaultScenarioFromClimate(data.climateContext, DEFAULT_SCENARIO.budgetCredits);
      setScenario({
        rainMm: next.rainMm,
        antecedentWetness: next.antecedentWetness,
        planningYear: 1,
        presetId: next.presetId,
        climate: next.climate,
      });
    }
  }

  function upsertSessionCommunityRecord(partial) {
    const record = normalizeCommunityRecord(
      {
        ...partial,
        origin: 'participatory_session',
        evidence_type: 'participatory_input',
      },
      { fallbackOrigin: 'participatory_session' },
    );
    if (!record) return;
    setSessionCommunityRecords((current) => {
      const key = `${record.cell_id}:${record.intervention_type ?? ''}`;
      const next = current.filter(
        (item) => `${item.cell_id}:${item.intervention_type ?? ''}` !== key,
      );
      next.push(record);
      return next;
    });
  }

  return {
    context,
    scenario,
    setScenario,
    applyClimatePreset,
    runGuidedDemo,
    budgetCredits,
    setBudgetCredits,
    userPlan,
    aiPlan,
    aiDiagnostics,
    alternatives,
    alternativeBusy,
    alternativeError,
    selectedAiProfileId,
    view,
    changeView,
    frontier,
    frontierBusy,
    frontierError,
    stability,
    stabilityBusy,
    stabilityError,
    pareto,
    paretoBusy,
    paretoError,
    userCost,
    aiCost,
    activePlan,
    baseline,
    metrics,
    monteCarlo,
    capturedVolumeM3,
    canAddSelected,
    communityAssessment,
    addSelectedIntervention,
    removeUserProject,
    clearUserPlan,
    generateAlternatives,
    selectAlternative,
    analyzeFrontier,
    analyzeStability,
    analyzePareto,
    analyzeBenchmark,
    benchmark,
    breakage,
    benchmarkBusy,
    benchmarkError,
    upsertSessionCommunityRecord,
    restoreSession,
    resetWorkspace,
  };
}
