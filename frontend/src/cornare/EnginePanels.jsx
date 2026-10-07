// Sections fed by the precomputed decision_engine JSON. Each one renders nothing if its file is missing.
import { EVIDENCE_LABELS } from '../domain/evidence.js';
import { dimensionName } from '../domain/explanations.js';
import { shortName } from '../domain/decisionSummary.js';
import { copM, esNumber, esPct, joinEs } from '../domain/format.js';

const CLASS_TEXT = { core: 'Núcleo', contingent: 'Contingente', rarely: 'Rara vez' };

export function pct(share, digits = 0) {
  return esPct(share, digits);
}

function num(value, digits = 2) {
  return esNumber(value, digits);
}

function worlds(n) {
  return esNumber(n);
}

function nameFor(prepared, id) {
  return prepared.find((measure) => measure.id === id)?.name ?? id;
}

function shortFor(prepared, id) {
  const measure = prepared.find((item) => item.id === id);
  return measure ? shortName(measure) : id;
}

// Engine parameter id → its Spanish phrase from uncertainty_ranges.json ("dim_w[biodiversity]" → "el peso relativo de biodiversidad").
function phraseFor(ranges, parameter) {
  return ranges?.parameters?.find((item) => item.name === parameter)?.phrase ?? parameter;
}

function gapName(gaps, id) {
  return gaps?.find((gap) => gap.id === id)?.missing_information ?? id;
}

function EvidenceTag({ kind }) {
  return <span className={`tag tag-${kind}`}>{EVIDENCE_LABELS[kind] ?? kind}</span>;
}

function RobustnessSummary({ engine, analysis }) {
  const { robustness, voi, ranges } = engine;
  const star = robustness.s_star;
  const world0Ids = analysis.portfolio.ids;
  const world0Row = robustness.top_sets.find((row) => row.ids.join('|') === world0Ids.join('|'));
  const sameAsWorld0 = star.ids.join('|') === world0Ids.join('|');
  const shared = star.ids.filter((id) => world0Ids.includes(id));
  const sharedCost = shared.reduce((sum, id) => sum + (analysis.byId.get(id)?.cost ?? 0), 0);
  const onlyWorld0 = world0Ids.filter((id) => !star.ids.includes(id));
  const onlyStar = star.ids.filter((id) => !world0Ids.includes(id));
  const top = voi?.evppi?.[0];
  const names = (ids) => joinEs(ids.map((id) => shortFor(analysis.prepared, id)));
  return (
    <article className="summary-card" data-testid="robustness-summary">
      <p className="eyebrow">Lo que significa para la decisión</p>
      <dl>
        <dt>Qué se probó</dt>
        <dd>
          {worlds(robustness.n_worlds)} combinaciones de supuestos («mundos») dentro de rangos declarados: pesos, escala de clases,
          valor de una segunda medida, efectividad de cada medida y clases bajo SSP3-7.0. Es una prueba de sensibilidad, no una probabilidad.
        </dd>
        <dt>Resultado</dt>
        <dd>
          {sameAsWorld0
            ? `El portafolio recomendado también es el más estable: casi óptimo (a menos de 5% del mejor) en ${pct(star.all.near_5)} de los mundos.`
            : `El portafolio recomendado es casi óptimo (a menos de 5% del mejor) en ${world0Row ? pct(world0Row.all.near_5) : 'menos'} de los mundos. El más estable lo es en ${pct(star.all.near_5)}, y ningún portafolio supera esa cifra.`}
        </dd>
        {!sameAsWorld0 && (
          <>
            <dt>Qué comparten</dt>
            <dd>
              {shared.length} medidas por {copM(sharedCost)}: {names(shared)}. Difieren en el resto del fondo:
              {' '}el recomendado suma {names(onlyWorld0)}; el más estable, {names(onlyStar)}.
            </dd>
          </>
        )}
        {top && (
          <>
            <dt>Qué más mueve la decisión</dt>
            <dd>
              {phraseFor(ranges, top.parameter).replace(/^./, (letter) => letter.toUpperCase())} ({EVIDENCE_LABELS[top.evidence] ?? top.evidence}).
              {top.gaps?.length
                ? ` Lo resolvería: ${joinEs(top.gaps.map((id) => gapName(analysis.gaps, id).toLowerCase()))}.`
                : ' Es una prioridad que CORNARE puede declarar, no un dato que falte.'}
            </dd>
          </>
        )}
      </dl>
    </article>
  );
}

