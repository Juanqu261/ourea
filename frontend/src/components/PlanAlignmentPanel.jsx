import { SectionHeading } from './SectionHeading.jsx';

function sourceHref(entry) {
  return entry.source_url || entry.source || null;
}

function sourceTitle(entry) {
  return entry.source_title || entry.plan_action;
}

export function PlanAlignmentPanel({ alignment }) {
  const entries = alignment?.entries ?? [];
  if (!entries.length) {
    return (
      <section data-testid="plan-alignment">
        <SectionHeading step={10} title="Comuna 8 plan alignment">
          Documentary tracing of published local actions. Not community validation.
        </SectionHeading>
        <p className="hint">No documentary alignment file is loaded.</p>
      </section>
    );
  }

  return (
    <section data-testid="plan-alignment">
      <SectionHeading step={10} title="Comuna 8 plan alignment">
        Published local planning and research traced to intervention families. Not community
        endorsement and not a numeric local calibration.
      </SectionHeading>
      <p className="hint" role="note">{alignment.guardrail}</p>
      <p className="hint">{alignment.geographic_scope}</p>
      <div className="alignment-list">
        {entries.map((entry) => {
          const href = sourceHref(entry);
          const title = sourceTitle(entry);
          return (
            <article key={entry.id} className="alignment-card" data-testid={`alignment-${entry.id}`}>
              <b>{entry.plan_action}</b>
              <span>
                {entry.intervention_type ?? 'cross-cutting'} · {entry.evidence_status}
              </span>
              <span>Scope: {entry.geographic_scope}</span>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`alignment-source-${entry.id}`}
                >
                  {title}
                </a>
              ) : (
                <span>{title}</span>
              )}
              <span>
                {entry.publisher ? `${entry.publisher}` : null}
                {entry.published_at ? ` · ${entry.published_at}` : null}
              </span>
              <span>Maintenance: {entry.maintenance_responsible ?? 'not documented'}</span>
              {entry.supports?.length > 0 && (
                <small>Supports: {entry.supports.join('; ')}</small>
              )}
              {entry.does_not_establish?.length > 0 && (
                <small>Does not establish: {entry.does_not_establish.join('; ')}</small>
              )}
              <small>Gap: {entry.evidence_gap}</small>
              {entry.prerequisites?.length > 0 && (
                <ul>
                  {entry.prerequisites.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
