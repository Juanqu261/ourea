import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ChevronLeft, ChevronRight, CloudRain, Database, FileDown, Info,
  Layers, Leaf, Map as MapIcon, ShieldCheck, Target, TriangleAlert,
} from 'lucide-react';
import { OureaLogo } from './components/OureaLogo.jsx';
import { analyzeCorridor, bundleDataset } from './domain/cornareDecision.js';
import { comparisonCards } from './domain/comparison.js';
import { NBS_LABELS, STRESS_LABELS } from './domain/evidence.js';
import { dimensionName } from './domain/explanations.js';
import { ROBUSTNESS_MEANING } from './domain/robustness.js';
import { CLASS_COLOR, STEPS, copMillions } from './cornare/copy.js';
import { DecisionMatrix } from './cornare/DecisionMatrix.jsx';
import { DecisionMap } from './cornare/map/DecisionMap.jsx';
import { focusForMeasure } from './cornare/map/focus.js';
import { downloadDecisionJson, downloadPitchPdf } from './cornare/exportDecision.js';
import { loadCornareData } from './cornare/loadData.js';
import { EngineAnnex, GapRanking, LeverGrid, RobustnessStep } from './cornare/EnginePanels.jsx';

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

export default function App() {
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('territory');
  const [drawer, setDrawer] = useState(null);
  const [dimensionId, setDimensionId] = useState('biodiversity');
  const [metric, setMetric] = useState('vulnerability');
  const [selectedMunicipality, setSelectedMunicipality] = useState(null);
  const [horizon, setHorizon] = useState('reference');
  const [openWhy, setOpenWhy] = useState(null);

  useEffect(() => {
    loadCornareData().then(setRaw).catch((cause) => setError(cause.message));
  }, []);

  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setDrawer(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

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
  const [focusId, setFocusId] = useState(null);

  if (error) {
    return <main className="fatal-error"><h1>No se pudieron cargar los datos de CORNARE.</h1><p>{error}</p></main>;
  }
  if (!analysis || !raw) {
    return <main className="boot"><p>Cargando la decisión del corredor…</p></main>;
  }

  const activeFocusId = focusId ?? analysis.portfolio.measures[0]?.id;
  const focused = analysis.portfolio.measures.find((measure) => measure.id === activeFocusId) ?? null;
  const focus = step === 'portfolio' && focused ? focusForMeasure(focused) : null;
  const mapDimension = step === 'horizon' ? 'disaster' : dimensionId;
  const mapMetric = step === 'horizon' ? 'risk' : metric;
  const mapScenario = step === 'horizon' && horizon === '2060' ? 'ssp3_7_0' : 'reference';
  const colors = colorsFor(raw, mapDimension, mapMetric, mapScenario);
  const selectedIds = focus?.municipalityIds ?? (selectedMunicipality ? [selectedMunicipality] : []);
  // The robustness step needs the precomputed engine output; without it the step is hidden.
  const steps = STEPS.filter((item) => item.id !== 'robustness' || raw.engine.robustness);
  const stepIndex = steps.findIndex((item) => item.id === step);
  const StepIcon = ICONS[step];

  return (
    <div className="shell">
      <header className="shell-header">
        <div className="shell-brand">
          <OureaLogo compact />
          <div>
            <h1 data-testid="app-title">Ourea</h1>
            <p className="shell-place">Rionegro · Guarne · Marinilla</p>
          </div>
        </div>
        <p className="budget-pill" data-testid="budget-pill">COP 5.000 M</p>
        <div className="shell-actions">
          <button type="button" data-testid="open-sources" aria-label="Fuentes" onClick={() => setDrawer('sources')}><Database size={16} /> <span className="action-label">Fuentes</span></button>
          <button type="button" data-testid="open-method" aria-label="Método" onClick={() => setDrawer('method')}><Info size={16} /> <span className="action-label">Método</span></button>
          <button type="button" data-testid="export-json" aria-label="Exportar" onClick={() => downloadDecisionJson(analysis)}><FileDown size={16} /> <span className="action-label">Exportar</span></button>
        </div>
      </header>
      <div className="shell-body">
        <div className="shell-map">
          <DecisionMap
            boundaries={raw.boundaries}
            colors={colors}
            selectedIds={selectedIds}
            focus={focus}
            onMunicipality={setSelectedMunicipality}
            shadingLabel={shadingLabel(step, mapMetric, mapDimension, horizon)}
          />
        </div>
        <aside className="shell-panel" data-testid={`step-${step}`}>
          <div className="panel-scroll">
            <p className="panel-kicker">Paso {stepIndex + 1} de {steps.length}</p>
            <h2><StepIcon size={18} /> {steps[stepIndex].title}</h2>
            {step === 'territory' && (
              <Territory
                raw={raw}
                dimensionId={dimensionId}
                setDimensionId={setDimensionId}
                metric={metric}
                setMetric={setMetric}
                selectedMunicipality={selectedMunicipality}
                setSelectedMunicipality={setSelectedMunicipality}
              />
            )}
            {step === 'priority' && <Priority analysis={analysis} onCompare={() => setDrawer('compare')} onMatrix={() => setDrawer('matrix')} />}
            {step === 'portfolio' && (
              <Portfolio
                analysis={analysis}
                raw={raw}
                focusId={activeFocusId}
                setFocusId={setFocusId}
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
                <GapRanking voi={raw.engine.voi} prepared={analysis.prepared} />
              </>
            )}
            {step === 'residual' && <Residual analysis={analysis} />}
            {step === 'followup' && <Followup analysis={analysis} engine={raw.engine} />}
          </div>
          <div className="panel-actions">
            <button type="button" data-testid="step-back" disabled={stepIndex === 0} onClick={() => setStep(steps[stepIndex - 1].id)}>
              <ChevronLeft size={16} /> Atrás
            </button>
            <button type="button" data-testid="step-next" disabled={stepIndex === steps.length - 1} onClick={() => setStep(steps[stepIndex + 1].id)}>
              Continuar <ChevronRight size={16} />
            </button>
          </div>
        </aside>
      </div>
      {drawer && (
        <div className="drawer-backdrop" onClick={() => setDrawer(null)}>
          <div className={drawer === 'matrix' ? 'drawer drawer-wide' : 'drawer'} data-testid={`${drawer}-drawer`} onClick={(event) => event.stopPropagation()}>
            <button type="button" data-testid="drawer-close" autoFocus onClick={() => setDrawer(null)}>Cerrar</button>
            {drawer === 'sources' && <Sources raw={raw} />}
            {drawer === 'method' && <Method />}
            {drawer === 'compare' && <Compare analysis={analysis} />}
            {drawer === 'matrix' && <DecisionMatrix rows={analysis.matrix.rows} />}
          </div>
        </div>
      )}
    </div>
  );
}

function Territory({ raw, dimensionId, setDimensionId, metric, setMetric, selectedMunicipality, setSelectedMunicipality }) {
  const bio = numericPair(raw, 'biodiversity', 'vulnerability');
  return (
    <>
      <p className="panel-lead">El mapa muestra la clase municipal. El fondo decide qué se financia primero.</p>
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
              <span><strong>{municipality.name}</strong><span>{lead.label}</span></span>
            </button>
            {selectedMunicipality === municipality.id && brief && <p className="panel-lead">{brief}</p>}
          </div>
        );
      })}
      <article className="insight">
        <Leaf size={16} />
        <div>
          <strong>Biodiversidad es la presión común más crítica</strong>
          <p>Rionegro {formatNumber(bio.rionegro)} · Marinilla {formatNumber(bio.marinilla)}</p>
        </div>
      </article>
    </>
  );
}

