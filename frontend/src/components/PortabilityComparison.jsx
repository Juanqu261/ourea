import { listCases } from '../config/cases/index.js';

/**
 * Compact two-context comparison used on CaseSelector and About/Evidence drawers.
 */
export function PortabilityComparison({ compact = false }) {
  const cases = listCases();

  return (
    <section
      className={compact ? 'portability-comparison is-compact' : 'portability-comparison'}
      data-testid="portability-comparison"
    >
      <h3>Two proving contexts</h3>
      <p>
        Same decision engine — different city data, risk context, and evidence depth.
        Medellín is the primary proving ground; Nanjing shows portability, not equal validation.
      </p>
      <div className="portability-grid">
        {cases.map((item) => (
          <article key={item.id} className="portability-card">
            <b>{item.shortName}</b>
            <span className="portability-role">{item.hierarchyLabel}</span>
            <p>{item.hierarchyBlurb}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
