import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ChevronLeft, ChevronRight, CloudRain, Database, FileDown, Info,
  Layers, Leaf, Map as MapIcon, MessageCircle, ShieldCheck, Target, TriangleAlert,
} from 'lucide-react';
import { OureaLogo } from './components/OureaLogo.jsx';
import { analyzeCorridor, bundleDataset } from './domain/cornareDecision.js';
import { comparisonCards } from './domain/comparison.js';
import { CLASS_LABELS, NBS_LABELS, STRESS_LABELS } from './domain/evidence.js';
import { dimensionName } from './domain/explanations.js';
import { regionalPressure, scenarioName, scoreBreakdown, stressSentence } from './domain/decisionSummary.js';
import { copM, esNumber, esPct, joinEs, plural } from './domain/format.js';
import { ROBUSTNESS_MEANING } from './domain/robustness.js';
import { CLASS_COLOR, STEPS, copMillions } from './cornare/copy.js';
import { CalculationGuide } from './cornare/CalculationGuide.jsx';
import { DecisionMatrix } from './cornare/DecisionMatrix.jsx';
import { DecisionMap } from './cornare/map/DecisionMap.jsx';
import { focusForMeasure } from './cornare/map/focus.js';
import { downloadDecisionJson, downloadPitchPdf } from './cornare/exportDecision.js';
import { loadCornareData } from './cornare/loadData.js';
import { EngineAnnex, GapRanking, LeverGrid, RobustnessStep } from './cornare/EnginePanels.jsx';
import { buildProducts } from './cornare/products.js';
import { serviceHealth } from './cornare/ai/client.js';
import { AuditBadge } from './cornare/ai/AuditBadge.jsx';
import { CopilotDrawer } from './cornare/ai/CopilotDrawer.jsx';
import { InterviewDemo } from './cornare/ai/InterviewDemo.jsx';

const ICONS = {
  territory: MapIcon,
  priority: Target,
  portfolio: Layers,
  horizon: CloudRain,
  robustness: ShieldCheck,
  residual: TriangleAlert,
  followup: Activity,
};

const RANK = { muy_alta: 5, alta: 4, media: 3, baja: 2, muy_baja: 1 };

const READINESS = {
  bio_pa: 'Tiene precedente: CORNARE reporta un SIRAP consolidado. El predio del corredor sigue por validar.',
  bio_psa: 'Tiene precedente regional. El arreglo del corredor sigue por validar.',
  water_eff: 'Tiene precedente: los referentes 2024–2027 nombran las fuentes del acueducto. La obra no está localizada.',
  hab_green: 'Requiere validación de sitio.',
  health: 'Requiere arreglo institucional.',
  risk_knowledge: 'Requiere arreglo institucional.',
  food_agro: 'Requiere caracterización local.',
};

