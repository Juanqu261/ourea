import { useState } from 'react';
import { NBS_LABELS } from '../domain/evidence.js';

const DECISION_LABEL = {
  SELECTED: 'Seleccionada',
  'CLOSE ALTERNATIVE': 'Alternativa cercana',
  'NOT SELECTED': 'No seleccionada',
};

const EVIDENCE_LABEL = {
  verified: 'Verificada',
  partial: 'Parcialmente integrada',
  to_integrate: 'Por integrar',
};

const MARK = {
  SELECTED: 'selected',
  'CLOSE ALTERNATIVE': 'close',
  'NOT SELECTED': 'out',
};

function recurrenceLabel(row) {
  if (row.recurrence.withheld) return 'Por integrar';
  if (!row.recurrence.observed) return '0 observado';
  return formatTerm(row.recurrence.observed);
}

function formatTerm(value) {
  if (value == null) return 'Por integrar';
  const [whole, fraction] = value.toFixed(3).split('.');
  return `${whole},${fraction}`;
}

function formatGap(value) {
  const [whole, fraction] = value.toFixed(4).split('.');
  return `${whole},${fraction}`;
}

function marginalLabel(row) {
  if (row.portfolioMarginalScore == null) return 'Fuera del conjunto';
  return formatTerm(row.portfolioMarginalScore);
}

function gapLabel(row) {
  if (row.decision === 'SELECTED') return 'En el conjunto';
  if (row.bestContainingPortfolioGap == null) return 'No cabe';
  return formatGap(row.bestContainingPortfolioGap);
}

export function DecisionMatrix({ rows, compact = false }) {
  const [filter, setFilter] = useState(compact ? 'short' : 'all');
  const [openId, setOpenId] = useState(null);
  const visible = rows.filter((row) => {
    if (compact || filter === 'short') return row.decision !== 'NOT SELECTED';
    if (filter === 'selected') return row.decision === 'SELECTED';
    return true;
  });

  if (compact) {
    return (
      <div className="matrix-wrap" data-testid="matrix-compact">
        <p className="matrix-legend">Verificado es el aporte de la medida sola: vulnerabilidad más recurrencia observada. No incluye el componente participativo ni el cobeneficio.</p>
        <table className="compact-scores">
          <thead>
            <tr>
              <th>Medida</th>
              <th>Verificado</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} data-testid={`matrix-${row.id}`} className={`mark-${MARK[row.decision]}`}>
                <th scope="row">{row.name}</th>
                <td>
                  <span className="compact-score">{formatTerm(row.standaloneVerifiedScore)}</span>
                  {row.portfolioMarginalScore != null && Math.abs(row.portfolioMarginalScore - row.standaloneVerifiedScore) > 1e-6 && (
                    <span className="fine">Aporte en portafolio {formatTerm(row.portfolioMarginalScore)}</span>
                  )}
                  <span className="compact-decision">{DECISION_LABEL[row.decision]}</span>
                  <span className="fine">COP {row.cost.toLocaleString('es-CO')} M</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="matrix-wrap" data-testid="matrix-full">
      {!compact && (
        <div className="pill-row" role="group" aria-label="Filtro de la matriz">
          <button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>Todas</button>
          <button type="button" className={filter === 'selected' ? 'is-active' : ''} onClick={() => setFilter('selected')}>Seleccionadas</button>
          <button type="button" className={filter === 'short' ? 'is-active' : ''} onClick={() => setFilter('short')}>Más cercanas</button>
        </div>
      )}
      <p className="matrix-legend">Verificado es el aporte de la medida sola: vulnerabilidad más recurrencia observada. No incluye el componente participativo ni el cobeneficio. La marca no dice si la medida es científicamente buena.</p>
      <div className="matrix-scroll">
        <table>
          <thead>
            <tr>
              <th>Medida</th>
              {!compact && <th>Dimensión</th>}
              {!compact && <th>Ámbito</th>}
              {!compact && <th>Clase</th>}
              {!compact && <th>70%</th>}
              {!compact && <th>Recurrencia observada</th>}
              {!compact && <th>Participativo</th>}
              <th>COP M</th>
              {!compact && <th>NbS</th>}
              <th>Verificado</th>
              {!compact && <th>Aporte en portafolio</th>}
              {!compact && <th>Brecha más cercana</th>}
              {!compact && <th>Escenario</th>}
              <th>Decisión</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <FragmentRow key={row.id} row={row} compact={compact} open={openId === row.id} onToggle={() => setOpenId(openId === row.id ? null : row.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentRow({ row, compact, open, onToggle }) {
  const span = compact ? 4 : 14;
  return (
    <>
      <tr data-testid={`matrix-${row.id}`} className={`mark-${MARK[row.decision]}`}>
        <th scope="row">{row.name}</th>
        {!compact && <td>{row.dimension}</td>}
        {!compact && <td>{row.scope}</td>}
        {!compact && <td>{row.vulnerabilityClass}</td>}
        {!compact && <td>{formatTerm(row.vulnerabilityComponent)}</td>}
        {!compact && <td>{recurrenceLabel(row)}</td>}
        {!compact && <td>{row.workshop.display}</td>}
        <td>{row.cost.toLocaleString('es-CO')}</td>
        {!compact && <td>{NBS_LABELS[row.nbsClass]}</td>}
        <td>{formatTerm(row.standaloneVerifiedScore)}</td>
        {!compact && <td>{marginalLabel(row)}</td>}
        {!compact && <td>{gapLabel(row)}</td>}
        {!compact && <td>{row.scenario}</td>}
        <td className={`decision-cell mark-${MARK[row.decision]}`}>
          <span className="decision-label">{DECISION_LABEL[row.decision]}</span>
          {!compact && <span className={`evidence-label evidence-${row.evidence}`}>{EVIDENCE_LABEL[row.evidence]}</span>}
        </td>
      </tr>
      {!compact && (
        <tr>
          <td colSpan={span}>
            <button type="button" onClick={onToggle}>{open ? 'Ocultar' : 'Por qué'}</button>
            {open && (
              <div data-testid={`matrix-why-${row.id}`}>
                <ul>{row.explanation.map((line) => <li key={line}>{line}</li>)}</ul>
                <p>Cobeneficio {row.cobenefit.term > 0 ? formatTerm(row.cobenefit.term) : 'no nombrado'}. No entra al puntaje institucional.</p>
                <p>{row.qualitative.evidence}. {row.qualitative.indicator ?? 'Seguimiento requerido'}.</p>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
