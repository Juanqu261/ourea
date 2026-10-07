// Sections fed by the precomputed decision_engine JSON. Each one renders nothing if its file is missing.
import { EVIDENCE_LABELS } from '../domain/evidence.js';
import { dimensionName } from '../domain/explanations.js';

const CLASS_TEXT = { core: 'Núcleo', contingent: 'Contingente', rarely: 'Rara vez' };

export function pct(share, digits = 0) {
  if (share == null) return '—';
  return `${(share * 100).toFixed(digits).replace('.', ',')}%`;
}

function num(value, digits = 2) {
  if (value == null) return '—';
  return value.toFixed(digits).replace('.', ',');
}

function worlds(n) {
  return Number(n).toLocaleString('es-CO');
}

function nameFor(prepared, id) {
  return prepared.find((measure) => measure.id === id)?.name ?? id;
}

function EvidenceTag({ kind }) {
  return <span className={`tag tag-${kind}`}>{EVIDENCE_LABELS[kind] ?? kind}</span>;
}

export function RobustnessStep({ engine, analysis }) {
  const { robustness, breaking } = engine;
  if (!robustness) return null;
  const n = robustness.n_worlds;
  const star = robustness.s_star;
  const world0Ids = analysis.portfolio.ids;
  const world0Row = robustness.top_sets.find((row) => row.ids.join('|') === world0Ids.join('|'));
  const sameAsWorld0 = star.ids.join('|') === world0Ids.join('|');
  const inclusion = Object.entries(robustness.inclusion)
    .sort((left, right) => right[1].all.incl_best - left[1].all.incl_best);
  const pathways = robustness.pathways;
  return (
    <section data-testid="robustness">
      <h2>¿Se sostiene la decisión en los {worlds(n)} mundos probados?</h2>
      <p className="lead">
        Cada mundo cambia los supuestos del modelo dentro de rangos declarados: pesos, escala de clases, valor de una segunda medida,
        efectividad de cada medida y cambios de clase bajo SSP3-7.0. Se cuenta en cuántos mundos cada portafolio queda casi óptimo.
        No es una probabilidad.
      </p>
      <article className="info-card">
        <p className="eyebrow">Portafolio más aceptable (s*)</p>
        <h3>{star.ids.map((id) => nameFor(analysis.prepared, id)).join(' · ')}</h3>
        <p data-testid="near-best-sentence">
          Casi óptimo en {pct(star.all.near_5)} de los {worlds(n)} mundos probados (a menos de 5% del mejor).
          Es el mejor en {pct(star.all.rank1)}.
        </p>
        <p className="fine">
          Referencia {pct(star.reference.near_5)} · SSP3-7.0 {pct(star.ssp3_7_0.near_5)} ·
          {' '}a menos de 1%: {pct(star.all.near_1)} · a menos de 2%: {pct(star.all.near_2)}.
          {robustness.s_star_stable_across_thresholds ? ' El mismo s* gana con los tres umbrales.' : ' s* cambia según el umbral.'}
        </p>
        {!sameAsWorld0 && (
          <p className="fine">
            El portafolio institucional (mundo 0, puntaje {num(robustness.points.institucional.best_score)}) es casi óptimo en
            {' '}{world0Row ? pct(world0Row.all.near_5) : 'menos'} de los mundos probados. s* puntúa {num(star.world0_score)} en el mundo 0.
          </p>
        )}
      </article>

      <h3>Aceptabilidad de los portafolios</h3>
      <div className="table-scroll">
        <table className="heat engine-table" data-testid="acceptability-table">
          <thead>
            <tr>
              <th>Portafolio</th>
              <th>Costo</th>
              <th>Mundo 0</th>
              <th>Casi óptimo (5%)</th>
              <th>2%</th>
              <th>1%</th>
              <th>Mejor</th>
            </tr>
          </thead>
          <tbody>
            {robustness.top_sets.slice(0, 10).map((row) => (
              <tr key={row.ids.join('|')} className={row.ids.join('|') === world0Ids.join('|') ? 'is-world0' : ''}>
                <td>{row.ids.join(', ')}</td>
                <td>{worlds(row.cost)}</td>
                <td>{num(row.world0_score)}</td>
                <td>{pct(row.all.near_5)}</td>
                <td>{pct(row.all.near_2)}</td>
                <td>{pct(row.all.near_1)}</td>
                <td>{pct(row.all.rank1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Qué medidas aparecen en el mejor portafolio</h3>
      <ul className="inclusion-list" data-testid="inclusion-bars">
        {inclusion.map(([id, row]) => (
          <li key={id}>
            <span className="inclusion-name">{nameFor(analysis.prepared, id)}</span>
            <span className="inclusion-track" aria-hidden="true">
              <span className={`inclusion-fill inclusion-${row.class}`} style={{ width: `${(row.all.incl_best * 100).toFixed(1)}%` }} />
            </span>
            <span className="inclusion-value">{pct(row.all.incl_best)} · {CLASS_TEXT[row.class]}</span>
          </li>
        ))}
      </ul>
      <p className="fine">Núcleo: 80% o más de los mundos. Contingente: 20% a 80%. Rara vez: menos de 20%.</p>

      {breaking && <BreakingPoints breaking={breaking} />}
      {pathways && <Pathways pathways={pathways} prepared={analysis.prepared} />}
    </section>
  );
}

function BreakingPoints({ breaking }) {
  const primary = breaking.decision_residual_risk[breaking.primary];
  return (
    <>
      <h3>Dónde se rompe s*</h3>
      <p>
        s* tiene arrepentimiento mayor a {pct(primary.threshold)} en {pct(primary.failure_share)} de los mundos probados
        (referencia {pct(primary.failure_share_by_scenario.reference)}, SSP3-7.0 {pct(primary.failure_share_by_scenario.ssp3_7_0)}).
      </p>
      <ul className="finding-list" data-testid="breaking-points">
        {primary.boxes.map((box) => (
          <li key={box.sentence}>
            {box.exploratory && <EvidenceTag kind="exploratory" />}
            {box.sentence}
          </li>
        ))}
      </ul>
      {breaking.residual_vulnerability.length > 0 && (
        <p className="fine">
          Aparte del riesgo de la decisión, la vulnerabilidad residual ya existe:
          {' '}{breaking.residual_vulnerability.map((row) => row.text).join(' ')}
        </p>
      )}
    </>
  );
}

function Pathways({ pathways, prepared }) {
  return (
    <>
      <h3>Ruta adaptativa</h3>
      <div className="card-grid card-grid-2">
        <article className="info-card">
          <p className="eyebrow">Comprometer ahora</p>
          {pathways.commit_now.length
            ? <ul>{pathways.commit_now.map((row) => <li key={row.id}>{row.name} · {pct(row.share_in_best)}</li>)}</ul>
            : <p>{pathways.note}</p>}
        </article>
        <article className="info-card">
          <p className="eyebrow">Decidir el sitio después</p>
          {pathways.decide_site_later.length
            ? <ul>{pathways.decide_site_later.map((row) => <li key={row.id}>{row.sentence}</li>)}</ul>
            : <p>Ninguna medida de s* cambia de sitio en 20% o más de los mundos.</p>}
          <p className="fine">
            Reserva: {pathways.reserve.decision}. {pathways.reserve.rule}
            {pathways.reserve.watch_only?.length ? ` A vigilar: ${pathways.reserve.watch_only.map((id) => nameFor(prepared, id)).join(', ')}.` : ''}
          </p>
        </article>
      </div>
      <h4>Comprometer con una señal</h4>
      <ul className="finding-list" data-testid="pathway-signals">
        {pathways.commit_on_signal.map((row) => (
          <li key={row.id}>
            <strong>{row.name}</strong> ({pct(row.share_in_best)} de los mundos).
            {row.driver && ` Depende sobre todo de que ${row.driver.condition}.`}
            {row.signal && ` Señal a vigilar: ${row.signal.condition} (${row.signal.gaps.join(', ')}${row.signal.owner ? `; ${row.signal.owner}` : ''}).`}
            {row.signal?.evidence === 'exploratory' && <> <EvidenceTag kind="exploratory" /></>}
          </li>
        ))}
      </ul>
    </>
  );
}

export function LeverGrid({ levers, municipalities, dimensions }) {
  if (!levers) return null;
  const cells = Object.fromEntries(levers.cells.map((cell) => [cell.key, cell]));
  return (
    <section className="engine-block" data-testid="lever-grid">
      <h3>¿Reducir sensibilidad o fortalecer capacidad adaptativa?</h3>
      <p className="lead">{levers.finding}</p>
      <div className="table-scroll">
        <table className="heat engine-table">
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
                  const cell = cells[`${municipality.id}|${dimension.id}`];
                  const readings = [
                    cell.sensitivity ? `S ${num(cell.sensitivity.value)}` : null,
                    cell.adaptive_capacity ? `CA ${num(cell.adaptive_capacity.value)}` : null,
                  ].filter(Boolean).join(' · ');
                  return (
                    <td key={dimension.id} className={`lever-${cell.profile}`}>
                      <span>{cell.profile_label}</span>
                      {readings && <span className="fine"> {readings}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fine">{levers.rule}</p>
    </section>
  );
}

export function GapRanking({ voi, prepared }) {
  if (!voi) return null;
  const { gaps } = voi;
  const distance = (row) => (row.closest_distance_median == null
    ? 'sin dato'
    : `${nameFor(prepared, row.closest_measure)} cambiaría con ${num(row.closest_distance_median)} veces su aporte`);
  return (
    <section className="engine-block" data-testid="gap-ranking">
      <h3>Qué dato faltante cambiaría la decisión primero</h3>
      <p className="fine">{gaps.note}</p>
      <div className="card-grid">
        <article className="info-card">
          <p className="eyebrow">Dependencias (orden de la entrevista)</p>
          <ol>{gaps.dependency.map((row) => <li key={row.id}><strong>{row.id}</strong>: {distance(row)}.</li>)}</ol>
        </article>
        <article className="info-card">
          <p className="eyebrow">Modelo (valor de la información)</p>
          <ol>
            {gaps.model.map((row) => (
              <li key={row.id}>
                <strong>{row.id}</strong>: {row.evppi_max_corrected_pct == null ? 'sin parámetro' : `${pct(row.evppi_max_corrected_pct, 1)} vía ${row.evppi_parameter}`}
                {row.exploratory && <> <EvidenceTag kind="exploratory" /></>}
              </li>
            ))}
          </ol>
        </article>
        <article className="info-card">
          <p className="eyebrow">Sitios y prioridades</p>
          <ol>{gaps.site.map((row) => <li key={row.id}><strong>{row.id}</strong>: {distance(row)}.</li>)}</ol>
          <p className="fine">{gaps.preferences_note}</p>
          <p className="fine">
            {gaps.preferences.slice(0, 3).map((row) => `${row.parameter} ${pct(row.corrected_pct, 1)}`).join(' · ')}
          </p>
        </article>
      </div>
    </section>
  );
}

export function EngineAnnex({ engine }) {
  const { robustness, ranges } = engine;
  if (!robustness || !ranges) return null;
  return (
    <section className="engine-block" data-testid="engine-annex">
      <h3>Anexo de la simulación</h3>
      <ul className="fine">
        <li>{worlds(robustness.n_worlds)} mundos probados, semilla {robustness.seed}, hipercubo latino, numpy {robustness.numpy}.</li>
        <li>Huella de la simulación: {robustness.fingerprint}.</li>
        <li>Casi óptimo: a menos de {pct(ranges.thresholds.near_best_primary)} del mejor puntaje de cada mundo (supuesto). También se reporta 1% y 2%.</li>
        <li>Punto de quiebre: arrepentimiento de s* mayor a {pct(ranges.thresholds.failure_regret)}.</li>
        <li>{ranges.parameters.length} parámetros por mundo. Los rotulados {EVIDENCE_LABELS.exploratory} solo aparecen como señales a vigilar.</li>
      </ul>
      {robustness.wording_rules && <ul className="fine">{robustness.wording_rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>}
      <p className="fine">Medidas por dimensión en s*: {robustness.s_star.dimensions.map(dimensionName).join(', ')}.</p>
      <p className="fine">
        Mundo 0 con SSP3-7.0: {num(robustness.points.institucional_ssp.best_score)} ·
        {' '}conjuntos a menos de 1/2/5/10% del mejor en el mundo 0: {robustness.world0_sets_within.near_1}/{robustness.world0_sets_within.near_2}/{robustness.world0_sets_within.near_5}/{robustness.world0_sets_within.near_10}.
      </p>
    </section>
  );
}