export function RobustnessStep({ engine, analysis }) {
  const { robustness, breaking } = engine;
  if (!robustness) return null;
  const n = robustness.n_worlds;
  const star = robustness.s_star;
  const world0Ids = analysis.portfolio.ids;
  const inclusion = Object.entries(robustness.inclusion)
    .sort((left, right) => right[1].all.incl_best - left[1].all.incl_best);
  const pathways = robustness.pathways;
  return (
    <section data-testid="robustness">
      <RobustnessSummary engine={engine} analysis={analysis} />

      <article className="info-card">
        <p className="eyebrow">Portafolio más estable</p>
        <h3>{star.ids.map((id) => nameFor(analysis.prepared, id)).join(' · ')}</h3>
        <p data-testid="near-best-sentence">
          Casi óptimo en {pct(star.all.near_5)} de los {worlds(n)} mundos probados (a menos de 5% del mejor).
          Es el mejor en {pct(star.all.rank1)}.
        </p>
        <p className="fine">
          Referencia {pct(star.reference.near_5)} · SSP3-7.0 {pct(star.ssp3_7_0.near_5)} ·
          {' '}a menos de 1%: {pct(star.all.near_1)} · a menos de 2%: {pct(star.all.near_2)}.
          {robustness.s_star_stable_across_thresholds ? ' Es el mismo con los tres umbrales.' : ' Cambia según el umbral.'}
          {' '}Con los pesos de CORNARE puntúa {num(star.world0_score, 4)}. En los archivos del motor se llama s*.
        </p>
      </article>

      <details className="more">
        <summary>Los 10 portafolios más estables</summary>
        <div className="table-scroll">
          <table className="heat engine-table" data-testid="acceptability-table">
            <thead>
              <tr>
                <th>Portafolio</th>
                <th>COP M</th>
                <th>Puntaje con pesos de CORNARE</th>
                <th>Casi óptimo (5%)</th>
                <th>2%</th>
                <th>1%</th>
                <th>Mejor</th>
              </tr>
            </thead>
            <tbody>
              {robustness.top_sets.slice(0, 10).map((row) => (
                <tr key={row.ids.join('|')} className={row.ids.join('|') === world0Ids.join('|') ? 'is-world0' : ''}>
                  <td>{row.ids.map((id) => shortFor(analysis.prepared, id)).join(' · ')}{row.ids.join('|') === world0Ids.join('|') ? ' (recomendado)' : ''}</td>
                  <td>{worlds(row.cost)}</td>
                  <td>{num(row.world0_score, 4)}</td>
                  <td>{pct(row.all.near_5)}</td>
                  <td>{pct(row.all.near_2)}</td>
                  <td>{pct(row.all.near_1)}</td>
                  <td>{pct(row.all.rank1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

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
      <p className="fine">Porcentaje de mundos cuyo mejor portafolio incluye la medida. Núcleo: 80% o más. Contingente: 20% a 80%. Rara vez: menos de 20%.</p>

      {breaking && <BreakingPoints breaking={breaking} />}
      {pathways && <Pathways pathways={pathways} prepared={analysis.prepared} gaps={analysis.gaps} profiles={analysis.profiles} />}
    </section>
  );
}

function BreakingPoints({ breaking }) {
  const primary = breaking.decision_residual_risk[breaking.primary];
  return (
    <>
      <h3>Cuándo deja de ser casi óptimo</h3>
      <p>
        El portafolio más estable queda a más de {pct(primary.threshold)} del mejor en {pct(primary.failure_share)} de los mundos probados
        (referencia {pct(primary.failure_share_by_scenario.reference)}, SSP3-7.0 {pct(primary.failure_share_by_scenario.ssp3_7_0)}).
        Las condiciones que más explican esos mundos:
      </p>
      <ul className="finding-list" data-testid="breaking-points">
        {primary.boxes.map((box) => (
          <li key={box.sentence}>
            {box.exploratory && <><EvidenceTag kind="exploratory" />{' '}</>}
            Cuando {joinEs(box.conditions.map((condition) => condition.text))}. Reúne {pct(box.coverage)} de los mundos donde falla;
            {' '}dentro de esas condiciones falla en {pct(box.density)}.
          </li>
        ))}
      </ul>
      {breaking.residual_vulnerability.length > 0 && (
        <p className="fine">
          Aparte del riesgo de la decisión, la vulnerabilidad residual ya existe:
          {' '}{breaking.residual_vulnerability.map((row) => row.text.replace(' en s*', ' en ese portafolio')).join(' ')}
        </p>
      )}
    </>
  );
}

function placeName(profiles, id) {
  return profiles?.find((item) => item.id === id)?.name ?? id;
}

function Pathways({ pathways, prepared, gaps, profiles }) {
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
            ? (
              <ul>
                {pathways.decide_site_later.map((row) => (
                  <li key={row.id}>
                    <strong>{shortFor(prepared, row.id)}</strong>: comprometer el monto ahora y confirmar el sitio cuando se resuelva
                    {' '}«{gapName(gaps, row.resolving_gap).toLowerCase()}». Hoy la regla la ubica en {joinEs(row.world0_candidates.map((id) => placeName(profiles, id)))};
                    {' '}otro municipio puntúa más en {pct(row.best_site_elsewhere_share)} de los mundos.
                  </li>
                ))}
              </ul>
            )
            : <p>Ninguna medida cambia de sitio en 20% o más de los mundos.</p>}
          <p className="fine">
            Reserva de fondo: {pathways.reserve.decision}. Se reserva solo si esperar un dato vale más que el costo de esperar,
            {' '}un supuesto de {pct(pathways.reserve.delay_cost_share)} del mejor puntaje medio.
            {pathways.reserve.watch_only?.length ? ` Señales a vigilar sin reservar fondo: ${joinEs(pathways.reserve.watch_only.map((id) => shortFor(prepared, id)))}.` : ''}
          </p>
        </article>
      </div>
      <details className="more">
        <summary>Comprometer con una señal: {pathways.commit_on_signal.length} medidas</summary>
        <ul className="finding-list" data-testid="pathway-signals">
          {pathways.commit_on_signal.map((row) => (
            <li key={row.id}>
              <strong>{row.name}</strong> ({pct(row.share_in_best)} de los mundos).
              {row.driver && ` Depende sobre todo de que ${row.driver.condition}.`}
              {row.signal && ` Señal a vigilar: ${row.signal.condition} (${row.signal.gaps.map((id) => gapName(gaps, id).toLowerCase()).join('; ')}${row.signal.owner ? `; responsable: ${row.signal.owner}` : ''}).`}
              {row.signal?.evidence === 'exploratory' && <> <EvidenceTag kind="exploratory" /></>}
            </li>
          ))}
        </ul>
      </details>
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
      <details className="more">
        <summary>Ver las {levers.counts.cells} celdas municipio × dimensión</summary>
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
      </details>
    </section>
  );
}

// Below 0,1% of the best mean score a model gap does not move the decision in the tested worlds.
const MEASURABLE_VOI = 0.001;

export function GapRanking({ voi, prepared, ranges, gaps: gapList }) {
  if (!voi) return null;
  const { gaps } = voi;
  const measurable = gaps.model.filter((row) => (row.evppi_max_corrected_pct ?? 0) >= MEASURABLE_VOI);
  const flat = gaps.model.filter((row) => (row.evppi_max_corrected_pct ?? 0) < MEASURABLE_VOI);
  const distance = (row) => (row.closest_distance_median == null
    ? 'no se acerca a cambiar ninguna medida'
    : `un cambio de ${pct(row.closest_distance_median)} en el aporte de «${shortFor(prepared, row.closest_measure)}» cambiaría la decisión`);
  return (
    <section className="engine-block" data-testid="gap-ranking">
      <h3>Qué dato faltante cambiaría la decisión primero</h3>
      <p className="fine">Primero el dato más cerca de cambiar el portafolio (mediana de los mundos probados). El valor de la información no se suma entre datos.</p>
      <div className="card-grid">
        <article className="info-card">
          <p className="eyebrow">Dependencias (orden de la entrevista)</p>
          <ol>{gaps.dependency.map((row) => <li key={row.id}><strong>{row.missing_information}</strong>: {distance(row)}.</li>)}</ol>
        </article>
        <article className="info-card">
          <p className="eyebrow">Modelo (valor de la información)</p>
          <ol>
            {measurable.map((row) => (
              <li key={row.id}>
                <strong>{gapName(gapList, row.id)}</strong>: {pct(row.evppi_max_corrected_pct, 1)} del mejor puntaje medio, vía {phraseFor(ranges, row.evppi_parameter)}.
                {row.exploratory && <> <EvidenceTag kind="exploratory" /></>}
              </li>
            ))}
          </ol>
          {flat.length > 0 && (
            <p className="fine">Sin efecto medible en los mundos probados: {flat.map((row) => gapName(gapList, row.id).toLowerCase()).join('; ')}.</p>
          )}
        </article>
        <article className="info-card">
          <p className="eyebrow">Sitios y prioridades</p>
          <ol>{gaps.site.map((row) => <li key={row.id}><strong>{row.missing_information}</strong>: {distance(row)}.</li>)}</ol>
          <p className="fine">Estas no son datos faltantes: son prioridades que CORNARE decide. El porcentaje dice cuánto mejora la decisión si CORNARE las declara.</p>
          <ul className="fine">
            {gaps.preferences.slice(0, 3).map((row) => <li key={row.parameter}>{phraseFor(ranges, row.parameter)}: {pct(row.corrected_pct, 1)}</li>)}
          </ul>
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
      <ul className="fine">
        <li>{worlds(robustness.n_worlds)} mundos probados, semilla {robustness.seed}, hipercubo latino, numpy {robustness.numpy}.</li>
        <li>Huella de la simulación: {robustness.fingerprint}.</li>
        <li>Casi óptimo: a menos de {pct(ranges.thresholds.near_best_primary)} del mejor puntaje de cada mundo (supuesto). También se reporta 1% y 2%.</li>
        <li>Punto de quiebre: el portafolio más estable queda a más de {pct(ranges.thresholds.failure_regret)} del mejor.</li>
        <li>{ranges.parameters.length} parámetros por mundo. Los rotulados {EVIDENCE_LABELS.exploratory} solo aparecen como señales a vigilar.</li>
      </ul>
      {robustness.wording_rules && <ul className="fine">{robustness.wording_rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>}
      <p className="fine">Dimensiones del portafolio más estable: {robustness.s_star.dimensions.map(dimensionName).join(', ')}.</p>
      <p className="fine">
        Pesos de CORNARE con SSP3-7.0: {num(robustness.points.institucional_ssp.best_score, 4)} ·
        {' '}portafolios a menos de 1/2/5/10% del mejor con esos pesos: {robustness.world0_sets_within.near_1}/{robustness.world0_sets_within.near_2}/{robustness.world0_sets_within.near_5}/{robustness.world0_sets_within.near_10}.
      </p>
    </section>
  );
}
