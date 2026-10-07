import { useEffect, useMemo, useState } from 'react';
import { OureaLogo } from './components/OureaLogo.jsx';
import { analyzeCorridor, bundleDataset } from './domain/cornareDecision.js';
import { EVIDENCE_LABELS, NBS_LABELS, STRESS_LABELS } from './domain/evidence.js';
import { dimensionName, stressNarrative } from './domain/explanations.js';
import { CLASS_COLOR, STEPS, copMillions } from './cornare/copy.js';
import { DecisionMap } from './cornare/map/DecisionMap.jsx';
import { focusForMeasure } from './cornare/map/focus.js';
import { downloadDecisionJson, downloadPitchPdf } from './cornare/exportDecision.js';
import { loadCornareData } from './cornare/loadData.js';
import guardrails from './config/scientificGuardrails.json';

const METRICS = [
  { id: 'vulnerability', label: 'Vulnerabilidad' },
  { id: 'sensitivity', label: 'Sensibilidad' },
  { id: 'adaptive_capacity', label: 'Capacidad adaptativa' },
  { id: 'risk', label: 'Riesgo' },
];

export default function App() {
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('overview');
  const [metric, setMetric] = useState('vulnerability');
  const [openWhy, setOpenWhy] = useState(null);
  const [cellNote, setCellNote] = useState(null);

  useEffect(() => {
    loadCornareData().then(setRaw).catch((cause) => setError(cause.message));
  }, []);

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

  if (error) {
    return <main className="fatal-error"><h1>No se pudieron cargar los datos de CORNARE.</h1><p>{error}</p></main>;
  }
  if (!analysis) {
    return <main className="boot"><p>Cargando la decisión del corredor…</p></main>;
  }

  const stepIndex = STEPS.findIndex((item) => item.id === step);

  return (
    <div className="cornare-app">
      <div className="cornare-sticky">
      <header className="cornare-top">
        <OureaLogo compact />
        <div>
          <p className="eyebrow">Soporte a la decisión de adaptación territorial</p>
          <h1 data-testid="app-title">Ourea</h1>
        </div>
        <p className="budget-pill" data-testid="budget-pill">{copMillions(analysis.parameters.budget_million_cop)}</p>
      </header>
      <p className="corridor-line">Rionegro · Guarne · Marinilla · Valles de San Nicolás · CORNARE</p>
      <nav className="step-nav" aria-label="Recorrido de la decisión">
        {STEPS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={item.id === step ? 'is-active' : ''}
            data-testid={`nav-${item.id}`}
            onClick={() => setStep(item.id)}
          >
            <span>{index + 1}</span>
            {item.label}
          </button>
        ))}
      </nav>
      </div>
      <main className="cornare-main" data-testid={`step-${step}`}>
        {step === 'overview' && <Overview raw={raw} analysis={analysis} />}
        {step === 'diagnosis' && (
          <Diagnosis
            raw={raw}
            dataset={dataset}
            metric={metric}
            setMetric={setMetric}
            cellNote={cellNote}
            setCellNote={setCellNote}
          />
        )}
        {step === 'prioritize' && <Prioritize analysis={analysis} />}
        {step === 'portfolio' && (
          <Portfolio analysis={analysis} openWhy={openWhy} setOpenWhy={setOpenWhy} raw={raw} />
        )}
        {step === 'stress' && <Stress analysis={analysis} />}
        {step === 'residual' && <Residual analysis={analysis} />}
        {step === 'monitoring' && <Monitoring analysis={analysis} />}
        {step === 'export' && <Export analysis={analysis} />}
      </main>
      <footer className="cornare-footer">
        <button type="button" disabled={stepIndex === 0} onClick={() => setStep(STEPS[stepIndex - 1].id)}>Atrás</button>
        <p>{STEPS[stepIndex].title}</p>
        <button type="button" disabled={stepIndex === STEPS.length - 1} onClick={() => setStep(STEPS[stepIndex + 1].id)}>Continuar</button>
      </footer>
    </div>
  );
}