function capitalize(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

export default function App() {
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('territory');
  const [drawer, setDrawer] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [dimensionId, setDimensionId] = useState('biodiversity');
  const [metric, setMetric] = useState('vulnerability');
  const [selectedMunicipality, setSelectedMunicipality] = useState(null);
  const [horizon, setHorizon] = useState('reference');
  const [openWhy, setOpenWhy] = useState(null);
  // The local decision AI service (services/decision_ai). null on Pages or when it does not answer.
  const [service, setService] = useState(null);
  const [copilotFocusId, setCopilotFocusId] = useState(null);

  useEffect(() => {
    loadCornareData().then(setRaw).catch((cause) => setError(cause.message));
    serviceHealth().then(setService);
  }, []);

  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setDrawer(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

  useEffect(() => {
    if (!exportOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setExportOpen(false);
    };
    const onClick = (event) => {
      if (!event.target.closest?.('.export-menu-wrap')) setExportOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  }, [exportOpen]);

  const dataset = useMemo(() => (raw ? bundleDataset({
    interventions: raw.interventions,
    metrics: raw.metrics,
    history: raw.history,
    parameters: raw.parameters,
    gaps: raw.gaps,
    mea: raw.mea,
    profiles: raw.profiles,
  }) : null), [raw]);
  const analysis = useMemo(() => (dataset ? analyzeCorridor(dataset) : null), [dataset]);
  const auditProducts = useMemo(() => (analysis && raw ? buildProducts(analysis, raw) : null), [analysis, raw]);
  const [focusId, setFocusId] = useState(null);

  if (error) {
    return <main className="fatal-error"><h1>No se pudieron cargar los datos de CORNARE.</h1><p>{error}</p></main>;
  }
  if (!analysis || !raw) {
    return <main className="boot"><p>Cargando la decisión del corredor…</p></main>;
  }

  const budget = analysis.parameters.budget_million_cop;
  const activeFocusId = focusId ?? analysis.portfolio.measures[0]?.id;
  const focused = analysis.portfolio.measures.find((measure) => measure.id === activeFocusId) ?? null;
  const copilotMeasure = copilotFocusId ? analysis.byId.get(copilotFocusId) : null;
  const focus = copilotMeasure
    ? focusForMeasure(copilotMeasure)
    : step === 'portfolio' && focused ? focusForMeasure(focused) : null;
  const shift = analysis.parameters.ssp;
  const mapDimension = step === 'horizon' ? shift.dimension_id : dimensionId;
  const mapMetric = step === 'horizon' ? shift.metric : metric;
  const mapScenario = step === 'horizon' && horizon === '2060' ? shift.scenario : 'reference';
  const colors = colorsFor(raw, mapDimension, mapMetric, mapScenario);
  const legendLabels = legendFor(raw, mapDimension, mapMetric, mapScenario);
  const selectedIds = focus?.municipalityIds ?? (selectedMunicipality ? [selectedMunicipality] : []);
  // The robustness step needs the precomputed engine output; without it the step is hidden.
  const steps = STEPS.filter((item) => item.id !== 'robustness' || raw.engine.robustness);
  const stepIndex = steps.findIndex((item) => item.id === step);
  const StepIcon = ICONS[step];
  const goTo = (id) => {
    setCopilotFocusId(null);
    setStep(id);
  };
  const exportPdf = () => { downloadPitchPdf(analysis).catch(() => {}); };
  const exportJson = () => downloadDecisionJson(analysis, auditProducts);

  return (
    <div className="shell">
      <header className="shell-header">
        <div className="shell-brand">
          <OureaLogo compact />
          <div>
            <h1 data-testid="app-title">Ourea</h1>
            <p className="shell-place">{raw.profiles.municipalities.map((item) => item.name).join(' · ')}</p>
          </div>
        </div>
        <p className="budget-pill" data-testid="budget-pill">COP {esNumber(budget)} M</p>
        <div className="shell-actions">
          <button type="button" data-testid="open-sources" aria-label="Fuentes" onClick={() => setDrawer('sources')}><Database size={16} /> <span className="action-label">Fuentes</span></button>
          {service?.ai_enabled && (
            <button type="button" data-testid="open-copilot" aria-label="Preguntar" onClick={() => setDrawer('copilot')}><MessageCircle size={16} /> <span className="action-label">Preguntar</span></button>
          )}
          <button type="button" data-testid="open-method" aria-label="Método" onClick={() => setDrawer('method')}><Info size={16} /> <span className="action-label">Método</span></button>
          <div className="export-menu-wrap">
            <button
              type="button"
              data-testid="open-export"
              aria-label="Exportar"
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              onClick={() => setExportOpen((open) => !open)}
            >
              <FileDown size={16} /> <span className="action-label">Exportar</span>
            </button>
            {exportOpen && (
              <div className="export-menu" role="menu">
                <button type="button" role="menuitem" data-testid="export-pdf-menu" onClick={() => { setExportOpen(false); exportPdf(); }}>
                  <strong>Resumen PDF</strong><span>Para presentar la decisión</span>
                </button>
                <button type="button" role="menuitem" data-testid="export-json" onClick={() => { setExportOpen(false); exportJson(); }}>
                  <strong>Datos JSON</strong><span>Decisión, puntajes y auditoría</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="shell-body">
        <div className="shell-map">
          <DecisionMap
            boundaries={raw.boundaries}
            colors={colors}
            legendLabels={legendLabels}
            selectedIds={selectedIds}
            focus={focus}
            onMunicipality={setSelectedMunicipality}
            shadingLabel={shadingLabel(step, mapMetric, mapDimension, horizon, analysis)}
          />
        </div>
        <aside className="shell-panel" data-testid={`step-${step}`}>
          <div className="panel-scroll">
            <p className="panel-kicker">Paso {stepIndex + 1} de {steps.length}</p>
            <h2><StepIcon size={18} /> {steps[stepIndex].title}</h2>
            {step === 'territory' && (
              <Territory
                raw={raw}
                analysis={analysis}
                dimensionId={dimensionId}
                setDimensionId={setDimensionId}
                metric={metric}
                setMetric={setMetric}
                selectedMunicipality={selectedMunicipality}
                setSelectedMunicipality={setSelectedMunicipality}
              />
            )}
            {step === 'priority' && <Priority analysis={analysis} onMatrix={() => setDrawer('matrix')} onMethod={() => setDrawer('method')} />}
            {step === 'portfolio' && (
              <Portfolio
                analysis={analysis}
                raw={raw}
                focusId={activeFocusId}
                setFocusId={(id) => {
                  setCopilotFocusId(null);
                  setFocusId(id);
                }}
                openWhy={openWhy}
                setOpenWhy={setOpenWhy}
                onCompare={() => setDrawer('compare')}
              />
            )}
            {step === 'horizon' && <Horizon analysis={analysis} horizon={horizon} setHorizon={setHorizon} />}
            {step === 'robustness' && (
              <>
                <RobustnessStep engine={raw.engine} analysis={analysis} />
                <LeverGrid levers={raw.engine.levers} municipalities={raw.profiles.municipalities} dimensions={raw.interventions.dimensions} />
                <GapRanking voi={raw.engine.voi} prepared={analysis.prepared} ranges={raw.engine.ranges} gaps={analysis.gaps} />
              </>
            )}
            {step === 'residual' && (
              <>
                <Residual analysis={analysis} />
                {service?.ai_enabled && <InterviewDemo />}
              </>
            )}
            {step === 'followup' && (
              <Followup
                analysis={analysis}
                engine={raw.engine}
                onPdf={exportPdf}
                onJson={exportJson}
                audit={<AuditBadge service={service} bundle={auditProducts} />}
              />
            )}
          </div>
          <div className="panel-actions">
            <button type="button" data-testid="step-back" disabled={stepIndex === 0} onClick={() => goTo(steps[stepIndex - 1].id)}>
              <ChevronLeft size={16} /> Atrás
            </button>
            <button type="button" data-testid="step-next" disabled={stepIndex === steps.length - 1} onClick={() => goTo(steps[stepIndex + 1].id)}>
              Continuar <ChevronRight size={16} />
            </button>
          </div>
        </aside>
      </div>
      {drawer && (
        <div className="drawer-backdrop" onClick={() => setDrawer(null)}>
          <div className={drawer === 'matrix' || drawer === 'method' ? 'drawer drawer-wide' : 'drawer'} data-testid={`${drawer}-drawer`} onClick={(event) => event.stopPropagation()}>
            <button type="button" data-testid="drawer-close" autoFocus onClick={() => setDrawer(null)}>Cerrar</button>
            {drawer === 'sources' && <Sources raw={raw} />}
            {drawer === 'method' && <CalculationGuide analysis={analysis} />}
            {drawer === 'compare' && <Compare analysis={analysis} />}
            {drawer === 'matrix' && <DecisionMatrix rows={analysis.matrix.rows} />}
            {drawer === 'copilot' && (
              <CopilotDrawer
                gaps={analysis.gaps}
                onFocus={(id, close) => {
                  setCopilotFocusId(id);
                  if (close) setDrawer(null);
                }}
                onGap={() => {
                  setDrawer(null);
                  goTo('residual');
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Territory({ raw, analysis, dimensionId, setDimensionId, metric, setMetric, selectedMunicipality, setSelectedMunicipality }) {
  const pressure = regionalPressure(raw.metrics.metrics, raw.profiles.municipalities, raw.interventions.dimensions);
  return (
    <>
      <p className="panel-lead">
        El color muestra la clase de {metric === 'risk' ? 'riesgo' : 'vulnerabilidad'} de cada municipio en la dimensión elegida.
        {' '}La clase de vulnerabilidad del estudio de CORNARE pesa {esPct(analysis.parameters.weights.vulnerability)} en la decisión.
      </p>
      <div className="pill-row" role="group" aria-label="Métrica">
        {[['vulnerability', 'Vulnerabilidad'], ['risk', 'Riesgo']].map(([id, label]) => (
          <button key={id} type="button" className={metric === id ? 'is-active' : ''} onClick={() => setMetric(id)}>{label}</button>
        ))}
      </div>
      <div className="pill-row" role="group" aria-label="Dimensión del mapa">
        {raw.interventions.dimensions.map((dimension) => (
          <button key={dimension.id} type="button" className={dimensionId === dimension.id ? 'is-active' : ''} onClick={() => setDimensionId(dimension.id)}>
            {dimension.short_name}
          </button>
        ))}
      </div>
      {raw.profiles.municipalities.map((municipality) => {
        const lead = leadClass(raw, municipality.id);
        const brief = raw.context?.municipalities?.find((item) => item.municipality_id === municipality.id)?.brief;
        return (
          <div key={municipality.id}>
            <button
              type="button"
              className={selectedMunicipality === municipality.id ? 'place-row is-active' : 'place-row'}
              onClick={() => setSelectedMunicipality(municipality.id)}
            >
              <MapIcon size={16} />
              <span><strong>{municipality.name}</strong><span>Clase más alta: {lead.label}</span></span>
            </button>
            {selectedMunicipality === municipality.id && brief && <p className="panel-lead">{brief}</p>}
          </div>
        );
      })}
      {pressure && (
        <article className="insight">
          <Leaf size={16} />
          <div>
            <strong>{pressure.title}</strong>
            <p>{pressure.detail}</p>
          </div>
        </article>
      )}
    </>
  );
}

function Priority({ analysis, onMatrix, onMethod }) {
  const { parameters } = analysis;
  const weights = parameters.weights;
  const budget = parameters.budget_million_cop;
  const candidates = analysis.prepared.length;
  const selected = analysis.portfolio.measures.length;
  return (
    <>
      <p className="panel-lead">
        Cada medida recibe un puntaje con los pesos de CORNARE: {esPct(weights.vulnerability)} vulnerabilidad, {esPct(weights.recurrence)} recurrencia de acciones
        {' '}y {esPct(weights.workshops)} talleres municipales, este último sin datos. Ourea prueba las {esNumber(2 ** candidates)} combinaciones
        {' '}y financia la que más suma sin pasar de {copM(budget)}.
      </p>
      <ul className="summary-chips">
        <li>{esNumber(candidates)} medidas</li>
        <li>{copM(budget)}</li>
        <li>{esNumber(2 ** candidates)} combinaciones</li>
        <li>{esNumber(selected)} seleccionadas</li>
      </ul>
      <DecisionMatrix rows={analysis.matrix.rows} compact secondShare={parameters.diminishing_second_measure.institucional} />
      <div className="priority-actions">
        <button type="button" data-testid="open-matrix" onClick={onMatrix}>Ver matriz completa</button>
        <button type="button" className="text-button" data-testid="open-calc" onClick={onMethod}>¿Cómo se calcula?</button>
      </div>
    </>
  );
}

function DecisionSummary({ summary }) {
  return (
    <article className="summary-card" data-testid="decision-summary">
      <dl>
        <dt>Qué financiamos</dt><dd>{summary.decided}</dd>
        <dt>Por qué</dt><dd>{summary.why}</dd>
        <dt>Qué tan estable es</dt><dd>{summary.stable}</dd>
        <dt>Qué lo cambiaría</dt><dd>{summary.change}</dd>
      </dl>
    </article>
  );
}

function Portfolio({ analysis, raw, focusId, setFocusId, openWhy, setOpenWhy, onCompare }) {
  const used = analysis.portfolio.cost;
  const budget = analysis.parameters.budget_million_cop;
  const fichas = new Map((raw.fichas?.measures ?? []).map((item) => [item.id, item]));
  return (
    <>
      <DecisionSummary summary={analysis.summary} />
      <div className="budget-block">
        <p data-testid="budget-used">COP {esNumber(used)} M / COP {esNumber(budget)} M</p>
        <div className="budget-track" aria-hidden="true"><i style={{ width: `${(used / budget) * 100}%` }} /></div>
        <p><span data-testid="budget-remaining">{esNumber(analysis.portfolio.remaining)}</span> M disponibles</p>
      </div>
      <div className="portfolio-head">
        <p className="fine">Ordenadas por aporte al puntaje del portafolio.</p>
        <button type="button" data-testid="open-compare" onClick={onCompare}>Comparar alternativas</button>
      </div>
      <div data-testid="portfolio-list">
        {analysis.portfolio.measures.map((measure) => (
          <article key={measure.id} className={measure.id === focusId ? 'measure-row is-active' : 'measure-row'} data-testid={`measure-${measure.id}`}>
            <div className="measure-icon"><Leaf size={16} /></div>
            <div className="measure-main">
              <strong>{measure.name}</strong>
              <p>{measure.place.localization} · {copMillions(measure.cost)}</p>
              <p>{shortDimension(raw, measure.dimensionId)} · {measure.classificationLabel} · {NBS_LABELS[measure.nbsClass]} · aporte {esNumber(measure.part.contribution, 3)}</p>
            </div>
            <div className="measure-actions">
              <button type="button" data-testid={`map-focus-${measure.id}`} onClick={() => setFocusId(measure.id)}>Mapa</button>
              <button type="button" data-testid={`why-${measure.id}`} aria-expanded={openWhy === measure.id} onClick={() => setOpenWhy(openWhy === measure.id ? null : measure.id)}>Por qué</button>
            </div>
            {openWhy === measure.id && <MeasureWhy measure={measure} analysis={analysis} ficha={fichas.get(measure.id)} />}
          </article>
        ))}
      </div>
      <Hinges hinges={analysis.hinges} range={analysis.parameters.weights.workshops} />
    </>
  );
}

function MeasureWhy({ measure, analysis, ficha }) {
  const breakdown = scoreBreakdown(measure, measure.part, analysis.parameters, analysis.profiles);
  const sensitivity = measure.sensitivity_factors_addressed ?? [];
  const capacity = measure.adaptive_capacity_factors_strengthened ?? [];
  return (
    <div className="measure-why">
      <h4>Cómo suma al puntaje</h4>
      <table className="score-table">
        <tbody>
          {breakdown.rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.detail}</td>
              <td className="num">{row.value == null ? '—' : esNumber(row.value, 3)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={2}>{breakdown.totalLabel}</th>
            <td className="num">{esNumber(breakdown.total, 3)}</td>
          </tr>
        </tfoot>
      </table>
      {(sensitivity.length > 0 || capacity.length > 0) && (
        <>
          <h4>Qué busca cambiar</h4>
          <ul>
            {sensitivity.length > 0 && <li>Reducir sensibilidad: {sensitivity.join('; ')}.</li>}
            {capacity.length > 0 && <li>Fortalecer capacidad adaptativa: {capacity.join('; ')}.</li>}
          </ul>
        </>
      )}
      <h4>Dónde y en qué estado</h4>
      <ul>
        <li>
          {measure.place.localization}{measure.scope === 'corridor' ? ` (la dispara ${measure.place.trigger})` : ''}.
          {' '}{focusForMeasure(measure).exactLocation}. No es un predio seleccionado.
        </li>
        {ficha?.status && <li>Precedente institucional: {ficha.status.length > 180 ? `${ficha.status.slice(0, 180)}…` : ficha.status}</li>}
        <li>{READINESS[measure.id] ?? 'Requiere caracterización local.'}</li>
      </ul>
    </div>
  );
}

function Hinges({ hinges, range }) {
  if (!hinges.length) return null;
  return (
    <section className="hinge-section" data-testid="decision-hinge">
      <h3>¿Qué podría cambiar esta decisión?</h3>
      <p className="fine">
        Las alternativas más cercanas y cuántos puntos les faltan. La recurrencia en talleres municipales podría sumar
        {' '}entre 0 y {esNumber(range, 2)} por medida y aún no tiene datos.
      </p>
      {hinges.map((hinge) => (
        <article key={hinge.id} className="hinge-card">
          <p className="hinge-head">
            <strong>{hinge.name}</strong>
            <span className={`band band-${hinge.band}`}>{hinge.label}</span>
          </p>
          <p>Queda a {hinge.gapDisplay} puntos del portafolio elegido. {hinge.sentence}</p>
          <p className="fine">Datos que lo resolverían: {hinge.criteria.map((criterion) => criterion.label.toLowerCase()).join('; ')}.</p>
        </article>
      ))}
      <p className="fine">{hinges[0].thresholds} {hinges[0].assignment}</p>
    </section>
  );
}

function Horizon({ analysis, horizon, setHorizon }) {
  const { stress } = analysis;
  const scenario = scenarioName(stress.shift);
  const sentence = stressSentence(stress, analysis.profiles);
  const signalCount = stress.evidencedDimensions.length;
  const names = (ids) => joinEs(ids.map((id) => analysis.byId.get(id)?.name ?? id));
  return (
    <>
      <div className="scenario-switch" role="group" aria-label="Escenario">
        <button type="button" className={horizon === 'reference' ? 'is-active' : ''} onClick={() => setHorizon('reference')}>Referencia</button>
        <button type="button" data-testid="scenario-2060" className={horizon === '2060' ? 'is-active' : ''} onClick={() => setHorizon('2060')}>{scenario} · {stress.shift.year}</button>
      </div>
      <p data-testid="stress-status" className={`status status-${stress.status}`} title={ROBUSTNESS_MEANING}>{STRESS_LABELS[stress.status]}</p>
      <p className="fine" data-testid="stress-meaning">{ROBUSTNESS_MEANING}</p>
      <section className="panel-section">
        <h3>Qué cambia en el escenario</h3>
        <p>{capitalize(sentence.full)}. Es el único cambio cuantificado para {scenario} en el reto.</p>
        <p className="fine">
          Ourea lo aplica como un escalón de clase sobre las medidas de {dimensionName(stress.shift.dimension_id)} y vuelve a resolver el portafolio.
          {' '}Esa lectura es una inferencia del equipo.
        </p>
        <h3>Resultado</h3>
        <p data-testid="stress-outcome">
          {stress.sameSet ? 'El portafolio no cambia ante el cambio cuantificado' : 'El portafolio cambia ante el cambio cuantificado'}.
          {' '}El puntaje pasa de {esNumber(analysis.portfolio.institucional.objective, 4)} a {esNumber(stress.portfolio.institucional.objective, 4)}.
        </p>
        {!stress.sameSet && <p>Entran: {names(stress.entered) || 'ninguna'}. Salen: {names(stress.exited) || 'ninguna'}.</p>}
      </section>
      <section className="panel-section" data-testid="stress-coverage">
        <h3>Cobertura del stress test</h3>
        <p>{signalCount === 1 ? '1 señal cuantificada' : `${signalCount} señales cuantificadas`}: {sentence.place} · {dimensionName(stress.shift.dimension_id)}.</p>
        <p>Otras dimensiones: Integración de escenario requerida. Sin esas series el estado no puede pasar de «{STRESS_LABELS.MAYORMENTE_ROBUSTA}».</p>
      </section>
      <section className="panel-section" data-testid="robustness-panel">
        <h3>Estable ante</h3>
        <ul>{analysis.robustness.stable.map((line) => <li key={line}>{line}</li>)}</ul>
        <h3>Sensible a</h3>
        <ul>{analysis.robustness.sensitive.map((line) => <li key={line}>{line}</li>)}</ul>
      </section>
      <section className="panel-section" data-testid="pathway-panel">
        <h3>Qué monitorear</h3>
        <ul>
          {analysis.pathways.map((path) => (
            <li key={path.dimensionId}><strong>{capitalize(path.dimension)}</strong>: {path.current}. Indicador: {path.monitor}.</li>
          ))}
        </ul>
        <p className="fine">Los umbrales que dispararían una reevaluación están por acordar con CORNARE.</p>
      </section>
    </>
  );
}

function Residual({ analysis }) {
  const addressed = analysis.residual.rows.filter((row) => row.addressed);
  const open = analysis.residual.rows.filter((row) => !row.addressed);
  return (
    <>
      <p className="panel-lead">{analysis.residual.reminder}</p>
      <h3>Sigue sin medida</h3>
      <ul>{open.map((row) => <li key={row.dimensionId}><strong>{capitalize(dimensionName(row.dimensionId))}</strong>: {row.statement}</li>)}</ul>
      <h3>Con medida, sin declararse resuelta</h3>
      <ul>{addressed.map((row) => <li key={row.dimensionId}><strong>{capitalize(dimensionName(row.dimensionId))}</strong>: {row.statement}</li>)}</ul>
      <h3>Datos que faltan para cerrar la decisión</h3>
      <ul>
        {analysis.gaps.slice(0, 3).map((gap) => (
          <li key={gap.id}>
            {gap.missing_information}.{gap.responsible_actor_if_known ? ` Responsable: ${gap.responsible_actor_if_known}.` : ''}
          </li>
        ))}
      </ul>
    </>
  );
}

function Followup({ analysis, engine, audit, onPdf, onJson }) {
  const indicators = analysis.mea.indicators ?? [];
  const context = analysis.mea.regional_context;
  return (
    <>
      <p className="panel-lead">{context.statement} {context.use}</p>
      <section className="panel-section" data-testid="mea-indicators">
        <h3>Qué medir en cada medida</h3>
        {analysis.portfolio.measures.map((measure) => {
          const product = indicators.find((item) => item.intervention_id === measure.id && item.indicator_type === 'producto');
          const outcome = indicators.find((item) => item.intervention_id === measure.id && item.indicator_type === 'resultado');
          const sensitivity = measure.sensitivity_factors_addressed ?? [];
          const capacity = measure.adaptive_capacity_factors_strengthened ?? [];
          return (
            <article key={measure.id} className="indicator-card">
              <strong>{measure.name}</strong>
              <dl>
                <dt>Producto</dt><dd>{product?.name ?? 'Indicador por definir'}</dd>
                <dt>Sensibilidad que debería bajar</dt><dd>{sensitivity.length ? sensitivity.join('; ') : 'No se le atribuye'}</dd>
                <dt>Capacidad que debería subir</dt><dd>{capacity.length ? capacity.join('; ') : 'No se le atribuye'}</dd>
                <dt>Línea base y meta</dt><dd>{capitalize((outcome?.target_status ?? 'Por definir').toLowerCase())}</dd>
              </dl>
            </article>
          );
        })}
        <p className="fine">
          Para ver el cambio en vulnerabilidad, CORNARE repite el cálculo de la clase de cada dimensión con la misma ficha
          {' '}y lo compara con la línea base. Ourea no le atribuye a una medida una cifra de reducción.
        </p>
      </section>
      <section className="panel-section" data-testid="nbs-screen">
        <h3>Screening NbS, no es certificación</h3>
        {analysis.nbsScreen.map((item) => {
          const supported = item.criteria.filter((criterion) => criterion.status === 'SUPPORTED').length;
          const pending = item.criteria.filter((criterion) => criterion.status === 'TO VALIDATE').length;
          return (
            <div key={item.id}>
              <p><strong>{item.name}</strong> · {plural(supported, 'criterio')} con soporte · {esNumber(pending)} por validar</p>
              <p className="fine">{item.standard}</p>
              <details>
                <summary>Criterios y procedencia</summary>
                {item.criteria.map((criterion) => (
                  <p key={criterion.id}>{criterion.label}: {criterion.statusLabel} · {criterion.source}</p>
                ))}
              </details>
            </div>
          );
        })}
      </section>
      <section className="close-card" data-testid="decision-close">
        <h3>La decisión</h3>
        <p data-testid="decision-line">{analysis.summary.sentence}</p>
        <div className="close-actions">
          <button type="button" className="primary-action" data-testid="export-pdf" onClick={onPdf}>Descargar PDF</button>
          <button type="button" data-testid="export-json-close" onClick={onJson}>Descargar datos (JSON)</button>
        </div>
        <p className="fine">
          Huella {analysis.fingerprint}: identifica esta decisión (conjunto, costo, presupuesto y pesos).
          {' '}Si cambia un dato o un peso, cambia la huella.
        </p>
        {audit}
      </section>
      {engine.robustness && engine.ranges && (
        <details className="more">
          <summary>Anexo técnico de la simulación</summary>
          <EngineAnnex engine={engine} />
        </details>
      )}
    </>
  );
}

function Sources({ raw }) {
  const sources = (raw.sources?.sources ?? []).slice(0, 8);
  return (
    <>
      <h2>Fuentes de esta decisión</h2>
      <ul>
        {sources.map((source) => <li key={source.id}>{source.institution} · {source.title}</li>)}
        <li>CORNARE, fichas de adaptación regionales, 2026. Solo explican el estado institucional.</li>
      </ul>
    </>
  );
}

function Compare({ analysis }) {
  const cards = comparisonCards(analysis);
  return (
    <>
      <h2>Comparar alternativas</h2>
      <p className="fine">
        El puntaje institucional verificado (pesos de CORNARE) es la métrica común. El objetivo propio de cada lente se muestra aparte
        {' '}y no se compara en la misma columna.
      </p>
      <div className="compare-grid">
        {cards.map((card) => (
          <article key={card.id} data-testid={`compare-${card.id}`}>
            <h3>{card.title}</h3>
            <p>{copM(card.cost)} · {plural(card.measures.length, 'medida')}</p>
            <p className="compare-metric" data-testid={`compare-institutional-${card.id}`}>Puntaje institucional verificado: {esNumber(card.institutional, 4)}</p>
            {card.lens && (
              <p className="compare-lens" data-testid={`compare-lens-${card.id}`}>
                {card.lens.label}: {esNumber(card.lens.value, 4)}
                <span className="fine"> {card.lens.note}</span>
              </p>
            )}
            {card.note && <p className="fine">{card.note}</p>}
            {card.difference && (
              <p className="compare-diff">
                {card.difference.enter.length ? `Entra: ${joinEs(card.difference.enter)}. ` : ''}
                {card.difference.leave.length ? `Sale: ${joinEs(card.difference.leave)}.` : ''}
              </p>
            )}
            <ul className="compare-measures">{card.measures.map((name) => <li key={name}>{name}</li>)}</ul>
          </article>
        ))}
      </div>
    </>
  );
}

function shadingLabel(step, metric, dimensionId, horizon, analysis) {
  const shift = analysis.parameters.ssp;
  if (step === 'horizon' && horizon === '2060') {
    const place = analysis.profiles.find((item) => item.id === shift.municipality_id)?.name ?? shift.municipality_id;
    return `${capitalize(dimensionName(shift.dimension_id))} hacia ${shift.year}. Solo ${place} tiene el cambio cuantificado.`;
  }
  if (step === 'portfolio') return 'El resalte es el ámbito de la medida. La ubicación de la obra sigue por validar.';
  const metricLabel = metric === 'risk' ? 'riesgo' : 'vulnerabilidad';
  return `Color municipal de ${metricLabel} en ${dimensionName(dimensionId)}. Sigue siendo un dato municipal.`;
}

function colorsFor(raw, dimensionId, metric, scenario) {
  return Object.fromEntries(raw.profiles.municipalities.map((municipality) => {
    const cell = cellFor(raw.metrics.metrics, municipality.id, dimensionId, metric, scenario);
    return [municipality.id, CLASS_COLOR[cell?.classification] ?? CLASS_COLOR.missing];
  }));
}

// The class each municipality shows on the map, for the legend: "Rionegro · Muy alta".
function legendFor(raw, dimensionId, metric, scenario) {
  return Object.fromEntries(raw.profiles.municipalities.map((municipality) => {
    const cell = cellFor(raw.metrics.metrics, municipality.id, dimensionId, metric, scenario);
    const label = cell?.classification ? (cell.classification_label ?? CLASS_LABELS[cell.classification]) : 'sin dato';
    return [municipality.id, label];
  }));
}

function cellFor(metrics, municipalityId, dimensionId, metric, scenario) {
  const rows = metrics.filter((row) => (
    row.municipality_id === municipalityId
    && row.dimension_id === dimensionId
    && row.metric === metric
    && row.scenario === scenario
  ));
  if (metric === 'vulnerability') return rows.find((row) => row.value == null && row.classification) ?? rows[0] ?? null;
  return rows.find((row) => row.value != null || row.classification) ?? null;
}

function leadClass(raw, municipalityId) {
  const rows = raw.metrics.metrics.filter((row) => (
    row.municipality_id === municipalityId
    && row.metric === 'vulnerability'
    && row.scenario === 'reference'
    && row.value == null
    && row.classification
  ));
  const best = rows.slice().sort((left, right) => (RANK[right.classification] ?? 0) - (RANK[left.classification] ?? 0))[0];
  if (!best) return { label: 'Validación requerida' };
  const dimension = raw.interventions.dimensions.find((item) => item.id === best.dimension_id);
  return { label: `${dimension?.short_name ?? best.dimension_id} · ${best.classification_label}` };
}

function shortDimension(raw, id) {
  return raw.interventions.dimensions.find((item) => item.id === id)?.short_name ?? dimensionName(id);
}