function Priority({ analysis, onCompare, onMatrix }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <p className="panel-lead">Portafolio recomendado con evidencia verificada. Mejor conjunto bajo la evidencia institucional actualmente integrada.</p>
      <p>15 medidas compiten por COP 5.000 M. El puntaje institucional usa solo vulnerabilidad y recurrencia observada.</p>
      <p>Puntaje institucional verificado {analysis.portfolio.institucional.objective.toFixed(2)}</p>
      <DecisionMatrix rows={analysis.matrix.rows} compact />
      <button type="button" data-testid="open-matrix" onClick={onMatrix}>Ver matriz completa</button>
      <button type="button" data-testid="open-compare" onClick={onCompare}>Comparar alternativas</button>
      <button type="button" className="text-button" onClick={() => setOpen((value) => !value)}>¿Cómo se calcula?</button>
      {open && (
        <ul>
          <li>70% clase de vulnerabilidad.</li>
          <li>15% recurrencia documentada, solo con cobertura de al menos 5 registros.</li>
          <li>15% componente participativo pendiente de integración. No se muestra como cero.</li>
          <li>El cobeneficio se ve en la matriz y no entra a este puntaje.</li>
        </ul>
      )}
    </>
  );
}

function Portfolio({ analysis, raw, focusId, setFocusId, openWhy, setOpenWhy, onCompare }) {
  const used = analysis.portfolio.cost;
  const budget = analysis.parameters.budget_million_cop;
  const fichas = new Map((raw.fichas?.measures ?? []).map((item) => [item.id, item]));
  return (
    <>
      <p data-testid="budget-used">COP {used.toLocaleString('es-CO')} M / COP {budget.toLocaleString('es-CO')} M</p>
      <div className="budget-track" aria-hidden="true"><i style={{ width: `${(used / budget) * 100}%` }} /></div>
      <p><span data-testid="budget-remaining">{analysis.portfolio.remaining.toLocaleString('es-CO')}</span> M disponibles</p>
      <button type="button" data-testid="open-compare" onClick={onCompare}>Comparar alternativas</button>
      <div data-testid="portfolio-list">
        {analysis.portfolio.measures.map((measure) => {
          const ficha = fichas.get(measure.id);
          return (
            <article key={measure.id} className={measure.id === focusId ? 'measure-row is-active' : 'measure-row'} data-testid={`measure-${measure.id}`}>
              <div className="measure-icon"><Leaf size={16} /></div>
              <div className="measure-main">
                <strong>{measure.name}</strong>
                <p>{measure.place.localization}</p>
                <p>{copMillions(measure.cost)}</p>
                <p>{shortDimension(raw, measure.dimensionId)} · {measure.classificationLabel} · {NBS_LABELS[measure.nbsClass]}</p>
              </div>
              <div className="measure-actions">
                <button type="button" data-testid={`map-focus-${measure.id}`} onClick={() => setFocusId(measure.id)}>Mapa</button>
                <button type="button" data-testid={`why-${measure.id}`} aria-expanded={openWhy === measure.id} onClick={() => setOpenWhy(openWhy === measure.id ? null : measure.id)}>Por qué</button>
              </div>
              {openWhy === measure.id && (
                <div className="measure-why">
                  <ul>
                    {analysis.explanations[measure.id].lines.slice(0, 4).map((line) => <li key={line}>{line}</li>)}
                    <li>{focusForMeasure(measure).exactLocation}. No es un predio seleccionado.</li>
                    {ficha?.status && <li>Precedente institucional: {ficha.status.slice(0, 180)}</li>}
                    <li>{READINESS[measure.id] ?? 'Requiere caracterización local.'}</li>
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}

function Horizon({ analysis, horizon, setHorizon }) {
  const shift = analysis.stress.shift;
  const signalCount = analysis.stress.evidencedDimensions.length;
  return (
    <>
      <div className="scenario-switch" role="group" aria-label="Escenario">
        <button type="button" className={horizon === 'reference' ? 'is-active' : ''} onClick={() => setHorizon('reference')}>Referencia</button>
        <button type="button" data-testid="scenario-2060" className={horizon === '2060' ? 'is-active' : ''} onClick={() => setHorizon('2060')}>SSP3-7.0 · 2060</button>
      </div>
      <p data-testid="stress-status" className={`status status-${analysis.stress.status}`} title={ROBUSTNESS_MEANING}>{STRESS_LABELS[analysis.stress.status]}</p>
      <p className="fine" data-testid="stress-meaning">{ROBUSTNESS_MEANING}</p>
      <p data-testid="stress-outcome">{analysis.stress.sameSet ? 'El portafolio no cambia ante el cambio cuantificado' : 'El portafolio cambia ante el cambio cuantificado'}</p>
      <p>Rionegro, riesgo de desastres: {shift.from_value} → {shift.to_value}. {classLabel(shift.from_class)} → {classLabel(shift.to_class)}.</p>
      <section data-testid="stress-coverage">
        <h3>Cobertura del stress test</h3>
        <p>{signalCount === 1 ? '1 señal cuantificada' : `${signalCount} señales cuantificadas`}</p>
        <p>Rionegro · {dimensionName(shift.dimension_id)}</p>
        <p>Otras dimensiones: Integración de escenario requerida</p>
      </section>
      <section data-testid="robustness-panel">
        <h3>¿Qué podría cambiar esta decisión?</h3>
        <div data-testid="decision-hinge">
          <h3>Umbral de cambio de decisión</h3>
          {analysis.hinges.map((hinge) => (
            <article key={hinge.id} className="hinge-card">
              <p><strong>{hinge.name}</strong></p>
              <p>Brecha verificada: {hinge.gapDisplay}</p>
              <p>{hinge.label}</p>
              <p>{hinge.interpretation}</p>
              <p>Evidencia que puede cambiar la decisión</p>
              <ul>{hinge.criteria.map((criterion) => <li key={criterion.id}>{criterion.label}</li>)}</ul>
              <p>Diferencia ponderada mínima: {hinge.minimumDisplay}</p>
              <p>{hinge.sentence}</p>
              <p className="fine">{hinge.assignment}</p>
            </article>
          ))}
          <p className="fine">{analysis.hinges[0]?.thresholds}</p>
        </div>
        <p>Estable ante</p>
        <ul>{analysis.robustness.stable.map((line) => <li key={line}>{line}</li>)}</ul>
        <p>Sensible a</p>
        <ul>{analysis.robustness.sensitive.map((line) => <li key={line}>{line}</li>)}</ul>
      </section>
      <section data-testid="pathway-panel">
        <h3>Hoy, monitorear, reevaluar</h3>
        {analysis.pathways.map((path) => (
          <p key={path.dimensionId}><strong>{path.dimension}</strong> · {path.current} · {path.threshold}</p>
        ))}
      </section>
    </>
  );
}

function Residual({ analysis }) {
  const addressed = analysis.residual.rows.filter((row) => row.addressed);
  const open = analysis.residual.rows.filter((row) => !row.addressed);
  return (
    <>
      <p>{analysis.residual.reminder}</p>
      <h3>Con medida</h3>
      <ul>{addressed.map((row) => <li key={row.dimensionId}>{dimensionName(row.dimensionId)}</li>)}</ul>
      <h3>Sigue sin medida</h3>
      <ul>{open.map((row) => <li key={row.dimensionId}>{dimensionName(row.dimensionId)}. {row.statement}</li>)}</ul>
      <h3>Validación de campo</h3>
      <ul>
        {analysis.gaps.slice(0, 3).map((gap) => <li key={gap.id}>{gap.missing_information}</li>)}
      </ul>
    </>
  );
}

function Followup({ analysis, engine }) {
  return (
    <>
      <p>{analysis.mea.regional_context.statement}</p>
      {analysis.portfolio.measures.slice(0, 4).map((measure) => {
        const indicator = analysis.mea.indicators.find((item) => item.intervention_id === measure.id);
        return <p key={measure.id}><strong>{measure.name}</strong> · {indicator?.name ?? 'Seguimiento requerido'}</p>;
      })}
      <section data-testid="nbs-screen">
        <h3>Screening NbS, no es certificación</h3>
        {analysis.nbsScreen.map((item) => (
          <div key={item.id}>
            <p><strong>{item.name}</strong> · {item.criteria.filter((criterion) => criterion.status === 'SUPPORTED').length} criterios con soporte · {item.criteria.filter((criterion) => criterion.status === 'TO VALIDATE').length} por validar</p>
            <p className="fine">{item.standard}</p>
            <details>
              <summary>Criterios y procedencia</summary>
              {item.criteria.map((criterion) => (
                <p key={criterion.id}>{criterion.label}: {criterion.statusLabel} · {criterion.source}</p>
              ))}
            </details>
          </div>
        ))}
      </section>
      <p data-testid="decision-line">Con la evidencia institucional verificada, Ourea asigna los COP 5.000 M a seis medidas. La selección no cambia ante el cambio SSP3-7.0 cuantificado para Rionegro, pero es sensible al componente participativo aún por integrar.</p>
      <button type="button" data-testid="export-pdf" onClick={() => downloadPitchPdf(analysis)}>Descargar PDF</button>
      <p className="fine">Huella {analysis.fingerprint}</p>
      <EngineAnnex engine={engine} />
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

function Method() {
  return (
    <>
      <h2>Cómo se calculó</h2>
      <ul>
        <li>70% vulnerabilidad.</li>
        <li>15% recurrencia de acciones verificada.</li>
        <li>15% componente participativo pendiente de integración. No se trata como cero.</li>
      <li>El cobeneficio nombrado por la unidad funcional no entra al puntaje institucional. La lente de naturaleza sí puede usarlo.</li>
      </ul>
      <p>Las capas GIS no entran al puntaje. Una geometría no es un sitio de obra.</p>
      <p>El plan regional de Valles de San Nicolás, 2026, prioriza PSA y eficiencia hídrica para nueve municipios. Ese orden no reemplaza el portafolio de este corredor.</p>
    </>
  );
}

function Compare({ analysis }) {
  const cards = comparisonCards(analysis);
  return (
    <>
      <h2>Comparar alternativas</h2>
      <p className="fine">El puntaje institucional verificado es la métrica común. El objetivo de cada lente se muestra aparte y no se compara en la misma columna.</p>
      <div className="compare-grid">
        {cards.map((card) => (
          <article key={card.id} data-testid={`compare-${card.id}`}>
            <h3>{card.title}</h3>
            <p>{copMillions(card.cost)}</p>
            <p className="compare-metric" data-testid={`compare-institutional-${card.id}`}>Puntaje institucional verificado: {card.institutional.toFixed(3)}</p>
            {card.lens && (
              <p className="compare-lens" data-testid={`compare-lens-${card.id}`}>
                {card.lens.label}: {card.lens.value.toFixed(3)}
                <span className="fine"> {card.lens.note}</span>
              </p>
            )}
            {card.note && <p className="fine">{card.note}</p>}
            <p>{card.measures.length} medidas</p>
            <p>{card.measures.map((name) => shortName(name)).join(' · ')}</p>
          </article>
        ))}
      </div>
    </>
  );
}

function shadingLabel(step, metric, dimensionId, horizon) {
  if (step === 'horizon' && horizon === '2060') return 'Riesgo de desastres hacia 2060. Solo Rionegro tiene el cambio cuantificado.';
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

function numericPair(raw, dimensionId, metric) {
  const value = (id) => raw.metrics.metrics.find((row) => (
    row.municipality_id === id && row.dimension_id === dimensionId && row.metric === metric && row.value != null
  ))?.value;
  return { rionegro: value('rionegro'), marinilla: value('marinilla') };
}

function formatNumber(value) {
  return value == null ? 'sin serie' : String(value).replace('.', ',');
}

function classLabel(value) {
  return { muy_baja: 'Muy bajo', baja: 'Bajo', media: 'Medio', alta: 'Alto', muy_alta: 'Muy alto' }[value] ?? value;
}

function shortDimension(raw, id) {
  return raw.interventions.dimensions.find((item) => item.id === id)?.short_name ?? dimensionName(id);
}

function shortName(name) {
  return name.length > 48 ? `${name.slice(0, 45)}…` : name;
}
