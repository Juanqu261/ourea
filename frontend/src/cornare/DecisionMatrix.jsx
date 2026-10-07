import { useState } from 'react';
import { NBS_LABELS } from '../domain/evidence.js';

const DECISION_LABEL = {
  SELECTED: 'Seleccionada',
  'CLOSE ALTERNATIVE': 'Alternativa cercana',
  'NOT SELECTED': 'No seleccionada',
};

const EVIDENCE_LABEL = {
  verified: 'Verificado',
  partial: 'Parcial',
  to_integrate: 'Por integrar',
};

const MARK = {
  SELECTED: 'selected',
  'CLOSE ALTERNATIVE': 'close',
  'NOT SELECTED': 'out',
};

const SHORT_DIMENSION = {
  biodiversity: 'Biodiversidad',
  water: 'Agua',
  disaster: 'Desastres',
  health: 'Salud',
  infrastructure: 'Infraestructura',
  habitat: 'Hábitat',
  food: 'Alimentos',
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

function compactScope(scope) {
  if (String(scope).startsWith('Corredor')) return 'Corredor';
  return scope;
}

function StatusPill({ decision }) {
  return <span className={`status-pill ${MARK[decision]}`}>{DECISION_LABEL[decision]}</span>;
}

function EvidencePill({ evidence }) {
  return <span className={`evidence-pill evidence-${evidence}`}>{EVIDENCE_LABEL[evidence] ?? evidence}</span>;
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
          <button type="button" className={filter === 'short' ? 'is-active' : ''} onClick={() => setFilter('short')}>Selección y cercanas</button>
        </div>
      )}
      {!compact && (
        <p className="matrix-legend">
          El puntaje verificado es la medida sola: vulnerabilidad más recurrencia observada.
          No incluye el componente participativo ni el cobeneficio.
        </p>
      )}
      <div className="matrix-scroll">
        <table className={compact ? 'decision-table is-compact' : 'decision-table'}>
          {compact && (
            <colgroup>
              <col style={{ width: '26%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '12%' }} />
            </colgroup>
          )}
          <thead>
            <tr>
              <th>Medida</th>
              {compact ? (
                <>
                  <th className="num" title="Vulnerabilidad más recurrencia observada. Sin componente participativo ni cobeneficio.">Puntaje verificado</th>
                  <th>Estado</th>
                  <th>Dimensión</th>
                  <th>Ámbito</th>
                  <th>Clase</th>
                </>
              ) : (
                <>
                  <th>Dimensión</th>
                  <th>Ámbito</th>
                  <th>Clase</th>
                  <th>70%</th>
                  <th>Recurrencia</th>
                  <th>Participativo</th>
                  <th className="num">COP M</th>
                  <th>NbS</th>
                  <th className="num" title="Vulnerabilidad más recurrencia observada. Sin componente participativo ni cobeneficio.">Puntaje verificado</th>
                  <th className="num">Aporte</th>
                  <th className="num">Brecha</th>
                  <th>Escenario</th>
                  <th>Estado</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => (
              <MatrixRows
                key={row.id}
                row={row}
                compact={compact}
                stripe={index % 2 === 1}
                open={openId === row.id}
                onToggle={() => setOpenId(openId === row.id ? null : row.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatrixRows({ row, compact, stripe, open, onToggle }) {
  const span = compact ? 6 : 14;
  const rowClass = `matrix-data mark-${MARK[row.decision]}${stripe ? ' is-stripe' : ''}`;
  return (
    <>
      <tr data-testid={`matrix-${row.id}`} className={rowClass}>
        <th scope="row">
          <span className="measure-name">{row.name}</span>
          {!compact && (
            <button type="button" className="text-button" onClick={onToggle}>{open ? 'Ocultar' : 'Por qué'}</button>
          )}
        </th>
        {compact ? (
          <>
            <td className="num">{formatTerm(row.standaloneVerifiedScore)}</td>
            <td className="decision-cell"><StatusPill decision={row.decision} /></td>
            <td>{SHORT_DIMENSION[row.dimensionId] ?? row.dimension}</td>
            <td>{compactScope(row.scope)}</td>
            <td>{row.vulnerabilityClass}</td>
          </>
        ) : (
          <>
            <td>{SHORT_DIMENSION[row.dimensionId] ?? row.dimension}</td>
            <td>{row.scope}</td>
            <td>{row.vulnerabilityClass}</td>
            <td className="num">{formatTerm(row.vulnerabilityComponent)}</td>
            <td>{recurrenceLabel(row)}</td>
            <td>{row.workshop.display}</td>
            <td className="num">{row.cost.toLocaleString('es-CO')}</td>
            <td>{NBS_LABELS[row.nbsClass]}</td>
            <td className="num">{formatTerm(row.standaloneVerifiedScore)}</td>
            <td className="num">{marginalLabel(row)}</td>
            <td className="num">{gapLabel(row)}</td>
            <td>{row.scenario}</td>
            <td className="decision-cell">
              <StatusPill decision={row.decision} />
              <EvidencePill evidence={row.evidence} />
            </td>
          </>
        )}
      </tr>
      {!compact && open && (
        <tr className="matrix-detail">
          <td colSpan={span}>
            <div data-testid={`matrix-why-${row.id}`}>
              <ul>{row.explanation.map((line) => <li key={line}>{line}</li>)}</ul>
              <p>Cobeneficio {row.cobenefit.term > 0 ? formatTerm(row.cobenefit.term) : 'no nombrado'}. No entra al puntaje institucional.</p>
              <p>{row.qualitative.evidence}. {row.qualitative.indicator ?? 'Seguimiento requerido'}.</p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