function Overview({ raw, analysis }) {
  const [dimensionId, setDimensionId] = useState('biodiversity');
  const colors = colorsFor(raw, dimensionId, 'vulnerability');
  return (
    <section>
      <h2>¿Dónde debe intervenir primero CORNARE, y con qué portafolio?</h2>
      <p className="lead">
        El fondo simulado es de {copMillions(5000)}. No alcanza para las 15 medidas del catálogo
        ({copMillions(raw.interventions.catalogue_total_million_cop)}). La respuesta de Ourea usa el estudio existente.
      </p>
      <div className="card-grid">
        {raw.profiles.municipalities.map((municipality) => (
          <article key={municipality.id} className="info-card">
            <h3>{municipality.name}</h3>
            <ul>
              {highlights(municipality.id, raw.metrics.metrics).map((line) => <li key={line}>{line}</li>)}
            </ul>
          </article>
        ))}
      </div>
      <DimensionPicker dimensions={raw.interventions.dimensions} dimensionId={dimensionId} onChange={setDimensionId} />
      <DecisionMap
        boundaries={raw.boundaries}
        colors={colors}
        shadingLabel={`Color municipal de vulnerabilidad en ${dimensionName(dimensionId)}. No es una superficie continua ni un sitio de obra.`}
      />
      <ol className="finding-list">
        {analysis.findings.map((finding) => (
          <li key={finding.id}>
            <span className={`tag tag-${finding.provenance}`}>{EVIDENCE_LABELS[finding.provenance]}</span>
            {finding.text}
          </li>
        ))}
      </ol>
    </section>
  );
}

function highlights(municipalityId, metrics) {
  const classes = metrics.filter((row) => (
    row.municipality_id === municipalityId
    && row.metric === 'vulnerability'
    && row.scenario === 'reference'
    && row.value == null
    && (row.classification === 'alta' || row.classification === 'muy_alta')
  ));
  const lines = classes.map((row) => `${dimensionName(row.dimension_id)}: vulnerabilidad ${row.classification_label}`);
  const numbers = metrics.filter((row) => row.municipality_id === municipalityId && row.value != null).slice(0, 2);
  numbers.forEach((row) => {
    const label = row.classification_label ? ` (${row.classification_label})` : '';
    lines.push(`${metricLabel(row.metric)} en ${dimensionName(row.dimension_id)}: ${formatValue(row)}${label}`);
  });
  return lines.slice(0, 4);
}

