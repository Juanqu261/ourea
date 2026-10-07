import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { MapLegend } from './components/MapLegend.jsx';
import { MapLayersControl } from './components/MapLayersControl.jsx';
import { TopBar } from './components/TopBar.jsx';
import { CaseSelector } from './components/CaseSelector.jsx';
import { DemoGuide } from './components/DemoGuide.jsx';
import { OureaLogo } from './components/OureaLogo.jsx';
import { BRAND } from './config/brand.js';
import { CASE_IDS, getCase, medellinCase } from './config/cases/index.js';
import { buildDecisionPackage } from './domain/decisionPackage.js';
import { buildDecisionBrief } from './domain/decisionBrief.js';
import { buildDecisionBriefPdf, downloadBlob, renderSitePlate } from './domain/decisionBriefPdf.js';
import { jpegFromDataUrl, jpegSofSize } from './domain/pdfDocument.js';
import { topScreening, lensConfig } from './domain/cityScreen.js';
import {
  clearSessionHash,
  clearStoredSession,
  parseSessionHash,
  readStoredSession,
  simulatorBaseUrl,
  writeSessionHash,
  writeStoredSession,
} from './domain/sessionLink.js';
import { DecisionFlow } from './flow/DecisionFlow.jsx';
import { flowReducer, initialFlowState } from './flow/flowReducer.js';
import { mapScopeForFlow } from './flow/flowGuards.js';
import { useOureaData } from './hooks/useOureaData.js';
import { useOureaMap } from './hooks/useOureaMap.js';
import { usePortfolioWorkspace } from './hooks/usePortfolioWorkspace.js';
import { featureLngLat } from './domain/placeLinks.js';

function resolveInitialCaseId() {
  if (typeof window === 'undefined') return CASE_IDS.MEDELLIN;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('case');
    if (fromQuery === 'nanjing' || fromQuery === CASE_IDS.NANJING) return CASE_IDS.NANJING;
    if (fromQuery === 'medellin' || fromQuery === CASE_IDS.MEDELLIN) return CASE_IDS.MEDELLIN;
  } catch {
    // Ignore malformed query strings.
  }
  return CASE_IDS.MEDELLIN;
}

function findProvingGroundFeature(data, caseConfig, cityLens) {
  const features = data?.screening?.features;
  if (!features?.length) return null;
  if (caseConfig?.id === CASE_IDS.MEDELLIN || caseConfig?.screeningMode === 'barrio') {
    return (
      features.find((feature) =>
        String(feature.properties.BARRIO ?? '').toUpperCase().includes('LLANADITAS'),
      ) ?? null
    );
  }
  const focusMarked = features.find((feature) => feature.properties?.is_focus_area);
  if (focusMarked) return focusMarked;
  const top = topScreening(data.screening, cityLens ?? 'balanced', 1, caseConfig?.cityLenses);
  return top[0] ?? features[0] ?? null;
}

