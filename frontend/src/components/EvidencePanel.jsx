import { EVIDENCE_GROUPS } from '../config/uiCopy.js';
import { SectionHeading } from './SectionHeading.jsx';
import { PortabilityComparison } from './PortabilityComparison.jsx';

const STATUS_LABELS = {
  'observed-official': 'Observed / official',
  'official-derived-layer': 'Official derived layer',
  'official-cadastral': 'Official cadastral',
  'census-based-proxy': 'Census proxy',
  'official-spatial-proxy': 'Official spatial proxy',
  'official-network-proxy': 'Official network proxy',
  'explicit-planning-priors': 'Explicit planning priors',
  'explicit-planning-assumption': 'Explicit planning assumption',
  'observed-gridded-climatology': 'Observed gridded climatology',
  'observed-remote-sensing': 'Observed / remote-sensing data',
  'population-estimate': 'Population estimate',
  'planning-credits': 'Planning credits',
  'planning-credit-budget-unit': 'Planning-credit budget unit',
  'official-projection': 'Official projection',
  'official-social-index': 'Official social index',
  'official-municipal-evidence': 'Official municipal evidence',
  'derived-screening-proxy': 'Derived screening proxy',
  'retrospective-comparison': 'Retrospective comparison',
};

export function EvidencePanel({ evidence, retrospective, caseConfig }) {
  if (!evidence) return null;

  const byId = new Map((evidence.layers ?? []).map((item) => [item.id, item]));
  const grouped = EVIDENCE_GROUPS.map((group) => ({
    ...group,
    layers: group.ids.map((id) => byId.get(id)).filter(Boolean),
  })).filter((group) => group.layers.length);

  const leftover = (evidence.layers ?? []).filter(
    (item) => !EVIDENCE_GROUPS.some((group) => group.ids.includes(item.id)),
  );
  if (leftover.length) {
    grouped.push({ id: 'other', label: 'Other', layers: leftover });
  }

  return (
    <section>
      <SectionHeading step={8} title="Inspect evidence">
        Observed layers, planning proxies and explicit priors remain separately labeled.
        {caseConfig?.hierarchyLabel ? ` Case role: ${caseConfig.hierarchyLabel}.` : ''}
      </SectionHeading>

      {caseConfig?.caseType === 'portability_demonstration' ? (
        <PortabilityComparison compact />
      ) : null}

      {grouped.map((group) => (
        <div className="evidence-group" key={group.id}>
          <div className="evidence-group-label">{group.label}</div>
          <div className="evidence-grid">
            {group.layers.map((item) => (
              <div className="evidence-item" key={item.id}>
                <div className="evidence-title">
                  <b>{item.label}</b>
                  <span className={`status-badge status-${item.status}`}>
                    {STATUS_LABELS[item.status] ?? item.status}
                  </span>
                </div>
                <span>{item.basis}</span>
                <small>{item.use}</small>
              </div>
            ))}
          </div>
        </div>
      ))}

      {retrospective?.projects?.length ? (
        <div className="evidence-group" data-testid="retrospective-evidence">
          <div className="evidence-group-label">Retrospective municipal evidence</div>
          <p className="muted">
            {retrospective.disclaimer
              ?? 'Independent sanity check only. These projects were not used as optimizer inputs.'}
          </p>
          <div className="evidence-grid">
            {retrospective.projects.map((item) => (
              <div className="evidence-item" key={item.id}>
                <div className="evidence-title">
                  <b>{item.title_en ?? item.title}</b>
                  <span className="status-badge status-retrospective-comparison">
                    Retrospective comparison
                  </span>
                </div>
                <span>{item.claim}</span>
                <small>
                  {item.source}
                  {item.optimizer_input
                    ? ' · WARNING: marked optimizer_input'
                    : ' · optimizer_input: false'}
                </small>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