function Diagnosis({ raw, dataset, metric, setMetric, cellNote, setCellNote }) {
  const [dimensionId, setDimensionId] = useState('biodiversity');
  const [selectedId, setSelectedId] = useState(null);
  const municipalities = raw.profiles.municipalities;
  const dimensions = raw.interventions.dimensions;
  const activeDimension = cellNote?.dimension.id ?? dimensionId;
  const colors = colorsFor(raw, activeDimension, metric);
  return (
    <section>
      <h2>Diagnóstico territorial</h2>
      <div className="segmented" role="group" aria-label="Métrica">
        {METRICS.map((item) => (
          <button key={item.id} type="button" className={metric === item.id ? 'is-active' : ''} onClick={() => { setMetric(item.id); setCellNote(null); }}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="table-scroll">
        <table className="heat" data-testid="heatmap">
          <thead>
            <tr>
              <th>Municipio</th>
              {dimensions.map((dimension) => <th key={dimension.id}>{dimension.short_name}</th>)}
            </tr>
          </thead>
          <tbody>
            {municipalities.map((municipality) => (
              <tr key={municipality.id}>
                <th>{municipality.name}</th>
                {dimensions.map((dimension) => {
                  const rows = rowsFor(raw.metrics.metrics, municipality.id, dimension.id, metric);
                  const cell = displayCell(rows, metric);
                  const classification = cell?.classification;
                  return (
                    <td key={dimension.id}>
                      <button
                        type="button"
                        className="heat-cell"
                        style={{ background: CLASS_COLOR[classification] ?? CLASS_COLOR.missing }}
                        onClick={() => {
                          setDimensionId(dimension.id);
                          setSelectedId(municipality.id);
                          setCellNote({ municipality, dimension, rows });
                        }}
                      >
                        {cell ? (cell.classification_label || formatValue(cell)) : 'Sin dato'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cellNote && (
        <aside className="note-card">
          <h3>{cellNote.municipality.name} · {cellNote.dimension.name}</h3>
          {cellNote.rows.length ? cellNote.rows.map((row) => (
            <p key={row.id}>
              <span className={`tag tag-${row.provenance}`}>{EVIDENCE_LABELS[row.provenance]}</span>
              {formatValue(row)}
              {row.classification_label ? ` · ${row.classification_label}` : ''}
              . {row.note}
            </p>
          )) : (
            <p>CORNARE no entregó este valor en el paquete del reto. No se muestra como cero.</p>
          )}
        </aside>
      )}
      <DecisionMap
        boundaries={raw.boundaries}
        colors={colors}
        selectedIds={selectedId ? [selectedId] : []}
        onMunicipality={setSelectedId}
        shadingLabel={`Color municipal de ${metricLabel(metric).toLowerCase()} en ${dimensionName(activeDimension)}. El dato sigue siendo municipal.`}
      />
      <p className="fine">Cobertura del reporte de adaptación: {dataset.history.coverage.map((row) => `${nameOf(raw, row.municipality_id)} ${row.records}`).join(' · ')} registros. Marinilla no se interpreta como adaptación cero.</p>
    </section>
  );
}

function Prioritize({ analysis }) {
  const cards = [
    ['Institucional', analysis.lenses.institucional, 'Decisión que se presenta'],
    ['Naturaleza positiva', analysis.lenses.naturaleza, sameSet(analysis.lenses.institucional, analysis.lenses.naturaleza) ? 'Mismo conjunto. El desempate por soluciones basadas en la naturaleza no cambió el puntaje.' : 'Conjunto distinto'],
    ['Multidimensional', analysis.lenses.multidimensional, sameSet(analysis.lenses.institucional, analysis.lenses.multidimensional) ? 'Mismo conjunto. No hay una segunda medida en la misma dimensión que el penal más fuerte expulse.' : 'Conjunto distinto'],
    ['Bajo arrepentimiento', analysis.lenses.bajo_arrepentimiento, 'Prefiere medidas de clase alta por cada millón.'],
    ['Máximo número', analysis.baselines.max_count, sameSet(analysis.lenses.institucional, analysis.baselines.max_count) ? 'Coincide con el institucional. El número de medidas no está ganando por encima del puntaje.' : 'Más medidas, menor foco'],
    ['Infraestructura gris', analysis.baselines.grey, 'Obliga la obra de 2.500 millones y muestra qué se sacrifica.'],
  ];
  return (
    <section>
      <h2>Regla de prioridad</h2>
      <p className="lead">
        Puntaje = 70% clase de vulnerabilidad + 15% recurrencia documentada.
        El 15% de talleres queda sin calificar. La segunda medida en la misma dimensión conserva 35% del término de vulnerabilidad.
      </p>
      <ul className="weight-list">
        <li>Vulnerabilidad: 70%. Dato de clase institucional, con la lectura de la diapositiva marcada como inferencia.</li>
        <li>Recurrencia de acciones: 15%. Solo con cobertura de al menos 5 registros.</li>
        <li>Talleres municipales: 15%. Información faltante. No se imputa.</li>
      </ul>
      <div className="card-grid">
        {cards.map(([title, portfolio, note]) => (
          <article key={title} className="info-card">
            <h3>{title}</h3>
            <p className="score">{portfolio.institucional.objective.toFixed(2)}</p>
            <p>Puntaje de prioridad · {copMillions(portfolio.cost)} · quedan {copMillions(portfolio.remaining)}</p>
            <p>{portfolio.ids.length} medidas</p>
            <p className="fine">{note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Portfolio({ analysis, openWhy, setOpenWhy, raw }) {
  const [focusId, setFocusId] = useState(analysis.portfolio.measures[0]?.id ?? null);
  const selected = analysis.portfolio.measures.find((measure) => measure.id === focusId) ?? null;
  const focus = selected ? focusForMeasure(selected) : null;
  const colors = colorsFor(raw, 'biodiversity', 'vulnerability');
  return (
    <section>
      <h2>Portafolio institucional</h2>
      <BudgetBar analysis={analysis} />
      {focus && (
        <DecisionMap
          boundaries={raw.boundaries}
          colors={colors}
          selectedIds={focus.municipalityIds}
          focus={focus}
          shadingLabel="El resalte es el ámbito de la medida. La ubicación exacta de la obra sigue por definir."
        />
      )}
      <div className="measure-list" data-testid="portfolio-list">
        {analysis.portfolio.measures.map((measure) => (
          <article key={measure.id} className="measure-card" data-testid={`measure-${measure.id}`}>
            <header>
              <p className="eyebrow">Orden {measure.implementationOrder}</p>
              <h3>{measure.name}</h3>
              <p>{measure.place.localization}</p>
              <p className="measure-cost">{copMillions(measure.cost)}</p>
            </header>
            <dl>
              <div><dt>Problema</dt><dd>Vulnerabilidad {measure.classificationLabel.toLowerCase()} en {dimensionName(measure.dimensionId)}</dd></div>
              <div><dt>Clase</dt><dd>{NBS_LABELS[measure.nbsClass]}</dd></div>
              <div><dt>Actores</dt><dd>{measure.actors.map((actor) => actor.name).join(', ')}</dd></div>
              <div><dt>Aporte al puntaje</dt><dd>{measure.part.contribution.toFixed(3)}</dd></div>
            </dl>
            <button type="button" data-testid={`map-focus-${measure.id}`} onClick={() => setFocusId(measure.id)}>Ver en el mapa</button>
            <button type="button" onClick={() => setOpenWhy(openWhy === measure.id ? null : measure.id)}>
              {openWhy === measure.id ? 'Ocultar' : 'Por qué esta medida'}
            </button>
            {openWhy === measure.id && (
              <ul className="why-list">
                {analysis.explanations[measure.id].lines.map((line) => <li key={line}>{line}</li>)}
              </ul>
            )}
          </article>
        ))}
      </div>
      <h3>Qué se sacrifica</h3>
      <div className="card-grid">
        <article className="info-card">
          <h3>Infraestructura gris</h3>
          <p>Puntaje {analysis.baselines.grey.institucional.objective.toFixed(2)} frente a {analysis.portfolio.institucional.objective.toFixed(2)}.</p>
          <p>Incluir la obra de {copMillions(2500)} saca medidas de otras dimensiones.</p>
        </article>
        <article className="info-card">
          <h3>Bajo arrepentimiento</h3>
          <p>{analysis.lenses.bajo_arrepentimiento.measures.map((measure) => measure.name).join(' · ')}</p>
        </article>
      </div>
      <h3>Naturaleza, híbrida, habilitadora, gris</h3>
      <div className="card-grid">
        {analysis.nbs.map((item) => (
          <article key={item.nbsClass} className="info-card">
            <h3>{item.label}</h3>
            <p>{copMillions(item.investment)}</p>
            <p>{item.count} medidas</p>
            <p className="fine">{item.dimensions.map(dimensionName).join(', ') || 'Sin inversión en esta clase'}</p>
          </article>
        ))}
      </div>
      <p className="fine">La clase Naturaleza no vuelve óptima una medida. Aquí entra porque cubre biodiversidad Muy alta a un costo que deja fondo para otras dimensiones.</p>
    </section>
  );
}

function Stress({ analysis }) {
  const narrative = stressNarrative(analysis.stress, analysis.prepared);
  return (
    <section>
      <h2>Prueba SSP3-7.0 hacia 2060</h2>
      <p className={`status status-${analysis.stress.status}`} data-testid="stress-status">{narrative.label}</p>
      <p>{narrative.shift}</p>
      <p>{narrative.decision}</p>
      <p>
        Rionegro se vuelve más urgente en riesgo de desastres. Las demás dimensiones no tienen serie de escenario en el paquete:
        quedan como evidencia insuficiente. No hay probabilidades.
      </p>
      <p className="fine">{analysis.parameters.ssp.note}</p>
    </section>
  );
}

function Residual({ analysis }) {
  const gaps = [...analysis.gaps].sort((left, right) => rankPriority(left.priority) - rankPriority(right.priority));
  return (
    <section>
      <h2>Riesgo residual y brechas</h2>
      <p>{analysis.residual.reminder}</p>
      <ul className="finding-list">
        {analysis.residual.rows.map((row) => (
          <li key={row.dimensionId}>
            <strong>{dimensionName(row.dimensionId)}</strong>
            {' · '}
            {row.addressed ? 'con medida' : 'sin medida'}
            {' · '}
            {row.statement}
            {row.high.length ? ` (${row.high.map((item) => item.municipalityId).join(', ')})` : ''}
          </li>
        ))}
      </ul>
      <h3>Registro de información faltante</h3>
      <div className="measure-list">
        {gaps.map((gap) => (
          <article key={gap.id} className="measure-card">
            <header>
              <p className="eyebrow">{gap.priority}</p>
              <h3>{gap.missing_information}</h3>
            </header>
            <p>{gap.why_it_matters}</p>
            <p><strong>Podría cambiar: </strong>{gap.which_decision_it_could_change}</p>
            <p><strong>Cómo levantarla: </strong>{gap.how_to_collect_it}</p>
            {gap.responsible_actor_if_known && <p><strong>Actor: </strong>{gap.responsible_actor_if_known}</p>}
            <span className={`tag tag-${gap.provenance}`}>{EVIDENCE_LABELS[gap.provenance]}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function Monitoring({ analysis }) {
  return (
    <section>
      <h2>Monitoreo, evaluación y aprendizaje</h2>
      <p>{analysis.mea.regional_context.statement} {analysis.mea.regional_context.use}</p>
      {analysis.portfolio.measures.map((measure) => {
        const rows = analysis.mea.indicators.filter((indicator) => indicator.intervention_id === measure.id);
        return (
          <article key={measure.id} className="measure-card">
            <h3>{measure.name}</h3>
            <ul>
              {rows.map((indicator) => (
                <li key={indicator.id}>
                  <span className={`tag tag-${indicator.provenance}`}>{indicator.indicator_type}</span>
                  {indicator.name}
                  {' · '}
                  {indicator.target_status}
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </section>
  );
}

function Export({ analysis }) {
  return (
    <section>
      <h2>Síntesis</h2>
      <BudgetBar analysis={analysis} />
      <p data-testid="decision-line">
        Proteger primero la biodiversidad del corredor y el agua en Marinilla, con una medida habilitadora de conocimiento del riesgo,
        sin comprar la obra gris de {copMillions(2500)}.
      </p>
      <ol className="finding-list">
        {analysis.findings.map((finding) => <li key={finding.id}>{finding.text}</li>)}
      </ol>
      <ul>
        {guardrails.items.map((item) => <li key={item}>{item}</li>)}
      </ul>
      <p className="fine">Huella de reproducibilidad: {analysis.fingerprint}</p>
      <div className="export-actions">
        <button type="button" data-testid="export-json" onClick={() => downloadDecisionJson(analysis)}>Descargar JSON</button>
        <button type="button" data-testid="export-pdf" onClick={() => downloadPitchPdf(analysis)}>Descargar PDF</button>
      </div>
    </section>
  );
}

function BudgetBar({ analysis }) {
  const used = analysis.portfolio.cost;
  const budget = analysis.parameters.budget_million_cop;
  return (
    <div className="budget-bar" data-testid="budget-used">
      <div className="budget-fill" style={{ width: `${(used / budget) * 100}%` }} />
      <p>
        Usado {copMillions(used)} · Disponible <span data-testid="budget-remaining">{copMillions(analysis.portfolio.remaining)}</span>
      </p>
    </div>
  );
}

function rowsFor(metrics, municipalityId, dimensionId, metric) {
  return metrics.filter((row) => (
    row.municipality_id === municipalityId
    && row.dimension_id === dimensionId
    && row.metric === metric
    && row.scenario === 'reference'
  ));
}

function displayCell(rows, metric) {
  if (metric === 'vulnerability') {
    return rows.find((row) => row.value == null && row.classification) ?? rows[0] ?? null;
  }
  return rows.find((row) => row.value != null || row.value_min != null) ?? null;
}

function cellFor(metrics, municipalityId, dimensionId, metric) {
  return displayCell(rowsFor(metrics, municipalityId, dimensionId, metric), metric);
}

function formatValue(row) {
  if (row.value != null) return String(row.value).replace('.', ',');
  if (row.value_min != null) return `${String(row.value_min).replace('.', ',')}–${String(row.value_max).replace('.', ',')}`;
  return row.classification_label || 'Sin dato';
}

function metricLabel(metric) {
  return METRICS.find((item) => item.id === metric)?.label ?? metric;
}

function nameOf(raw, id) {
  return raw.profiles.municipalities.find((item) => item.id === id)?.name ?? id;
}

function sameSet(left, right) {
  return left.ids.join('|') === right.ids.join('|');
}

function rankPriority(priority) {
  return { alta: 0, media: 1, baja: 2 }[priority] ?? 3;
}

function DimensionPicker({ dimensions, dimensionId, onChange }) {
  return (
    <div className="segmented" role="group" aria-label="Dimensión del mapa">
      {dimensions.map((dimension) => (
        <button key={dimension.id} type="button" className={dimensionId === dimension.id ? 'is-active' : ''} onClick={() => onChange(dimension.id)}>
          {dimension.short_name}
        </button>
      ))}
    </div>
  );
}

function colorsFor(raw, dimensionId, metric) {
  return Object.fromEntries(raw.profiles.municipalities.map((municipality) => {
    const cell = cellFor(raw.metrics.metrics, municipality.id, dimensionId, metric);
    return [municipality.id, CLASS_COLOR[cell?.classification] ?? CLASS_COLOR.missing];
  }));
}
