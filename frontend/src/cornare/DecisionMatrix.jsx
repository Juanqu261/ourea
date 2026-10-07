import { useState } from 'react';
import { NBS_LABELS } from '../domain/evidence.js';

const DECISION_LABEL = {
  SELECTED: 'Seleccionada',
  'CLOSE ALTERNATIVE': 'Alternativa cercana',
  'NOT SELECTED': 'No seleccionada',
};

function recurrenceLabel(row) {
  if (row.recurrence.withheld) return 'Por integrar';
  if (!row.recurrence.observed) return '0 observado';
  return formatTerm(row.recurrence.observed);
}

function formatTerm(value) {
  if (value == null) return 'Por integrar';
  return value.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

export function DecisionMatrix({ rows, compact = false }) {
  const [filter, setFilter] = useState(compact ? 'short' : 'all');
  const [openId, setOpenId] = useState(null);
  const visible = rows.filter((row) => {
    if (compact || filter === 'short') return row.decision !== 'NOT SELECTED';
    if (filter === 'selected') return row.decision === 'SELECTED';
    return true;
  });

  return (
    <div className="matrix-wrap" data-testid={compact ? 'matrix-compact' : 'matrix-full'}>
      {!compact && (
        <div className="pill-row" role="group" aria-label="Filtro de la matriz">
          <button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>Todas</button>
          <button type="button" className={filter === 'selected' ? 'is-active' : ''} onClick={() => setFilter('selected')}>Seleccionadas</button>
          <button type="button" className={filter === 'short' ? 'is-active' : ''} onClick={() => setFilter('short')}>Más cercanas</button>
        </div>
      )}
      <p className="matrix-legend">Dato institucional · Inferencia · Por integrar. El cobeneficio no entra al puntaje institucional.</p>
      <div className="matrix-scroll">
        <table>
          <thead>
            <tr>
              <th>Medida</th>
              <th>Ámbito</th>
              <th>Clase</th>
              {!compact && <th>Vulnerabilidad</th>}
              {!compact && <th>Recurrencia</th>}
              {!compact && <th>Talleres</th>}
              <th>COP M</th>
              {!compact && <th>Naturaleza</th>}
              <th>Verificado</th>
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
  const span = compact ? 6 : 11;
  return (
    <>
      <tr data-testid={`matrix-${row.id}`}>
        <th scope="row">{row.name}</th>
        <td>{row.scope}</td>
        <td>{row.vulnerabilityClass}</td>
        {!compact && <td>{formatTerm(row.vulnerabilityComponent)}</td>}
        {!compact && <td>{recurrenceLabel(row)}</td>}
        {!compact && <td>{row.workshop.display}</td>}
        <td>{row.cost.toLocaleString('es-CO')}</td>
        {!compact && <td>{NBS_LABELS[row.nbsClass]}</td>}
        <td>{row.verifiedScore == null ? '—' : formatTerm(row.verifiedScore)}</td>
        {!compact && <td>{row.scenario}</td>}
        <td>{DECISION_LABEL[row.decision]}</td>
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