export default function App() {
  const [selectedCaseId, setSelectedCaseId] = useState(resolveInitialCaseId);
  const [changingCity, setChangingCity] = useState(false);
  const caseConfig = useMemo(
    () => (selectedCaseId ? getCase(selectedCaseId) : null),
    [selectedCaseId],
  );
  const { data, loadError } = useOureaData(caseConfig ?? medellinCase);
  const [flow, dispatch] = useReducer(flowReducer, initialFlowState);
  const [selectedBarrio, setSelectedBarrio] = useState(null);
  const [selectedCellId, setSelectedCellId] = useState(null);
  const [selectedType, setSelectedType] = useState('rwh');
  const [layerState, setLayerState] = useState({
    hazard: true,
    cells: true,
    roads: true,
  });

  useEffect(() => {
    // Nanjing drainage-stress layer is cell-shaped; keep it off by default so the
    // detailed grid reads as an analytical overlay on roads/terrain, not a solid block.
    setLayerState((current) => ({
      ...current,
      hazard: caseConfig?.id !== CASE_IDS.NANJING,
      roads: true,
      cells: true,
    }));
  }, [caseConfig?.id]);

  const cityLens = flow.cityLens;
  const scope = mapScopeForFlow(flow);
  const workspaceRef = useRef(null);
  const hydratedRef = useRef(false);
  const areaId = caseConfig?.areaId ?? 'llanaditas';

  const onSelectCell = useCallback((cellId) => {
    setSelectedCellId(cellId);
    writeSessionHash({
      areaId,
      cellId,
      plan: workspaceRef.current?.activePlan,
    });
  }, [areaId]);
  const onSelectBarrio = useCallback(setSelectedBarrio, []);

  const workspace = usePortfolioWorkspace({
    data,
    selectedCellId,
    selectedType,
  });
  workspaceRef.current = workspace;

  const { mapNode, mapStatus, mapError, captureMapImage } = useOureaMap({
    data,
    context: workspace.context,
    scope,
    cityLens,
    flowStep: flow.step,
    flowMode: flow.mode,
    selectedBarrio,
    selectedCellId,
    layerState,
    activePlan: workspace.activePlan,
    scenario: workspace.scenario,
    onSelectCell,
    onSelectBarrio,
  });

  const selectedCell = useMemo(() => {
    const feature = data?.cells?.features?.find(
      (item) => Number(item.properties.cell_id) === Number(selectedCellId),
    );
    if (!feature) return null;
    const centroid = featureLngLat(feature);
    return {
      ...feature.properties,
      lat: centroid?.[1] ?? null,
      lng: centroid?.[0] ?? null,
    };
  }, [data, selectedCellId]);

  const provingGroundFeature = useMemo(
    () => findProvingGroundFeature(data, caseConfig, cityLens),
    [data, caseConfig, cityLens],
  );
  // Backward-compatible alias for Medellín e2e / DecisionFlow props.
  const llanaditas = provingGroundFeature;

  const areaLabel = flow.areaId === areaId || scope === 'sandbox'
    ? (caseConfig?.focusArea ?? BRAND.provingGround)
    : (caseConfig?.city ?? 'Medellín');

  useEffect(() => {
    hydratedRef.current = false;
  }, [selectedCaseId]);

  useEffect(() => {
    if (!data || !caseConfig || hydratedRef.current) return;
    if (data.climateContext && !workspace.scenario?.climate) return;
    const fromHash = parseSessionHash(window.location.hash);
    if (!fromHash.areaId && fromHash.cellId == null && !fromHash.plan.length) {
      hydratedRef.current = true;
      return;
    }
    hydratedRef.current = true;
    const stored = readStoredSession();
    const plan = fromHash.plan.length ? fromHash.plan : stored?.plan;
    const cellId = fromHash.cellId ?? stored?.cellId ?? plan?.[0]?.cell_id ?? null;
    const sessionAreaId = fromHash.areaId === caseConfig.areaId
      ? fromHash.areaId
      : caseConfig.areaId;
    if (provingGroundFeature) setSelectedBarrio(provingGroundFeature.properties);
    if (plan?.length) {
      workspaceRef.current?.restoreSession({
        plan,
        view: stored?.view === 'user' && !fromHash.plan.length ? 'user' : 'ai',
        budgetCredits: stored?.budgetCredits,
        scenario: stored?.scenario,
        profileId: stored?.profileId,
      });
      dispatch({
        type: 'HYDRATE_SESSION',
        areaId: sessionAreaId,
        profileId: stored?.profileId,
        portfolioMode: stored?.view === 'user' && !fromHash.plan.length ? 'manual' : 'recommended',
        step: fromHash.plan.length ? 'safeguards' : (stored?.step ?? 'safeguards'),
      });
    } else {
      dispatch({ type: 'SELECT_AREA', areaId: sessionAreaId });
    }
    if (cellId != null) setSelectedCellId(cellId);
  }, [data, caseConfig, provingGroundFeature, workspace.scenario?.climate]);

  useEffect(() => {
    function onHashChange() {
      const fromHash = parseSessionHash(window.location.hash);
      if (fromHash.plan.length) {
        workspaceRef.current?.restoreSession({ plan: fromHash.plan, view: 'ai' });
        dispatch({
          type: 'HYDRATE_SESSION',
          areaId: fromHash.areaId ?? caseConfig?.areaId ?? 'llanaditas',
        });
      }
      if (fromHash.cellId != null) setSelectedCellId(fromHash.cellId);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [caseConfig?.areaId]);

  async function exportDecisionPackage(extras = {}) {
    if (!data || !workspace.metrics || !workspace.baseline || !caseConfig) return;
    const payload = buildDecisionPackage({
      scenario: workspace.scenario,
      budgetCredits: workspace.budgetCredits,
      view: workspace.view,
      cityLens,
      selectedAiProfileId: workspace.selectedAiProfileId,
      projects: workspace.activePlan,
      metrics: workspace.metrics,
      baseline: workspace.baseline,
      monteCarlo: workspace.monteCarlo,
      frontier: workspace.frontier,
      aiDiagnostics: workspace.view === 'ai' ? workspace.aiDiagnostics : null,
      alternatives: workspace.alternatives,
      stability: workspace.stability,
      pareto: workspace.pareto,
      summary: data.summary,
      evidence: data.evidence,
      community: workspace.communityAssessment,
      benchmark: workspace.benchmark,
      breakage: workspace.breakage,
      planAlignment: data.planAlignment,
      climateContext: data.climateContext,
      cells: data.cells,
      city: caseConfig.city,
      country: caseConfig.country,
      caseRole: caseConfig.hierarchyLabel,
      provingGround: caseConfig.focusArea,
      caseId: caseConfig.id,
    });
    let mapImage = null;
    let captured = null;
    try {
      captured = captureMapImage();
    } catch {
      captured = null;
    }
    if (captured?.dataUrl) {
      const bytes = jpegFromDataUrl(captured.dataUrl);
      const size = bytes ? jpegSofSize(bytes) : null;
      if (bytes && size?.width && size.height) mapImage = { bytes, width: size.width, height: size.height };
    }
    const brief = buildDecisionBrief(payload, {
      areaLabel,
      mapImage,
      cells: data.cells,
      costContext: data.costContext,
      simulatorUrl: simulatorBaseUrl(),
      aiReview: extras.aiReview ?? null,
      city: caseConfig.city,
      bbox: caseConfig.boundingArea?.sandboxBbox,
      aerialImageUrl: caseConfig.aerialImage ?? null,
    });
    const session = {
      plan: workspace.activePlan,
      view: workspace.view,
      budgetCredits: workspace.budgetCredits,
      scenario: workspace.scenario,
      profileId: workspace.selectedAiProfileId,
      cellId: selectedCellId ?? workspace.activePlan[0]?.cell_id ?? null,
      step: flow.step,
      caseId: caseConfig.id,
    };
    writeStoredSession(session);
    writeSessionHash({
      areaId: caseConfig.areaId,
      cellId: session.cellId,
      plan: workspace.activePlan,
    });
    const pdfName = `ourea_decision_brief_${caseConfig.id}.pdf`;
    try {
      brief.siteImage = await renderSitePlate(brief);
      downloadBlob(buildDecisionBriefPdf(brief), pdfName);
    } catch (error) {
      console.warn('Decision brief PDF could not be generated', error);
      try {
        downloadBlob(buildDecisionBriefPdf({ ...brief, siteImage: null }), pdfName);
      } catch (fallbackError) {
        console.warn('Text-only PDF also failed', fallbackError);
      }
    }
  }

  function resetWithinCase() {
    workspace.resetWorkspace();
    setSelectedBarrio(null);
    setSelectedCellId(null);
    setSelectedType('rwh');
    clearSessionHash();
    clearStoredSession();
    dispatch({ type: 'RESET' });
  }

  function startOver() {
    resetWithinCase();
  }

  function openChangeCity() {
    dispatch({ type: 'CLOSE_MENU' });
    setChangingCity(true);
  }

  function selectCase(caseId) {
    if (caseId === selectedCaseId) {
      setChangingCity(false);
      return;
    }
    resetWithinCase();
    setSelectedCaseId(caseId);
    setChangingCity(false);
  }

  if (loadError) throw loadError;

  const showCaseSelector = selectedCaseId == null || changingCity;
  const loadingLabel = caseConfig
    ? `Preparing the ${caseConfig.shortName} decision model…`
    : 'Preparing the decision model…';

  return (
    <div className={`app app-${flow.mode} app-step-${flow.step}`}>
      <div className="map">
        <div ref={mapNode} className="map-canvas" data-testid="map-canvas" />
        {mapStatus === 'unavailable' && (
          <div className="map-fallback" role="status" data-testid="map-fallback">
            <b>3D map unavailable in this browser</b>
            <p>
              The decision workflow remains available. Enable WebGL2 or use a compatible
              browser to view the spatial layers.
            </p>
            {mapError ? <small>{mapError}</small> : null}
          </div>
        )}
        {scope === 'sandbox' && (
          <MapLayersControl
            open={flow.layersOpen}
            layerState={layerState}
            onToggleOpen={() => dispatch({ type: 'TOGGLE_LAYERS' })}
            onToggleLayer={(key) =>
              setLayerState((current) => ({
                ...current,
                [key]: !current[key],
              }))
            }
          />
        )}
      </div>

      {!data && !showCaseSelector && (
        <div className="loading">
          <OureaLogo />
          <b>{BRAND.name}</b>
          <span>{loadingLabel}</span>
        </div>
      )}

      {showCaseSelector && (
        <CaseSelector
          overlay={Boolean(selectedCaseId)}
          selectedCaseId={selectedCaseId}
          onSelect={selectCase}
          onCancel={selectedCaseId ? () => setChangingCity(false) : null}
        />
      )}

      <TopBar
        areaLabel={areaLabel}
        caseRole={caseConfig?.hierarchyLabel}
        mode={flow.mode}
        menuOpen={flow.menuOpen}
        onToggleMenu={() => dispatch({ type: 'TOGGLE_MENU' })}
        onCloseMenu={() => dispatch({ type: 'CLOSE_MENU' })}
        onHelp={() => dispatch({ type: 'OPEN_DRAWER', drawer: 'help' })}
        onAbout={() => dispatch({ type: 'OPEN_DRAWER', drawer: 'about' })}
        onStartOver={startOver}
        onChangeCity={openChangeCity}
        onToggleExplore={() =>
          dispatch({
            type: flow.mode === 'explore' ? 'RETURN_TO_GUIDED_MODE' : 'ENTER_EXPLORE_MODE',
          })
        }
        onLoadExample={() => {
          dispatch({ type: 'CLOSE_MENU' });
          if (provingGroundFeature) setSelectedBarrio(provingGroundFeature.properties);
          dispatch({ type: 'SET_AREA', areaId });
          dispatch({ type: 'SET_LENS', cityLens: 'balanced' });
          dispatch({ type: 'GENERATION_STARTED', kind: 'example' });
          workspace.runGuidedDemo();
        }}
      />

      <div className="map-chrome-bottom-left" data-testid="map-bottom-left">
        <MapLegend
          scope={scope}
          cityLens={cityLens}
          cityLenses={caseConfig?.cityLenses}
          focusLabel={caseConfig?.focusArea}
          legendCityTitle={caseConfig?.legendCityTitle ?? null}
          legendCityNote={caseConfig?.legendCityNote}
          legendSandboxTitle={
            caseConfig?.id === CASE_IDS.NANJING
              ? (workspace.activePlan?.length
                ? (caseConfig.legendSandboxResidualNote ?? 'After plan')
                : (caseConfig.legendSandboxBaselineNote ?? 'Baseline'))
              : caseConfig?.legendSandboxTitle
          }
          legendSandboxNote={caseConfig?.legendSandboxNote}
          collapsed={flow.legendCollapsed}
          onToggle={() => dispatch({ type: 'TOGGLE_LEGEND' })}
        />
      </div>

      {data && caseConfig && !showCaseSelector ? (
        <DemoGuide step={flow.step} visible={flow.mode === 'guided'} />
      ) : null}

      {data && caseConfig && !showCaseSelector && (
        <DecisionFlow
          state={flow}
          dispatch={dispatch}
          data={data}
          workspace={workspace}
          caseConfig={caseConfig}
          selectedBarrio={selectedBarrio}
          llanaditas={llanaditas}
          provingGroundFeature={provingGroundFeature}
          selectedType={selectedType}
          selectedCell={selectedCell}
          selectedCellId={selectedCellId}
          onSelectType={setSelectedType}
          onSelectCell={onSelectCell}
          onSelectBarrio={setSelectedBarrio}
          onExport={exportDecisionPackage}
        />
      )}
    </div>
  );
}
